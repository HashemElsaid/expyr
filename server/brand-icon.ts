/**
 * A service's own icon, fetched on the phone's behalf.
 *
 * The obvious way to do this is to ask Google's favicon service from the phone.
 * It works, it is free, and it quietly tells Google — and whoever runs the
 * network — that this person subscribes to Claude, Netflix and a dating app.
 * For an app whose whole argument is that nothing about you leaves your phone,
 * that is the wrong trade.
 *
 * So the request comes here instead. The service asks on the phone's behalf and
 * hands back the image, which means the icon providers see one server in
 * Frankfurt rather than a user in Dubai, and see it once per icon rather than
 * once per person. Nothing about who asked is kept or logged.
 */

/** Both are free and unauthenticated; the first that answers wins. */
const SOURCES = [
  (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
];

/** A hostname and nothing else — no paths, ports, credentials or schemes. */
const DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const MAX_BYTES = 100_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Kept in memory so a hundred phones asking for Spotify costs one fetch. Small
 * and bounded: these are favicons, a few kilobytes each.
 */
const cache = new Map<string, { body: Buffer; type: string }>();
const MAX_CACHED = 300;

/** No icon service has a logo for 192.168.1.1; asking wastes a request. */
const BARE_IP = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isDomain(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 253 &&
    !BARE_IP.test(value) &&
    DOMAIN.test(value.toLowerCase())
  );
}

export async function fetchBrandIcon(
  domain: string
): Promise<{ body: Buffer; type: string } | null> {
  const key = domain.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  for (const source of SOURCES) {
    try {
      const response = await fetch(source(key), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) continue;

      const type = response.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) continue;

      const body = Buffer.from(await response.arrayBuffer());
      // A favicon is kilobytes; anything larger is not what was asked for.
      if (body.length === 0 || body.length > MAX_BYTES) continue;

      if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
      const found = { body, type };
      cache.set(key, found);
      return found;
    } catch {
      // Try the next source; a missing icon is a cosmetic loss, not an error.
    }
  }

  return null;
}
