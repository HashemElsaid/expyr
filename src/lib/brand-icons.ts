import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { serviceBase } from '@/lib/service';

/**
 * A subscription shown with the service's own icon.
 *
 * The icon is fetched once, through Expyr's own service rather than straight
 * from Google, and then it lives on the phone. That matters twice over: the
 * icon providers never learn who subscribes to what, and a list of eight
 * subscriptions makes no network requests at all after the first time.
 *
 * Kept by domain rather than by document, so two people in a household sharing
 * a Netflix account share one file, and deleting a subscription leaves an icon
 * that costs 3KB and will be reused the next time.
 */

const FOLDER = 'brand-icons';

function folder(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create();
  return dir;
}

/** Domains are already validated by the service; this keeps the filename sane. */
function fileFor(domain: string): File {
  return new File(folder(), `${domain.toLowerCase().replace(/[^a-z0-9.-]/g, '')}.img`);
}

/**
 * The stored icon for a domain, or null when there is not one yet.
 *
 * The web build has no private storage to keep files in, so it points straight
 * at the service and lets the browser's own cache do the keeping. Same request,
 * same privacy — it still goes through Expyr rather than to Google — and it
 * means the preview shows what the phone will show.
 */
export function brandIconUri(domain?: string): string | null {
  if (!domain) return null;
  const clean = domain.toLowerCase();
  if (Platform.OS === 'web') {
    return `${serviceBase()}/icon?domain=${encodeURIComponent(clean)}`;
  }
  try {
    const file = fileFor(clean);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/**
 * Downloads the icon if this phone has never seen it. Silent about failure on
 * purpose: an icon that does not arrive is a tile with a glyph in it, which is
 * what every other row in the app already looks like.
 */
export async function ensureBrandIcon(domain?: string): Promise<void> {
  if (!domain || Platform.OS === 'web') return;

  try {
    const file = fileFor(domain);
    if (file.exists) return;

    const response = await fetch(
      `${serviceBase()}/icon?domain=${encodeURIComponent(domain.toLowerCase())}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) return;

    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) return;

    file.create();
    file.write(bytes);
  } catch {
    // No icon is a cosmetic loss and never worth surfacing.
  }
}
