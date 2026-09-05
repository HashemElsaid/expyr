import { randomUUID } from 'node:crypto';

/**
 * What this service writes down, and the much longer list of what it does not.
 *
 * Expyr's privacy screen promises that documents are not written to disk on the
 * server and that questions and answers are not kept. A log is disk. So the
 * rule here is absolute and worth stating rather than assuming: **nothing that
 * came out of a request body is ever logged.** Not the image, not the
 * transcript, not the question, not a subscription's name, not an error message
 * from upstream that might quote any of them.
 *
 * What is logged is shape: which route, how long, how big, what happened. That
 * is enough to answer "is it slow", "is it failing", and "which install is
 * burning the budget", and none of it says anything about anybody.
 *
 * Lines are JSON so they can be searched once there is somewhere to search
 * them, and so a value containing a space cannot pretend to be two fields.
 */

export type Level = 'info' | 'warn' | 'error';

export type LogFields = {
  /** Ties every line about one request together. Returned to the caller too. */
  request: string;
  route?: string;
  status?: number;
  /** Milliseconds from first byte read to response written. */
  ms?: number;
  /** The install this is counted against, or 'anonymous'. Random; identifies nobody. */
  install?: string;
  /** Our own error code, never an upstream message. */
  code?: string;
  /** Free-form, but only ever written by us — never interpolated from a body. */
  note?: string;
  /** Counts and sizes: how many documents, how many characters, never what they said. */
  [key: `n_${string}`]: number | undefined;
};

export function newRequestId(): string {
  // Short enough to paste into a support conversation, long enough to be unique.
  return randomUUID().slice(0, 8);
}

export function log(level: Level, fields: LogFields): void {
  const line = JSON.stringify({ level, at: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
