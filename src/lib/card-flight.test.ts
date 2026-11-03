import { afterEach, describe, expect, it, vi } from 'vitest';

const row = { x: 20, y: 540, width: 335, height: 64 };
const card = { x: 20, y: 105, width: 335, height: 250 };

/*
 * The flight is module state, so each test gets a fresh copy of the module
 * rather than inheriting whatever the last one left in the air.
 */
async function fresh() {
  vi.resetModules();
  return import('@/lib/card-flight');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('card flight', () => {
  it('waits for the page to say where the card lands', async () => {
    const { launch, arrive, peekFlight } = await fresh();
    launch('nf', row, 12);
    expect(peekFlight()).toMatchObject({ id: 'nf', from: row, to: null, direction: 'out' });
    arrive('nf', card);
    expect(peekFlight()).toMatchObject({ to: card, toRadius: 24 });
  });

  it('ignores an arrival for a different document', async () => {
    const { launch, arrive, peekFlight } = await fresh();
    launch('nf', row, 12);
    arrive('other', card);
    expect(peekFlight()?.to).toBeNull();
  });

  it('clears once the card has landed, and only for that flight', async () => {
    const { launch, arrive, finish, peekFlight } = await fresh();
    launch('nf', row, 12);
    arrive('nf', card);
    const key = peekFlight()!.key;
    finish(key + 1);
    expect(peekFlight()).not.toBeNull();
    finish(key);
    expect(peekFlight()).toBeNull();
  });

  it('flies home to the row it came from, with the row’s corners', async () => {
    const { launch, flyHome, peekFlight } = await fresh();
    launch('nf', row, 12);
    expect(flyHome('nf', card)).toBe(true);
    expect(peekFlight()).toMatchObject({ from: card, to: row, toRadius: 12, direction: 'home' });
  });

  it('has nowhere to fly home to for a page that was not opened from a row', async () => {
    const { flyHome, peekFlight } = await fresh();
    expect(flyHome('deep-link', card)).toBe(false);
    expect(peekFlight()).toBeNull();
  });

  it('drops a flight whose page never reports its card', async () => {
    vi.useFakeTimers();
    const { launch, arrive, peekFlight } = await fresh();
    launch('nf', row, 12);
    vi.advanceTimersByTime(1000);
    expect(peekFlight()).toBeNull();
    arrive('nf', card);
    expect(peekFlight()).toBeNull();
  });
});
