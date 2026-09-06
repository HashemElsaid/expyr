import { describe, expect, it } from 'vitest';

import { MENU_WIDTH, placeMenu } from '@/components/document/menu-placement';

/** An iPhone 15 Pro, in points. */
const SCREEN = { width: 393, height: 852 };

/** The left edge of the card, worked out from the padding that positions it. */
function leftEdge(paddingRight: number): number {
  return SCREEN.width - paddingRight - MENU_WIDTH;
}

describe('placing the menu', () => {
  it('opens beside the button when there is room', () => {
    const { paddingRight } = placeMenu({ top: 200, right: 40 }, SCREEN, 4);
    expect(paddingRight).toBe(40);
  });

  /*
   * The bug this exists for. The left column of the household grid puts the
   * button near the left edge, so `right` is nearly the width of the screen,
   * and pushing a 224 point card in that far leaves most of it off screen.
   */
  it('does not hang off the left edge for a button in the left column', () => {
    const { paddingRight } = placeMenu({ top: 340, right: 330 }, SCREEN, 4);
    expect(leftEdge(paddingRight)).toBeGreaterThanOrEqual(0);
  });

  it('keeps the whole card on screen wherever the button is', () => {
    for (let right = 0; right <= SCREEN.width; right += 7) {
      const placed = placeMenu({ top: 100, right }, SCREEN, 4);
      expect(leftEdge(placed.paddingRight)).toBeGreaterThanOrEqual(0);
      expect(placed.paddingRight).toBeGreaterThanOrEqual(0);
    }
  });

  it('pulls a card near the bottom back up so its actions are reachable', () => {
    const low = placeMenu({ top: 800, right: 40 }, SCREEN, 4);
    expect(low.paddingTop).toBeLessThan(800);
    // Four rows still fit above the bottom of the screen.
    expect(low.paddingTop + 4 * 52).toBeLessThanOrEqual(SCREEN.height);
  });

  it('leaves room for the home indicator when there is one', () => {
    const withInset = placeMenu({ top: 800, right: 40 }, SCREEN, 4, 34);
    const without = placeMenu({ top: 800, right: 40 }, SCREEN, 4, 0);
    expect(withInset.paddingTop).toBeLessThan(without.paddingTop);
  });

  it('never places the card above the top of the screen', () => {
    expect(placeMenu({ top: -50, right: 40 }, SCREEN, 4).paddingTop).toBeGreaterThanOrEqual(0);
  });

  it('copes with a screen too small for the card', () => {
    const tiny = placeMenu({ top: 10, right: 10 }, { width: 200, height: 300 }, 4);
    expect(tiny.paddingRight).toBeGreaterThanOrEqual(0);
    expect(tiny.paddingTop).toBeGreaterThanOrEqual(0);
  });
});
