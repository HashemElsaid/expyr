import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Image, Platform } from 'react-native';

import { Attachment } from '@/types';

/*
 * "Send me a copy of your Emirates ID" is the most common thing anyone is asked
 * for in the UAE, and what usually gets sent is a photo taken at an angle with
 * a desk in the background. Institutions want a document, so this turns the
 * photos already stored against an item into a plain A4 PDF: white page, image
 * squared up on it, both sides of a card on one sheet.
 *
 * Nothing is drawn on top of the document itself. A copy someone forwards to a
 * bank or a landlord should not carry our name, and altering an official copy
 * is a good way to get it refused.
 */

/** A4 at 72dpi, which is what the PDF renderer measures in. */
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 36;
const GAP = MARGIN;

/** Keeps the share sheet's filename readable and safe on every filesystem. */
function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Document').slice(0, 60);
}

function measure(uri: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      () => resolve(null)
    );
  });
}

/**
 * Two landscape cards belong on one sheet — that is what an ID copy looks like,
 * and it is what people are asked for. Anything portrait gets a page to itself,
 * because two upright documents squeezed onto one page come out too small to
 * read, which defeats the point of sending a copy at all.
 */
async function imagesPerPage(uris: string[]): Promise<number> {
  if (uris.length !== 2) return 1;
  const sizes = await Promise.all(uris.map(measure));
  const bothLandscape = sizes.every((s) => s !== null && s.w > s.h);
  return bothLandscape ? 2 : 1;
}

/**
 * iOS cannot load local file URLs inside the PDF renderer, so every image has
 * to be inlined as a data URI rather than referenced from disk.
 */
function toDataUri(attachment: Attachment): string | null {
  try {
    const file = new File(attachment.uri);
    if (!file.exists) return null;
    return `data:image/jpeg;base64,${file.base64Sync()}`;
  } catch {
    return null;
  }
}

function buildHtml(images: string[], perPage: number): string {
  /*
   * The gap has to come out of the height before it is split, or a pair of
   * portrait photos overflows onto a second page. Landscape cards are
   * constrained by width long before this matters, which is what makes it easy
   * to miss.
   */
  const usable = PAGE_HEIGHT - MARGIN * 2 - GAP * (perPage - 1);
  const slot = Math.floor(usable / perPage);

  const pages: string[] = [];
  for (let i = 0; i < images.length; i += perPage) {
    const group = images.slice(i, i + perPage);
    const figures = group
      .map((src) => `<figure><img src="${src}" /></figure>`)
      .join('');
    pages.push(`<section>${figures}</section>`);
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; }
  section {
    width: ${PAGE_WIDTH}px;
    height: ${PAGE_HEIGHT}px;
    padding: ${MARGIN}px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: ${GAP}px;
    page-break-after: always;
  }
  section:last-child { page-break-after: auto; }
  figure {
    margin: 0;
    flex: 0 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: ${slot}px;
  }
  img {
    max-width: 100%;
    max-height: ${slot}px;
    object-fit: contain;
  }
</style>
</head>
<body>${pages.join('')}</body>
</html>`;
}

export type CopyOutcome =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'nothing-to-send' | 'failed' };

/**
 * Hands the user a shareable copy of a document. A PDF that was attached is
 * passed straight through, because it is already the thing they need; photos
 * are laid onto pages and rendered to a PDF first.
 */
export async function shareDocumentCopy(
  files: Attachment[],
  title: string
): Promise<CopyOutcome> {
  if (Platform.OS === 'web') return { ok: false, reason: 'unsupported' };
  if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unsupported' };
  if (files.length === 0) return { ok: false, reason: 'nothing-to-send' };

  const name = safeFileName(title);

  // A single attached PDF is already a clean copy. Re-wrapping it would only
  // cost quality.
  const pdfs = files.filter((f) => f.type === 'pdf');
  if (pdfs.length === 1 && files.length === 1) {
    try {
      const source = new File(pdfs[0].uri);
      const target = scratchFile(`${name}.pdf`);
      source.copy(target);
      await Sharing.shareAsync(target.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Share ${name}`,
      });
      return { ok: true };
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }

  const usable = files.filter((f) => f.type === 'image');
  const images = usable.map(toDataUri).filter((src): src is string => src !== null);

  if (images.length === 0) return { ok: false, reason: 'nothing-to-send' };

  try {
    const perPage = await imagesPerPage(usable.map((f) => f.uri));
    const { uri } = await Print.printToFileAsync({
      html: buildHtml(images, perPage),
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });

    // The renderer names the file something random; the share sheet shows the
    // filename, so it is worth renaming before it goes anywhere.
    const target = scratchFile(`${name}.pdf`);
    new File(uri).copy(target);

    await Sharing.shareAsync(target.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Share ${name}`,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

function scratchFile(name: string): File {
  const dir = new Directory(Paths.cache, 'copies');
  if (!dir.exists) dir.create();
  const file = new File(dir, name);
  if (file.exists) file.delete();
  return file;
}
