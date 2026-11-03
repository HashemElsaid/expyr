/**
 * The lines printed on a card: a guilloché rosette and a band of waves, the
 * pattern banknotes and passport pages carry so they cannot be copied cleanly.
 *
 * Pure, so it can be tested without a renderer, and drawn for the card's
 * actual size rather than stretched, so the lines stay one hairline thick on
 * every card. The rosette sits towards the top right, where a cover puts its
 * emblem, and the waves run along the foot.
 */
export type PrintPaths = { outer: string; inner: string; waves: string };

/** Points round each curve: finer than the eye can find at this line weight. */
const STEPS = 180;

export function printPaths(width: number, height: number): PrintPaths {
  if (!(width > 0) || !(height > 0)) return { outer: '', inner: '', waves: '' };

  const cx = width * 0.84;
  const cy = height * 0.36;
  const a = Math.min(width, height) * 0.64;

  /*
   * A family of closed curves r = R + B sin(nθ + φ), each a little further
   * round in phase than the last, so together they weave.
   */
  const rosette = (radius: number, depth: number, lobes: number, curves: number) => {
    let d = '';
    for (let k = 0; k < curves; k++) {
      const phase = (k / curves) * ((Math.PI * 2) / lobes);
      for (let i = 0; i <= STEPS; i++) {
        const t = (i / STEPS) * Math.PI * 2;
        const r = radius + depth * Math.sin(lobes * t + phase);
        d += (i ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1);
      }
    }
    return d;
  };

  let waves = '';
  for (let k = 0; k < 14; k++) {
    for (let x = 0; x <= width; x += 4) {
      const y =
        height * 0.84 + Math.sin((x / width) * Math.PI * 4 + k * 0.35) * height * 0.055 + k * 1.5;
      waves += (x ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
  }

  return {
    outer: rosette(a, a * 0.3, 9, 30),
    inner: rosette(a * 0.46, a * 0.17, 13, 22),
    waves,
  };
}
