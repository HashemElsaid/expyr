import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

/**
 * Turns assets/images/icon-v2.svg into every raster Expo asks for.
 *
 * Written down rather than done by hand because an icon is not one file. It is
 * the square one, the Android foreground which must sit inside a circle the
 * launcher crops to, a monochrome silhouette for themed icons, the splash mark,
 * and a favicon. Doing that by hand once means doing it wrong the second time,
 * when the reason for each size has been forgotten.
 *
 *   node scripts/build-icon.mjs          writes alongside the current icons
 *   node scripts/build-icon.mjs --apply  overwrites the ones in use
 *
 * Without --apply nothing that ships is touched, so this can be run to look at
 * the result before deciding anything.
 */

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SOURCE = join(ROOT, 'assets/images/icon-v2.svg');
const IMAGES = join(ROOT, 'assets/images');

const apply = process.argv.includes('--apply');
const suffix = apply ? '' : '.v2';

const svg = readFileSync(SOURCE);

/** The paper and the marks on it, without the green ground behind them. */
function foregroundOnly(source) {
  return Buffer.from(
    source.toString('utf8').replace('<rect width="1024" height="1024" fill="#1D4B39"/>', '')
  );
}

/**
 * Android crops an adaptive icon to a circle and animates it, so the artwork
 * has to live inside the middle two thirds. Scaling the sheet down inside a
 * transparent square is what leaves that margin.
 */
async function adaptiveForeground() {
  const inner = await sharp(foregroundOnly(svg), { density: 400 })
    .resize(660, 660, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: inner, gravity: 'centre' }])
    .png()
    .toBuffer();
}

const written = [];

async function write(name, buffer) {
  const path = join(IMAGES, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  written.push(`${name}  ${(buffer.length / 1024).toFixed(1)} KB`);
}

async function main() {
  // The one iOS shows. Square, opaque, no transparency: Apple rejects alpha.
  await write(
    `icon${suffix}.png`,
    await sharp(svg, { density: 400 }).resize(1024, 1024).flatten({ background: '#1D4B39' }).png().toBuffer()
  );

  await write(`android-icon-foreground${suffix}.png`, await adaptiveForeground());

  // Themed icons: a silhouette the launcher tints, so only coverage matters.
  await write(
    `android-icon-monochrome${suffix}.png`,
    await sharp(await adaptiveForeground()).greyscale().png().toBuffer()
  );

  // The splash mark sits on the splash colour, so it carries no ground either.
  for (const name of [`splash-icon${suffix}.png`, `splash-icon-dark${suffix}.png`]) {
    await write(
      name,
      await sharp(foregroundOnly(svg), { density: 400 })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    );
  }

  await write(
    `favicon${suffix}.png`,
    await sharp(svg, { density: 400 }).resize(48, 48).flatten({ background: '#1D4B39' }).png().toBuffer()
  );

  console.log(written.map((line) => `  ${line}`).join('\n'));
  console.log(
    apply
      ? '\nOverwrote the icons in use. A native rebuild is needed before any of it shows.'
      : '\nWritten beside the current icons, which are untouched. Pass --apply to replace them.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
