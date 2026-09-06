/** The narrowest the card is ever drawn, and so what has to fit on screen. */
export const MENU_WIDTH = 224;

/** Roughly one row, for working out whether the card still fits below. */
const MENU_ROW = 52;

/** How close to an edge the card may sit before it is pushed back. */
const EDGE = 12;

/**
 * Where to put the menu so it opens beside the button and stays on screen.
 *
 * The card is placed by pushing it in from the right, which is the natural way
 * to describe a menu hanging under a button near the right edge. It stops
 * being natural the moment the button is near the left edge: pushing a 224
 * point card in by nearly the width of the screen puts most of it past the
 * left edge, which is what the left column of the household grid did.
 *
 * So both directions are clamped. Beside the button where there is room, and
 * against the edge where there is not, rather than off the screen entirely.
 */
export function placeMenu(
  anchor: { top: number; right: number },
  screen: { width: number; height: number },
  actions: number,
  bottomInset = 0
): { paddingTop: number; paddingRight: number } {
  const widest = Math.max(EDGE, screen.width - MENU_WIDTH - EDGE);
  const tallest = Math.max(
    EDGE,
    screen.height - bottomInset - EDGE - Math.max(1, actions) * MENU_ROW
  );

  return {
    paddingTop: Math.max(EDGE, Math.min(anchor.top, tallest)),
    paddingRight: Math.max(EDGE, Math.min(anchor.right, widest)),
  };
}
