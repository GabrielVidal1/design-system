// Copy the raw stylesheet sources into dist/ untouched. They are shipped as
// source (not bundled through JS) so a consumer imports exactly the CSS they
// want — `@gabvdl/ui/theme.css` for the design tokens, `image-viewer.css` for
// the overlay, or `styles.css` for both — and Tailwind processes the `@theme`
// blocks in the consumer's own build.
import { copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/copy-css.mjs → the package root is one level up from scripts/.
const root = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(root, 'src', 'styles');
const outDir = join(root, 'dist');

await mkdir(outDir, { recursive: true });
for (const file of await readdir(srcDir)) {
  if (file.endsWith('.css')) {
    await copyFile(join(srcDir, file), join(outDir, file));
    console.log(`  copied styles/${file} -> dist/${file}`);
  }
}
