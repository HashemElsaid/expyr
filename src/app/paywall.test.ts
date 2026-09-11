import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Where the paywall may be opened from, which is a business rule rather than a
 * detail of the screen.
 *
 * `business/MONEY.md` settles freemium over a hard paywall and then says the
 * model lives or dies on where the gate sits: it fires at the sixth item, the
 * eleventh scan, a subscription import that overflows, and from Settings. Every
 * one of those is somebody who has just watched the app work.
 *
 * What must never happen is the gate on launch. It would turn each of those
 * four moments into an ambush before the app has done anything, and it is
 * precisely the change somebody makes later in good faith, chasing a
 * conversion rate, without reading the document that ruled it out.
 *
 * Read as text because the alternative is rendering the whole app. A guard
 * this blunt cannot prove the rule holds; it can only fail loudly when the
 * likeliest way of breaking it is attempted.
 */
describe('the paywall never opens on launch', () => {
  const ON_LAUNCH = ['src/app/_layout.tsx', 'src/app/onboarding.tsx'];

  it.each(ON_LAUNCH)('%s does not navigate to it', (path) => {
    expect(readFileSync(path, 'utf8')).not.toContain('/paywall');
  });
});
