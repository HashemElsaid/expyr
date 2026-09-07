import { postJson } from '@/lib/http';

/**
 * Signing in, so credits outlive the phone they were bought on.
 *
 * The one thing this is for. A credit pack is a consumable, and Apple keeps no
 * record of a consumable once it has been used, so somebody who spends half a
 * pack and then changes phone has nothing for Apple to restore. Without an
 * identity that survives the install, their credits die with it, which is
 * indistinguishable from having taken their money.
 *
 * Deliberately asks Apple for nothing. No name, no email, no scopes at all:
 * the identity token carries a subject identifier that is stable for this
 * person and this app, and that is the entire requirement. Apple's sheet still
 * works, the person still approves it, and there is nothing to leak because
 * nothing was requested.
 *
 * What the service ends up holding is that opaque subject and a number. No
 * document, no date, no name. The phone keeps the papers, as it always has.
 */

/** Long enough for Apple's keys and our disk, short enough not to hang a sheet. */
const TIMEOUT_MS = 20_000;

export type SignInOutcome =
  | { ok: true; account: string; balance: number }
  /** They closed Apple's sheet. Not a failure and not worth an alert. */
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; message: string };

/**
 * expo-apple-authentication is native, and absent from Expo Go and from any
 * build made before it was added. Loaded on demand behind a catch so a build
 * without it keeps working rather than failing at import.
 */
type AppleAuth = typeof import('expo-apple-authentication');
let loading: Promise<AppleAuth | null> | null = null;

function appleAuth(): Promise<AppleAuth | null> {
  loading ??= import('expo-apple-authentication').catch(() => null);
  return loading;
}

/**
 * Whether this phone can sign in at all.
 *
 * False on Android, on the simulator, and on a build with no entitlement. The
 * screens hide the offer rather than showing a button that cannot work.
 */
export async function canSignIn(): Promise<boolean> {
  const apple = await appleAuth();
  if (!apple) return false;
  try {
    return await apple.isAvailableAsync();
  } catch {
    return false;
  }
}

function cancelled(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}

/**
 * Signs in and tells the service, which moves whatever this install had onto
 * the account and hands back the balance that now counts.
 *
 * Linking is safe to repeat: the service moves an install's credits once and
 * only once, so signing in again on the same phone changes nothing.
 */
export async function signIn(): Promise<SignInOutcome> {
  const apple = await appleAuth();
  if (!apple) {
    return {
      ok: false,
      message: 'This build cannot sign in yet. It needs a newer version of Expyr.',
    };
  }

  let identityToken: string | null = null;
  try {
    /*
     * No requestedScopes. Asking for a name or an email would mean holding
     * them, and neither is needed to know that two phones belong to the same
     * person.
     */
    const credential = await apple.signInAsync({ requestedScopes: [] });
    identityToken = credential.identityToken;
  } catch (error) {
    if (cancelled(error)) return { ok: false, cancelled: true };
    return { ok: false, message: 'Apple could not sign you in. Try again in a moment.' };
  }

  if (!identityToken) {
    return { ok: false, message: 'Apple did not return anything Expyr could verify.' };
  }

  const reply = await postJson<{ account: string; balance: number }>(
    '/account/link',
    { identityToken },
    {
      timeoutMs: TIMEOUT_MS,
      messages: {
        unauthorised: 'This copy of Expyr is not authorised.',
        refused: 'Expyr could not confirm that sign-in. Your credits are safe either way.',
        timedOut: 'That took too long. Your credits are safe. Try again in a moment.',
        unreachable: 'Expyr could not reach its service. Your credits are safe on this phone.',
      },
    }
  );

  return { ok: true, account: reply.account, balance: reply.balance };
}

/**
 * The balance this account holds, for a phone that has just been set up.
 *
 * Needs a fresh identity token, which means Apple's sheet, which means this
 * can only run from something somebody tapped. Ordinary requests resolve the
 * account from the install credential instead and never come near here.
 */
export async function balanceForAccount(): Promise<number | null> {
  const apple = await appleAuth();
  if (!apple) return null;

  try {
    const credential = await apple.signInAsync({ requestedScopes: [] });
    if (!credential.identityToken) return null;

    const reply = await postJson<{ balance: number }>(
      '/account/balance',
      { identityToken: credential.identityToken },
      { timeoutMs: TIMEOUT_MS }
    );
    return reply.balance;
  } catch {
    return null;
  }
}

/**
 * Deletes the account, which Apple requires an app offering accounts to allow
 * from the inside.
 *
 * Asks Apple's sheet again rather than trusting the install credential. An
 * install token is something a stolen phone already has, and this erases a
 * balance somebody paid for, so it is the one action worth the extra tap.
 */
export async function deleteAccount(): Promise<SignInOutcome | { ok: true; deleted: true }> {
  const apple = await appleAuth();
  if (!apple) {
    return { ok: false, message: 'This build cannot do that yet.' };
  }

  let identityToken: string | null = null;
  try {
    const credential = await apple.signInAsync({ requestedScopes: [] });
    identityToken = credential.identityToken;
  } catch (error) {
    if (cancelled(error)) return { ok: false, cancelled: true };
    return { ok: false, message: 'Apple could not confirm it was you. Nothing was deleted.' };
  }

  if (!identityToken) {
    return { ok: false, message: 'Apple did not return anything Expyr could verify.' };
  }

  await postJson<{ deleted: boolean }>(
    '/account/delete',
    { identityToken },
    {
      timeoutMs: TIMEOUT_MS,
      messages: {
        unauthorised: 'This copy of Expyr is not authorised.',
        refused: 'Expyr could not delete that just now. Nothing has been removed.',
        timedOut: 'That took too long. Nothing has been removed. Try again in a moment.',
        unreachable: 'Expyr could not reach its service. Nothing has been removed.',
      },
    }
  );

  return { ok: true, deleted: true };
}
