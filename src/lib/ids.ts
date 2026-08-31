/**
 * Record identifiers.
 *
 * The old scheme was a timestamp plus six random characters, which is fine on
 * one phone and wrong the moment two devices create records while offline: the
 * timestamp half collides by design when people act at the same time, and six
 * characters is not much to separate them.
 *
 * A version 4 UUID is what any sync layer expects. Math.random is enough here —
 * we need these to be unique, not unguessable, and access to a shared record is
 * controlled by who the share was sent to, never by the secrecy of its id.
 */
export function newDocumentId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
