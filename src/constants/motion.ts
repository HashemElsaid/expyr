import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * The five springs everything in Expyr moves on.
 *
 * Springs rather than durations, the way iOS itself animates: a spring can be
 * caught mid-flight by the next tap and carries on from wherever it was,
 * where a timed curve has to finish or jump. Nothing in the app waits for an
 * animation to end before it accepts the next touch.
 *
 * Five and no more, each with one job, so the same kind of thing always moves
 * the same way. The values are the ones the approved prototype was tuned on.
 */
export const Springs = {
  /** Screens, sheets, pages and going back. Arrives without a bounce. */
  settle: { stiffness: 300, damping: 32, mass: 1 },
  /** Cards, numbers and bars: a little overshoot, so they land. */
  lift: { stiffness: 220, damping: 22, mass: 1 },
  /** Selection and switches, which should feel quick and exact. */
  glide: { stiffness: 420, damping: 38, mass: 1 },
  /** Anything under a finger. */
  press: { stiffness: 520, damping: 30, mass: 1 },
  /** The saved stamp, once, with a real bounce. */
  stamp: { stiffness: 380, damping: 16, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

/** How far a card gives under a finger. */
export const PRESSED_SCALE = 0.982;
