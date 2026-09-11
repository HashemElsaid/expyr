import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What may live under `src/app`, which is not the same question as what may
 * live anywhere else in this repository.
 *
 * expo-router builds the router out of that directory. Every file in it is a
 * route, which means Metro bundles every file in it into the app that runs on
 * the phone. Nothing there may import anything a phone does not have.
 *
 * This exists because a test file was written there. `src/app/paywall.test.ts`
 * read two screens as text to prove the paywall never opens on launch, which
 * was a good test in a fatal place: `node:fs` went into the bundle, Metro
 * could not resolve it, and the next person to open Expo Go got a red screen
 * on launch. Every test still passed, because vitest does not care where a
 * file lives, and the 1.0.1 build would have carried it to the App Store.
 *
 * The repository's convention is that a test sits beside the thing it tests,
 * and that convention is right everywhere except here. So the rule is written
 * down as a test rather than as a habit, and it fails in the same `vitest run`
 * that would otherwise have said everything was fine.
 *
 * A Metro blockList would also stop the bundle breaking, and is the obvious
 * second line. It is deliberately not here: adding a bundler config to fix a
 * bundler failure introduces a new way to break the build, and this catches
 * the mistake at the moment it is made rather than at the moment it ships.
 */

const ROUTES = 'src/app';

function everyFileUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? everyFileUnder(path) : [path];
  });
}

describe('everything under src/app ships to the phone', () => {
  const files = everyFileUnder(ROUTES);

  it('has files to look at, so a broken walk cannot pass as agreement', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  /*
   * The failure that happened. A test is the likeliest non-route anybody adds
   * here, because every other directory in this repository asks for one.
   */
  it('holds no test files, however much the convention elsewhere wants one', () => {
    const tests = files.filter((path) => /\.(test|spec)\.[jt]sx?$/.test(path));
    expect(
      tests,
      `${tests.join(', ')} would be bundled as a route. Tests about a screen live in src/.`
    ).toEqual([]);
  });

  /*
   * The general rule behind it. Node's own modules are the ones that read as
   * ordinary imports and are simply absent on a phone, so they fail at bundle
   * time rather than at review.
   */
  it('imports nothing that only exists on a computer', () => {
    const offenders = files
      .filter((path) => /\.[jt]sx?$/.test(path))
      .filter((path) => /from '(node:|fs|path|crypto|os|child_process)'/.test(readFileSync(path, 'utf8')));

    expect(
      offenders,
      `${offenders.join(', ')} imports a Node module into the phone's bundle.`
    ).toEqual([]);
  });
});
