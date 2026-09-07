import { describe, expect, it } from 'vitest';

import { buildRunway, runUpSpan, spanLabel } from '@/domain/runway';

/** The Emirates ID from the screenshot: warns at 30, 7 and 1 days. */
const LEADS = [30, 7, 1];
/** Two years, from RENEWAL_PERIOD_DAYS. */
const EMIRATES_ID = 730;

describe('runUpSpan', () => {
  /*
   * Three times the earliest warning, so the first reminder lands two thirds
   * along whatever the document is. A mark in the same place every time can be
   * learned once; a mark that moves with the document type cannot.
   */
  it('puts the first reminder two thirds along, on any document', () => {
    for (const leads of [[30, 7, 1], [60, 30, 7], [180, 90, 30], [14, 3]]) {
      const span = runUpSpan(leads);
      const first = (span - Math.max(...leads)) / span;
      expect(first).toBeCloseTo(2 / 3, 10);
    }
  });

  it('does not let a single one-day reminder make a three-day track', () => {
    expect(runUpSpan([1])).toBe(21);
  });

  it('survives a document with no reminders at all', () => {
    expect(runUpSpan([])).toBe(21);
  });
});

describe('buildRunway on the run-up scale', () => {
  /*
   * The whole point. On the old full-validity scale these three sat at 95.9%,
   * 99.0% and 99.9% — inside twelve pixels of each other.
   */
  it('gives the reminders room to sit apart', () => {
    const runway = buildRunway(19, LEADS, EMIRATES_ID);

    expect(runway?.scale).toBe('runUp');
    expect(runway?.span).toBe(90);
    expect(runway?.reminders.map((r) => Math.round(r * 1000) / 10)).toEqual([66.7, 92.2, 98.9]);

    const gaps = runway!.reminders.slice(1).map((r, i) => r - runway!.reminders[i]);
    for (const gap of gaps) expect(gap).toBeGreaterThan(0.05);
  });

  it('puts today where today is', () => {
    // 19 of the last 90 days left, so 71 of them are behind you.
    expect(buildRunway(19, LEADS, EMIRATES_ID)?.now).toBeCloseTo(71 / 90, 10);
    expect(buildRunway(64, LEADS, 365)?.now).toBeCloseTo(26 / 90, 10);
  });

  it('reads the reminders in the order they arrive', () => {
    const runway = buildRunway(19, [1, 30, 7], EMIRATES_ID);
    const positions = runway!.reminders;
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  /* Something already past is at the end of its track, not beyond it. */
  it('pins an expired document to the far end', () => {
    expect(buildRunway(-4, LEADS, EMIRATES_ID)?.now).toBe(1);
    expect(buildRunway(-211, LEADS, EMIRATES_ID)?.now).toBe(1);
  });

  it('draws a run-up even for a type with no known validity', () => {
    const runway = buildRunway(19, LEADS, undefined);
    expect(runway?.scale).toBe('runUp');
    expect(runway?.reminders).toHaveLength(3);
  });

  /*
   * A subscription warns at 14 and 3 days, so its run-up is six weeks rather
   * than three months. Ninety days of track for a monthly charge would be
   * mostly empty.
   */
  it('tightens the track for something that warns late', () => {
    const runway = buildRunway(9, [14, 3], 365);
    expect(runway?.span).toBe(42);
    expect(spanLabel(runway!)).toBe('Last 6 weeks');
  });
});

describe('buildRunway on the life scale', () => {
  it('switches to the whole validity once the run-up is behind you', () => {
    const runway = buildRunway(402, [30, 7, 1], 3650);
    expect(runway?.scale).toBe('life');
    expect(runway?.span).toBe(3650);
    expect(runway?.now).toBeCloseTo((3650 - 402) / 3650, 10);
  });

  /*
   * The reminders are deliberately dropped out here. At 3650 days of track,
   * 30 / 7 / 1 land within a pixel of the right-hand end, which is exactly the
   * unreadable mess this replaced. The dates are printed underneath instead.
   */
  it('drops the reminders rather than crowding them', () => {
    expect(buildRunway(402, [30, 7, 1], 3650)?.reminders).toEqual([]);
  });

  it('draws nothing at all when the validity is unknown and the day is far off', () => {
    expect(buildRunway(402, [30, 7, 1], undefined)).toBeNull();
  });

  it('never runs past either end', () => {
    expect(buildRunway(900, LEADS, EMIRATES_ID)?.now).toBe(0);
  });
});

describe('spanLabel', () => {
  /* The scale was a secret before; now the left end says what it is. */
  it('says what the width stands for', () => {
    expect(spanLabel(buildRunway(19, [30, 7, 1], 730)!)).toBe('Last 3 months');
    expect(spanLabel(buildRunway(100, [60, 30, 7], 730)!)).toBe('Last 6 months');
    expect(spanLabel(buildRunway(300, [180, 90, 30], 3650)!)).toBe('Last 18 months');
    expect(spanLabel(buildRunway(402, [30, 7, 1], 3650)!)).toBe('Full 10 years');
  });

  /* Two years reads better than twenty-four months, and so does one year. */
  it('says years where a person would say years', () => {
    expect(spanLabel(buildRunway(400, [30, 7, 1], 730)!)).toBe('Full 2 years');
    expect(spanLabel(buildRunway(200, [30, 7, 1], 365)!)).toBe('Full 1 year');
    expect(spanLabel(buildRunway(700, [30, 7, 1], 1825)!)).toBe('Full 5 years');
  });
});
