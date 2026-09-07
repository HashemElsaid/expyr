import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The em dash rule, enforced rather than remembered.
 *
 * It has been asked for twice. The first sweep was done by reading screens and
 * fixing what was noticed, which is exactly the method that leaves some behind
 * — and did. A sweep finds what somebody happens to look at; this finds all of
 * them, including the ones in a screen nobody has opened yet.
 *
 * The objection is not typographic. An em dash in app copy reads as
 * machine-written, and an app about somebody's own paperwork cannot afford to
 * read as though nobody wrote it.
 *
 * Comments are exempt on purpose. Nothing in this file ships to a phone, and
 * the codebase's prose uses them deliberately.
 */

const EM_DASH = '—';

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || entry.includes('.test.')) continue;
    found.push(path);
  }
  return found;
}

/**
 * Blanks out comments while keeping the line count, so a hit still reports the
 * line it is actually on.
 */
function shippedCopyOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => '\n'.repeat((block.match(/\n/g) ?? []).length))
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('what the app says on screen', () => {
  it('contains no em dashes anywhere', () => {
    const offences: string[] = [];

    for (const path of sourceFiles('src')) {
      const lines = shippedCopyOf(readFileSync(path, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (line.includes(EM_DASH)) {
          offences.push(`${path.replace(/\\/g, '/')}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(offences, `Use a full stop, a comma, or a colon:\n${offences.join('\n')}`).toEqual([]);
  });

  /*
   * Proves the scanner can actually see one. Without this the test passes just
   * as happily when the detection is broken as when the copy is clean, which
   * is the failure mode a guard like this dies of.
   */
  it('would notice one if it came back', () => {
    const planted = shippedCopyOf(`const s = 'a ${EM_DASH} b';`);
    expect(planted.includes(EM_DASH)).toBe(true);
  });

  it('ignores em dashes in comments, which never reach a phone', () => {
    const commented = shippedCopyOf(`/* a ${EM_DASH} b */\nconst s = 'clean';`);
    expect(commented.includes(EM_DASH)).toBe(false);
  });
});
