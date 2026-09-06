import { describe, expect, it } from 'vitest';

import { shadow, withAlpha } from '@/constants/theme';

describe('withAlpha', () => {
  it('turns a six digit hex into rgba', () => {
    expect(withAlpha('#191713', 0.12)).toBe('rgba(25, 23, 19, 0.12)');
  });

  it('accepts the short form', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('does not mind a missing hash', () => {
    expect(withAlpha('1D4B39', 1)).toBe('rgba(29, 75, 57, 1)');
  });

  /*
   * Returning the colour untouched makes a mistake show up as a shadow that is
   * too dark. Returning a default would make it disappear, which is the kind of
   * thing nobody notices until a screenshot looks flat.
   */
  it('hands back anything it cannot read rather than guessing', () => {
    expect(withAlpha('rebeccapurple', 0.3)).toBe('rebeccapurple');
    expect(withAlpha('#12345', 0.3)).toBe('#12345');
    expect(withAlpha('#gggggg', 0.3)).toBe('#gggggg');
  });
});

describe('shadow', () => {
  it('casts straight down, in the form boxShadow takes', () => {
    expect(shadow('#191713', 4, 8, 0.12)).toBe('0px 4px 8px rgba(25, 23, 19, 0.12)');
  });
});
