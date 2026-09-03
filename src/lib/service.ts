import Constants from 'expo-constants';

/**
 * Where the reading service lives, and the one rule about reaching it.
 *
 * Documents are the most sensitive thing this app touches, so they are never
 * put on the wire unencrypted. A build pointed at a plain http:// address
 * refuses to send anything at all rather than sending it in the clear — a
 * misconfigured environment variable should cost a broken feature, never
 * somebody's passport.
 *
 * The exception is a service running on the same desk during development,
 * where http://localhost and the private LAN ranges are how the phone reaches
 * a laptop and nothing leaves the room.
 */

const PRIVATE_HOST =
  /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/;

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').split(/[:/]/)[0];
}

function assertEncrypted(url: string) {
  if (url.startsWith('https://')) return;
  if (PRIVATE_HOST.test(hostOf(url))) return;
  throw new Error(
    'Expyr will not send your documents over an unencrypted connection. The reading service address must start with https://.'
  );
}

/** The service root, with no trailing path — endpoints hang off it. */
export function serviceBase(): string {
  const explicit = process.env.EXPO_PUBLIC_EXTRACT_URL;
  if (explicit) {
    // The one configured URL points at /extract; the siblings sit beside it.
    const base = explicit.replace(/\/extract\/?$/, '').replace(/\/$/, '');
    assertEncrypted(base);
    return base;
  }
  // In development the service runs on the same machine as Metro.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8787`;
}
