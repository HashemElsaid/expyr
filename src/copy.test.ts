import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Two things that must never be in the source, both invisible in review.
 *
 * The em dash rule has been asked for twice. The first sweep was done by
 * reading screens and fixing what was noticed, which is exactly the method
 * that leaves some behind, and did. A sweep finds what somebody happens to
 * look at; this finds all of them, including the ones in a screen nobody has
 * opened yet.
 *
 * The objection is not typographic. An em dash in app copy reads as
 * machine-written, and an app about somebody's own paperwork cannot afford to
 * read as though nobody wrote it.
 *
 * Comments are exempt from that one on purpose: nothing in a comment ships to
 * a phone, and the prose here uses them deliberately. Control characters are
 * not exempt anywhere, because they are never intentional.
 */

const EM_DASH = '\u2014';

/**
 * Control characters that should never appear in source at all.
 *
 * None can be typed by accident and none are visible in an editor, a diff or a
 * review. They arrive when a file is written through a layer that interprets
 * escapes twice: a regex meant to hold a word boundary ends up holding a
 * literal backspace, and the pattern quietly stops matching anything.
 *
 * That happened three times in one afternoon. One of them sat in a passing
 * test for hours, asserting nothing while looking green, which is worse than a
 * failing test and much harder to notice.
 */
const INVISIBLES: { code: number; name: string }[] = [
  { code: 8, name: 'backspace, probably a mangled word-boundary escape' },
  { code: 11, name: 'vertical tab, probably a mangled escape' },
  { code: 12, name: 'form feed, probably a mangled escape' },
  { code: 0, name: 'NUL' },
];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    found.push(path);
  }
  return found;
}

/** Shipped copy only: comments blanked, line count preserved so hits report true lines. */
function shippedCopyOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => '\n'.repeat((block.match(/\n/g) ?? []).length))
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function tidy(path: string): string {
  return path.split('\\').join('/');
}

describe('what the app says on screen', () => {
  it('contains no em dashes anywhere', () => {
    const offences: string[] = [];

    for (const path of sourceFiles('src')) {
      if (path.includes('.test.')) continue;
      const lines = shippedCopyOf(readFileSync(path, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (line.includes(EM_DASH)) offences.push(`${tidy(path)}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(offences, `Use a full stop, a comma, or a colon:\n${offences.join('\n')}`).toEqual([]);
  });

  /*
   * Proves the scanner can actually see one. Without this the test passes just
   * as happily when the detection is broken as when the copy is clean, which
   * is the failure mode a guard like this dies of.
   */
  it('would notice an em dash if one came back', () => {
    expect(shippedCopyOf(`const s = 'a ${EM_DASH} b';`).includes(EM_DASH)).toBe(true);
  });

  it('ignores em dashes in comments, which never reach a phone', () => {
    expect(shippedCopyOf(`/* a ${EM_DASH} b */\nconst s = 'clean';`).includes(EM_DASH)).toBe(false);
  });
});

describe('what is in the source but cannot be seen', () => {
  /*
   * Tests are included here, unlike the em dash rule. A control character in a
   * test is the more dangerous of the two: it turns an assertion into one that
   * cannot fail, and the suite goes on reporting success.
   */
  it('contains no invisible control characters', () => {
    const offences: string[] = [];

    for (const path of sourceFiles('src')) {
      const source = readFileSync(path, 'utf8');
      for (const { code, name } of INVISIBLES) {
        const at = source.indexOf(String.fromCharCode(code));
        if (at !== -1) offences.push(`${tidy(path)}:${lineOf(source, at)}  ${name}`);
      }
    }

    expect(offences, offences.join('\n')).toEqual([]);
  });

  it('would notice one if it came back', () => {
    const planted = `const re = /a${String.fromCharCode(8)}b/;`;
    const found = INVISIBLES.some(({ code }) => planted.includes(String.fromCharCode(code)));
    expect(found).toBe(true);
  });

  it('does not mistake ordinary whitespace for one', () => {
    const ordinary = 'const s = "a\\tb";\r\nconst t = 3;\n';
    const found = INVISIBLES.some(({ code }) => ordinary.includes(String.fromCharCode(code)));
    expect(found).toBe(false);
  });
});
