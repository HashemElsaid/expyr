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

/**
 * The services whose name is not their website. Every one of these would
 * otherwise fetch a stranger's logo: claude.com is not Anthropic, shahid.com is
 * not MBC, and prime.com is not Amazon. Short on purpose — the guess below
 * handles the long tail, and an import never needs either, because the model
 * naming the site already knows what these are.
 */
const KNOWN: Record<string, string> = {
  claude: 'claude.ai',
  // A receipt says who took the money, so the biller's name ends up on the row.
  anthropic: 'claude.ai',
  chatgpt: 'chatgpt.com',
  openai: 'openai.com',
  shahid: 'shahid.mbc.net',
  prime: 'primevideo.com',
  amazonprime: 'primevideo.com',
  disney: 'disneyplus.com',
  appletv: 'tv.apple.com',
  icloud: 'icloud.com',
  osn: 'osn.com',
  du: 'du.ae',
  etisalat: 'etisalat.ae',
  eand: 'etisalat.ae',
  twitter: 'x.com',
  office: 'microsoft.com',
  microsoft365: 'microsoft.com',
};

/**
 * A domain worth trying for a subscription somebody typed in themselves.
 *
 * The import never needs this: the model reading the screenshot names the site
 * because it knows what Anghami is. A hand-typed row has only a name, so this
 * makes the obvious guess and lets it fail — nothing comes back, and the row
 * keeps the tile it already had.
 *
 * Deliberately narrow, and only ever asked about subscriptions. A passport is
 * not passport.com, "Gym" is not gym.com, and a stranger's logo on somebody's
 * list is worse than no logo at all.
 */
export function guessDomain(title: string): string | undefined {
  const plain = title.trim().toLowerCase();
  // "Apple TV+" and "Amazon Prime" are known under one word.
  const compact = plain.replace(/[^a-z0-9]/g, '');
  if (KNOWN[compact]) return KNOWN[compact];
  if (!/\s/.test(plain)) {
    return /^[a-z][a-z0-9]{3,19}$/.test(compact) ? `${compact}.com` : undefined;
  }

  /*
   * A title with several words in it usually leads with the brand, because that
   * is how a receipt names things: "Anthropic PBC Max plan", "Netflix Standard
   * with ads", "Adobe Creative Cloud". So the first word is tried and the rest
   * ignored. Squeezing the whole title together instead turned "My gym
   * membership" into mygymmembership.com, which is a request to a stranger
   * about somebody's private list.
   */
  const first = plain.split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  if (KNOWN[first]) return KNOWN[first];
  return /^[a-z][a-z0-9]{3,19}$/.test(first) ? `${first}.com` : undefined;
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
 * Downloads the icon if this phone has never seen it, and says whether it did.
 *
 * Silent about failure on purpose: an icon that does not arrive is a tile with
 * a glyph in it, which is what every other row in the app already looks like.
 */
export async function ensureBrandIcon(domain?: string): Promise<boolean> {
  if (!domain || Platform.OS === 'web') return false;

  /*
   * A controller and a timer rather than AbortSignal.timeout, which the phone's
   * JavaScript engine does not have — it threw, the catch below swallowed it,
   * and every icon silently failed to arrive while the browser preview, which
   * does have it, looked perfect.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const file = fileFor(domain);
    if (file.exists) return false;

    const response = await fetch(
      `${serviceBase()}/icon?domain=${encodeURIComponent(domain.toLowerCase())}`,
      { signal: controller.signal }
    );
    if (!response.ok) return false;

    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return false;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) return false;

    file.create();
    file.write(bytes);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
