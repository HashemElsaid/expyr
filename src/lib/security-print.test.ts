import { describe, expect, it } from 'vitest';

import { printPaths } from '@/lib/security-print';

const moves = (d: string) => (d.match(/M/g) ?? []).length;

describe('printPaths', () => {
  it('draws thirty outer curves, twenty-two inner and fourteen waves', () => {
    const p = printPaths(350, 220);
    expect(moves(p.outer)).toBe(30);
    expect(moves(p.inner)).toBe(22);
    expect(moves(p.waves)).toBe(14);
  });

  it('never produces a coordinate that is not a number', () => {
    const p = printPaths(350, 220);
    expect(p.outer + p.inner + p.waves).not.toMatch(/NaN|Infinity/);
  });

  it('draws nothing before the card has a size', () => {
    expect(printPaths(0, 0)).toEqual({ outer: '', inner: '', waves: '' });
    expect(printPaths(NaN, 200)).toEqual({ outer: '', inner: '', waves: '' });
  });

  it('keeps the path data small enough to redraw on a relayout', () => {
    const p = printPaths(390, 300);
    expect((p.outer + p.inner + p.waves).length).toBeLessThan(150_000);
  });
});
