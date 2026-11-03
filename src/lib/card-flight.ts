import { useSyncExternalStore } from 'react';

/**
 * The card that flies between a row and the page it opens.
 *
 * A tap on a row records where the row is on screen and opens the page; the
 * page reports where its card will settle; a copy of the card flies between
 * the two above everything while the page slides in underneath, and the real
 * card takes over when it lands. Going back with the back button flies it home
 * again to the spot it came from.
 *
 * Held here rather than in either screen because the flight outlives both
 * moments: it starts on one screen and lands on another.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export type Flight = {
  /** The document the card belongs to. */
  id: string;
  from: Rect;
  fromRadius: number;
  /** Not known until the page has laid its card out. */
  to: Rect | null;
  toRadius: number;
  direction: 'out' | 'home';
  late: boolean;
  /** Distinguishes one flight from the next for the same document. */
  key: number;
};

/** The radius the card has on its own page. */
export const CARD_RADIUS = 24;

let current: Flight | null = null;
let next = 0;
let abandon: ReturnType<typeof setTimeout> | undefined;
const origins = new Map<string, { rect: Rect; radius: number }>();
const listeners = new Set<() => void>();

function set(flight: Flight | null) {
  current = flight;
  listeners.forEach((listener) => listener());
}

/** From a row, as the page for it is opened. */
export function launch(id: string, from: Rect, fromRadius: number, late = false) {
  origins.set(id, { rect: from, radius: fromRadius });
  const key = ++next;
  set({ id, from, fromRadius, to: null, toRadius: CARD_RADIUS, direction: 'out', late, key });
  /*
   * If the page never reports where its card is, because the document has gone
   * or the push was interrupted, the flight is dropped rather than leaving the
   * row and the card invisible.
   */
  clearTimeout(abandon);
  abandon = setTimeout(() => {
    if (current?.key === key && !current.to) set(null);
  }, 900);
}

/** From the page: this is where the card will settle. */
export function arrive(id: string, to: Rect) {
  if (current?.id === id && current.direction === 'out' && !current.to) set({ ...current, to });
}

/**
 * From the page's back button: fly the card back to the row it came from.
 * False when there is nowhere to fly it to, so the page simply goes back.
 */
export function flyHome(id: string, from: Rect, late = false): boolean {
  const origin = origins.get(id);
  if (!origin) return false;
  set({
    id,
    from,
    fromRadius: CARD_RADIUS,
    to: origin.rect,
    toRadius: origin.radius,
    direction: 'home',
    late,
    key: ++next,
  });
  return true;
}

/** From the overlay, once the card has landed. */
export function finish(key: number) {
  if (current?.key === key) set(null);
}

/** The flight in the air right now, read once. */
export function peekFlight(): Flight | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The flight in the air, if any. */
export function useFlight(): Flight | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** True while a copy of this document's card is in the air. */
export function useInFlight(id: string | undefined): boolean {
  const flight = useFlight();
  return !!id && flight?.id === id;
}
