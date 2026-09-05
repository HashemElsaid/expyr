/**
 * What went wrong, in a form both ends can act on.
 *
 * The service used to answer every failure with `{ error: someMessage }` and a
 * 500, whatever had actually happened — a malformed request, a rate limit, an
 * upstream refusal and a genuine bug were indistinguishable to the app and to
 * whoever was reading the logs. Worse, the message was often the raw text of an
 * upstream error, which is a place fragments of somebody's tenancy contract can
 * end up.
 *
 * So failures now carry a code the app can branch on, a status that means what
 * it says, and a message written for the person holding the phone. Anything not
 * raised deliberately becomes `internal` and says nothing about itself.
 */

/**
 * The complete set. Adding one is a deliberate act, because the app has to know
 * what to do with it — an unrecognised code is treated as `internal`.
 */
export type ErrorCode =
  /** The request body is not the shape this route accepts. */
  | 'invalid_request'
  /** No credential, or one this service does not accept. */
  | 'unauthorised'
  /** Too many requests from this caller, or too many today. */
  | 'rate_limited'
  /** The body is larger than this service will read. */
  | 'too_large'
  /** The route does not exist. */
  | 'not_found'
  /** Configured off, or missing something it needs to run. */
  | 'unavailable'
  /** Anything else. Deliberately says nothing about itself. */
  | 'internal';

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthorised: 401,
  rate_limited: 429,
  too_large: 413,
  not_found: 404,
  unavailable: 503,
  internal: 500,
};

export class ServiceError extends Error {
  readonly code: ErrorCode;
  /** Seconds, for rate limits. Sent as Retry-After when present. */
  readonly retryAfterSeconds?: number;

  /*
   * Fields declared and assigned rather than written as constructor parameter
   * properties. Node runs these sources directly with no build step, and its
   * type stripping refuses parameter properties outright — `tsc --noEmit` is
   * perfectly happy with them, so the only thing that catches it is starting
   * the server, which is why the suite now does.
   */
  constructor(
    code: ErrorCode,
    /** Written for the person holding the phone, not for a developer. */
    message: string,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get status(): number {
    return STATUS[this.code];
  }
}

/** Shorthand for the common cases, so routes read as prose. */
export const invalid = (message: string) => new ServiceError('invalid_request', message);
export const unauthorised = (message = 'Not authorised.') =>
  new ServiceError('unauthorised', message);
export const rateLimited = (message: string, retryAfterSeconds: number) =>
  new ServiceError('rate_limited', message, retryAfterSeconds);
export const tooLarge = (message: string) => new ServiceError('too_large', message);
export const unavailable = (message: string) => new ServiceError('unavailable', message);

/**
 * Anything thrown, as something safe to send back.
 *
 * The distinction that matters: a ServiceError was raised on purpose and its
 * message was written to be read, so it travels. Anything else came from a
 * library or a bug and could carry back a fragment of whatever was sent, so it
 * is replaced wholesale.
 */
export function toServiceError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  return new ServiceError('internal', 'Something went wrong reading that. Please try again.');
}

/** The line for the log — never sent to a caller. Truncated, and never the object. */
export function describe(error: unknown): string {
  if (error instanceof ServiceError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 200);
  return 'unknown error';
}
