/**
 * The stretch of time the bar under the date actually draws.
 *
 * It drew the document's whole validity, which for an Emirates ID is 730 days.
 * With nineteen days left that put today at 97.4% and the three reminder ticks
 * at 95.9%, 99.0% and 99.9% — everything worth looking at inside the last
 * twelve pixels, and the other 96% of the width spent on time nobody can do
 * anything about. The line was not badly drawn, it was drawing the wrong thing.
 *
 * So there are two scales, and the bar says in words which one it is on. Near
 * the day it draws the run-up, where the reminders have room to sit apart from
 * each other. Far from it, it draws the whole life, where a proportion is the
 * only thing worth knowing and the reminder dates belong in the line of text
 * underneath, which is where they already are.
 */

export type RunwayScale = 'runUp' | 'life';

export type Runway = {
  scale: RunwayScale;
  /** How many days the track spans, left edge to expiry. */
  span: number;
  /** Where today sits: 0 at the left edge, 1 on the day itself. */
  now: number;
  /**
   * Where each reminder still to come sits, in the order they will arrive.
   *
   * Only the ones ahead. A reminder already sent was drawn as a slot punched
   * through the filled part in the page colour, and a hairline gap in a solid
   * bar is indistinguishable from the screen tearing. It also earned its place
   * least: what a person can act on is that they will be told twice more, and
   * the dates underneath already carry the sent ones with a line through them.
   *
   * Always empty on the life scale, where they land on top of one another.
   */
  reminders: number[];
};

/**
 * How far back the run-up reaches: three times the earliest warning.
 *
 * Which means the first reminder always lands two thirds along, on every
 * document, whether it warns at 180 days like a passport or at 14 like a
 * subscription. The same mark in the same place is a thing somebody can learn
 * once; a mark whose position depends on the document type is not.
 *
 * The floor stops a single one-day reminder producing a three-day track.
 */
export function runUpSpan(leadDays: readonly number[]): number {
  const earliest = leadDays.length > 0 ? Math.max(...leadDays) : 0;
  return Math.max(earliest * 3, 21);
}

export function buildRunway(
  days: number,
  leadDays: readonly number[],
  period: number | undefined
): Runway | null {
  const span = runUpSpan(leadDays);

  if (days <= span) {
    return {
      scale: 'runUp',
      span,
      now: clamp((span - days) / span),
      reminders: [...leadDays]
        // lead < days is the same as "this reminder has not fired yet".
        .filter((lead) => lead >= 0 && lead <= span && lead < days)
        .sort((a, b) => b - a)
        .map((lead) => (span - lead) / span),
    };
  }

  /*
   * Further out than the run-up, and no idea how long this kind of thing lasts
   * — a warranty, or anything filed as "other". A bar needs two ends and only
   * one of them is known, so there is no bar.
   */
  if (period === undefined || period <= span) return null;

  return {
    scale: 'life',
    span: period,
    now: clamp((period - days) / period),
    reminders: [],
  };
}

/**
 * What the left-hand end means, in words, because a track whose scale is a
 * secret is the thing that was wrong before. "Last 3 months" and "Full 2
 * years" both say what the width stands for without anybody counting.
 */
export function spanLabel(runway: Runway): string {
  return `${runway.scale === 'life' ? 'Full' : 'Last'} ${term(runway.span)}`;
}

function term(days: number): string {
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;

  const months = Math.round(days / 30);
  if (months >= 24) return plural(Math.round(days / 365), 'year');
  // Two years reads better than twenty-four months, and so does one year.
  if (months % 12 === 0) return plural(months / 12, 'year');
  return `${months} months`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}
