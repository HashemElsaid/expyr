import { createServer, type IncomingMessage } from 'node:http';

import { extractFromImage, type Category } from './extract.ts';
import { checkRateLimit } from './rate-limit.ts';

const PORT = Number(process.env.PORT ?? 8787);
/**
 * Shared secret the app sends. It ships inside the app bundle, so a determined
 * person can extract it — it raises the bar, and the rate limiter does the rest.
 */
const APP_TOKEN = process.env.RENEWLY_APP_TOKEN;
/** Images arrive base64-encoded, so allow generous headroom over the ~1.5 MB we expect. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

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

function parseRequest(raw: string): {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  categories: Category[];
} {
  const body = JSON.parse(raw) as ExtractRequest;

  if (typeof body.imageBase64 !== 'string' || body.imageBase64.length === 0) {
    throw new Error('imageBase64 is required');
  }
  const mediaType = body.mediaType === 'image/png' ? 'image/png' : 'image/jpeg';

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

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-renewly-token');
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

  if (req.method !== 'POST' || req.url !== '/extract') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (APP_TOKEN && req.headers['x-renewly-token'] !== APP_TOKEN) {
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
    // Deliberately never logged — these images are people's ID documents.
    const { imageBase64, mediaType, categories } = parseRequest(await readBody(req));
    const started = Date.now();
    const result = await extractFromImage({ imageBase64, mediaType, categories });
    console.log(`extract → ${result.typeId} (${result.confidence}) in ${Date.now() - started}ms`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    console.error('extract failed:', message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  ANTHROPIC_API_KEY is not set — scanning will fail until you add it.');
  }
  console.log(`Renewly extraction service listening on http://0.0.0.0:${PORT}`);
});
