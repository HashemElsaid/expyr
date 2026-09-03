import { createServer, type IncomingMessage } from 'node:http';

import { askDocument, briefDocument, readDocument } from './comprehend.ts';
import { extractFromImage, type Category, type SupportedMediaType } from './extract.ts';
import { checkRateLimit } from './rate-limit.ts';

const PORT = Number(process.env.PORT ?? 8787);
/**
 * Shared secret the app sends. It ships inside the app bundle, so a determined
 * person can extract it — it raises the bar, and the rate limiter does the rest.
 */
/*
 * The old name is still read because it is what is set in Render's dashboard
 * today. Dropping it here would not fail loudly — APP_TOKEN would simply be
 * undefined and the check below would wave every request through.
 */
const APP_TOKEN = process.env.EXPYR_APP_TOKEN ?? process.env.RENEWLY_APP_TOKEN;
/**
 * Base64 inflates by about a third, and PDFs are far larger than photos.
 * Claude accepts a 32 MB request, so this leaves room while staying below it.
 */
const MAX_BODY_BYTES = 24 * 1024 * 1024;

type ExtractRequest = {
  imageBase64?: unknown;
  mediaType?: unknown;
  categories?: unknown;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Image too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const SUPPORTED_MEDIA_TYPES: SupportedMediaType[] = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

function parseRequest(raw: string): {
  imageBase64: string;
  mediaType: SupportedMediaType;
  categories: Category[];
} {
  const body = JSON.parse(raw) as ExtractRequest;

  if (typeof body.imageBase64 !== 'string' || body.imageBase64.length === 0) {
    throw new Error('imageBase64 is required');
  }
  const requested = body.mediaType as SupportedMediaType;
  const mediaType = SUPPORTED_MEDIA_TYPES.includes(requested) ? requested : 'image/jpeg';

  if (!Array.isArray(body.categories) || body.categories.length === 0) {
    throw new Error('categories is required');
  }
  const categories = body.categories.map((entry) => {
    const c = entry as Category;
    if (typeof c?.id !== 'string' || typeof c?.label !== 'string') {
      throw new Error('each category needs an id and a label');
    }
    return { id: c.id, label: c.label, hint: typeof c.hint === 'string' ? c.hint : undefined };
  });

  return { imageBase64: body.imageBase64, mediaType, categories };
}

/**
 * A transcript is long, but not unbounded. This is generous for a multi-page
 * tenancy contract and still refuses anything that looks like a paste attack.
 */
const MAX_TEXT_CHARS = 400_000;
const MAX_QUESTION_CHARS = 2_000;

function parseReadRequest(raw: string): { fileBase64: string; mediaType: SupportedMediaType } {
  const body = JSON.parse(raw) as { fileBase64?: unknown; mediaType?: unknown };
  if (typeof body.fileBase64 !== 'string' || body.fileBase64.length === 0) {
    throw new Error('fileBase64 is required');
  }
  const requested = body.mediaType as SupportedMediaType;
  return {
    fileBase64: body.fileBase64,
    mediaType: SUPPORTED_MEDIA_TYPES.includes(requested) ? requested : 'image/jpeg',
  };
}

function parseText(raw: string): string {
  const body = JSON.parse(raw) as { text?: unknown };
  if (typeof body.text !== 'string' || body.text.trim().length === 0) {
    throw new Error('text is required');
  }
  if (body.text.length > MAX_TEXT_CHARS) throw new Error('That document is too long to read');
  return body.text;
}

/** At most this many documents in one question, so a large file cannot stall. */
const MAX_ASK_DOCUMENTS = 12;

function parseAskRequest(raw: string): {
  documents: { title: string; text: string }[];
  question: string;
  history: { question: string; answer: string }[];
} {
  const body = JSON.parse(raw) as {
    text?: unknown;
    documents?: unknown;
    question?: unknown;
    history?: unknown;
  };

  /*
   * One document arrives as `text`, a whole file of them as `documents`. Both
   * shapes stay supported: a phone that has not been updated still asks the
   * only way it knows how.
   */
  let documents: { title: string; text: string }[];
  if (Array.isArray(body.documents)) {
    documents = body.documents
      .filter(
        (d): d is { title: string; text: string } =>
          typeof (d as { title?: unknown })?.title === 'string' &&
          typeof (d as { text?: unknown })?.text === 'string' &&
          (d as { text: string }).text.trim().length > 0
      )
      .slice(0, MAX_ASK_DOCUMENTS);
    if (documents.length === 0) throw new Error('documents is required');
    const total = documents.reduce((sum, d) => sum + d.text.length, 0);
    if (total > MAX_TEXT_CHARS) throw new Error('That is more text than we can read at once');
  } else {
    documents = [{ title: '', text: parseText(raw) }];
  }

  if (typeof body.question !== 'string' || body.question.trim().length === 0) {
    throw new Error('question is required');
  }
  if (body.question.length > MAX_QUESTION_CHARS) throw new Error('That question is too long');

  // Only the last few turns travel, so a long conversation cannot grow the
  // request without limit.
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is { question: string; answer: string } =>
            typeof (t as { question?: unknown })?.question === 'string' &&
            typeof (t as { answer?: unknown })?.answer === 'string'
        )
        .slice(-6)
    : [];

  return { documents, question: body.question.trim(), history };
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-expyr-token, x-renewly-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    const configured = Boolean(process.env.ANTHROPIC_API_KEY);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, apiKeyConfigured: configured }));
    return;
  }

  const route = (req.url ?? '').split('?')[0];
  const ROUTES = ['/extract', '/read', '/brief', '/ask'];
  if (req.method !== 'POST' || !ROUTES.includes(route)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Both header names, so a phone running a cached bundle is not locked out.
  const sent = req.headers['x-expyr-token'] ?? req.headers['x-renewly-token'];
  if (APP_TOKEN && sent !== APP_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not authorised.' }));
    return;
  }

  // Behind a proxy the real client address arrives in x-forwarded-for.
  const forwarded = req.headers['x-forwarded-for'];
  const clientKey =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
    req.socket.remoteAddress ??
    'unknown';

  const limit = checkRateLimit(clientKey);
  if (!limit.allowed) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': String(limit.retryAfterSeconds),
    });
    res.end(
      JSON.stringify({ error: 'Too many scans in a short time. Please try again shortly.' })
    );
    return;
  }

  try {
    // Deliberately never logged — these are people's ID documents and contracts.
    const raw = await readBody(req);
    const started = Date.now();

    if (route === '/extract') {
      const { imageBase64, mediaType, categories } = parseRequest(raw);
      const result = await extractFromImage({ imageBase64, mediaType, categories });
      console.log(`extract → ${result.typeId} (${result.confidence}) in ${Date.now() - started}ms`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (route === '/read') {
      const { fileBase64, mediaType } = parseReadRequest(raw);
      const text = await readDocument({ fileBase64, mediaType });
      console.log(`read → ${text.length} chars in ${Date.now() - started}ms`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text }));
      return;
    }

    if (route === '/brief') {
      const text = parseText(raw);
      const brief = await briefDocument(text);
      console.log(
        `brief → ${brief.points.length} points, ${brief.obligations.length} obligations in ${Date.now() - started}ms`
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(brief));
      return;
    }

    const { documents, question, history } = parseAskRequest(raw);
    const answer = await askDocument({ documents, question, history });
    // The question and answer are the user's business, so only the shape is logged.
    console.log(
      `ask → ${documents.length} document(s), answered=${answer.answered} in ${Date.now() - started}ms`
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(answer));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    console.error(`${route} failed:`, message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY is not set — scanning will fail until you add it.');
  }
  console.log(`Expyr extraction service listening on http://0.0.0.0:${PORT}`);
});
