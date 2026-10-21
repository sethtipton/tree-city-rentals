import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const source = 'property-images/processed';
const target = 'property-images/responsive';
await mkdir(target, { recursive: true });
for (const name of (await readdir(source)).filter(name => name.endsWith('.webp'))) {
  for (const width of [480, 768, 1024]) {
    const input = join(source, name);
    const output = join(target, name.replace('.webp', `-${width}.webp`));
    // Unchanged sources keep reproducible output and avoid repeated encoding.
    try { if ((await stat(output)).mtimeMs >= (await stat(input)).mtimeMs) continue; } catch { /* First build. */ }
    await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(output);
  }
}
console.info('Responsive property images generated at 480, 768 and 1024 pixels.');
