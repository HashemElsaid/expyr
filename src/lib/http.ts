import { forgetInstallToken, installToken } from '@/lib/install';
import { serviceBase } from '@/lib/service';

/**
 * The one way this app talks to its reading service.
 *
 * There were three of these, near-identical and quietly divergent: the same
 * credential dance, the same abort-and-timeout pattern, the same mapping from
 * status code to a sentence — except where one of them had learned something
 * the other two had not. Reading a document told the user that a validation
 * error meant the service needed updating; scanning a photo showed them
 * "text is required". Both were written by the same hand a week apart.
 *
 * One client, so a lesson learned once is learned everywhere.
 */

/**
 * How a failure is described to the person holding the phone.
 *
 * Every message here is about what they can do next, because that is the only
 * useful thing an error can say. What actually went wrong belongs in the
 * service's own logs, where somebody can act on it.
 */
export type ErrorMessages = {
  /** Too many requests in a short time. */
  rateLimited: string;
  /** The service does not accept this copy of the app. */
  unauthorised: string;
  /** The request was too large for the service to take. */
  tooLarge: string;
  /** Anything else the service refused, with nothing useful to relay. */
  refused: string;
  /** The request ran past its own deadline. */
  timedOut: string;
  /** The service could not be reached at all. */
  unreachable: string;
};

const DEFAULT_MESSAGES: ErrorMessages = {
  rateLimited: 'You have asked a lot in a short time. Try again in a few minutes.',
  unauthorised: 'This copy of Expyr is not authorised.',
  tooLarge: 'That file is too large to read. Try a smaller one.',
  refused: 'Expyr could not do that just now. Please try again.',
  timedOut: 'That took too long. Check your connection and try again.',
  unreachable: 'Could not reach the reading service. Check your connection.',
};

export type PostOptions = {
  /** How long to wait before giving up. Transcription needs far longer than a scan. */
  timeoutMs: number;
  /** Overrides for the messages above; anything omitted keeps the default. */
  messages?: Partial<ErrorMessages>;
};

/**
 * Errors the service reports about the request itself rather than about
 * anything the user did.
 *
 * "text is required" tells somebody holding a phone nothing they can act on,
 * and it means the app and the service disagree about the shape of a request —
 * which is a deployment, not a mistake they made. So these are swallowed in
 * favour of saying so.
 */
const INTERNAL_ERROR = /is required|too long|more text than|not one of/i;

/** Thrown for everything below, so callers can tell ours from a bug. */
export class ServiceError extends Error {
  constructor(
    message: string,
    /** The HTTP status, or 0 when the request never got an answer. */
    readonly status: number
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options: PostOptions
): Promise<T> {
  const say = { ...DEFAULT_MESSAGES, ...options.messages };

  /*
   * A controller and a timer rather than AbortSignal.timeout, which the
   * phone's JavaScript engine does not have. It threw, the catch swallowed it,
   * and every request silently failed while the browser preview — which does
   * have it — looked perfect.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const appToken = process.env.EXPO_PUBLIC_SCAN_TOKEN;
    /*
     * This phone's own credential, so the service counts what this phone does
     * rather than what every copy of Expyr does together. Absent on the web,
     * and absent until the first registration succeeds; the shared token still
     * works, and is still limited.
     */
    const install = await installToken();

    const response = await fetch(`${serviceBase()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(appToken ? { 'x-expyr-token': appToken } : {}),
        ...(install ? { 'x-expyr-install': install } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (response.ok) return (await response.json()) as T;

    if (response.status === 429) throw new ServiceError(say.rateLimited, 429);
    if (response.status === 413) throw new ServiceError(say.tooLarge, 413);

    if (response.status === 401) {
      // A credential the service no longer accepts is dropped, so the next
      // attempt registers again rather than failing forever.
      await forgetInstallToken();
      throw new ServiceError(say.unauthorised, 401);
    }

    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    const reported = detail?.error ?? '';
    const relayable = reported && !INTERNAL_ERROR.test(reported);
    throw new ServiceError(relayable ? reported : say.refused, response.status);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ServiceError(say.timedOut, 0);
    }
    // fetch rejects with a TypeError when it cannot reach the host at all.
    if (error instanceof TypeError) throw new ServiceError(say.unreachable, 0);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
