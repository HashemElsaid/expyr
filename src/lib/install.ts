import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * This install's own credential for the reading service.
 *
 * The token baked into the app bundle is the same for every copy of Expyr, so
 * anyone who pulls it out is holding the whole service's key. On first use the
 * app trades it once for a credential of its own, and everything after that is
 * counted against this phone alone. A leaked one is then worth one phone's
 * allowance a day rather than everybody's.
 *
 * It lives in the iOS Keychain rather than ordinary storage, so it is not in
 * the backup that goes to iCloud and not readable by anything else on the
 * phone. It identifies nobody: the server made it out of random bytes and
 * knows nothing about who is holding it.
 */

const KEY = 'expyr.install.token';

let cached: string | null = null;
let inFlight: Promise<string | null> | null = null;

function serviceBase(): string {
  const explicit = process.env.EXPO_PUBLIC_EXTRACT_URL;
  if (explicit) return explicit.replace(/\/extract\/?$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8787`;
}

async function read(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function write(token: string) {
  try {
    await SecureStore.setItemAsync(KEY, token, {
      // Available whenever the phone has been unlocked once, and never copied
      // to another device by a backup.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // A credential that cannot be stored still works for this session.
  }
}

async function register(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const appToken = process.env.EXPO_PUBLIC_SCAN_TOKEN;
    const response = await fetch(`${serviceBase()}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(appToken ? { 'x-expyr-token': appToken } : {}),
      },
      signal: controller.signal,
      body: '{}',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { token?: unknown };
    return typeof body.token === 'string' ? body.token : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The credential to send with a request, registering for one if this install
 * has never had one. Returns null when there is no credential to be had — no
 * Keychain on the web, or the service could not be reached — and the caller
 * falls back to the shared app token, which still works and is still limited.
 */
export async function installToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const stored = await read();
    if (stored) {
      cached = stored;
      return stored;
    }
    const issued = await register();
    if (issued) {
      cached = issued;
      await write(issued);
    }
    return issued;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Called when the service says a credential is no longer good — expired, or
 * signed with a secret that has since been rotated. The next request registers
 * again, which is the whole of the renewal story.
 */
export async function forgetInstallToken() {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing to do: a stale credential simply fails again and is dropped.
  }
}
