import { PDFDocument } from 'pdf-lib';

/**
 * Cutting a PDF down to the pages that were asked for.
 *
 * A fourteen-page tenancy contract is not a big upload — a few megabytes — but
 * transcribing it is tens of thousands of tokens of generation, which took over
 * two minutes and then hit the sixteen-thousand-token ceiling on the way out.
 * The phone gave up first and showed a spinner the whole time.
 *
 * There is no page range in the model's PDF support: you send a document and it
 * reads the document. So the range has to be real — an actual smaller PDF, cut
 * here, holding only those pages. The phone sends the same file for each batch
 * rather than the service keeping it between calls, which costs some bandwidth
 * and keeps the promise the app makes in writing: the document is never held
 * once the answer is produced.
 */

function bytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Encryption is ignored rather than refused.
 *
 * Government portals hand out PDFs with an owner password set — printing and
 * copying restrictions, not a password the holder was ever given. Ejari
 * contracts are routinely like this. Refusing them would reject exactly the
 * documents this feature exists for.
 */
async function open(base64: string) {
  return PDFDocument.load(bytes(base64), { ignoreEncryption: true });
}

export async function pdfPageCount(base64: string): Promise<number> {
  const doc = await open(base64);
  return doc.getPageCount();
}

/**
 * Pages `from`..`to`, counted from 1 and including both ends, as a new PDF in
 * base64. A range running past the end is clamped rather than rejected: the
 * phone works out its batches from a page count this service gave it, and the
 * last batch is almost always short.
 */
export async function pdfPages(base64: string, from: number, to: number): Promise<string> {
  const source = await open(base64);
  const total = source.getPageCount();

  const first = Math.max(1, Math.min(from, total));
  const last = Math.max(first, Math.min(to, total));

  const indices: number[] = [];
  for (let page = first; page <= last; page += 1) indices.push(page - 1);

  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, indices);
  for (const page of copied) out.addPage(page);

  return out.saveAsBase64();
}
