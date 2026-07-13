import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { searchIndexPlugin } from './plugins/search-index';
import { themeTokensPlugin } from './plugins/theme-tokens';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Reads the library's theme.css and emits public/theme-tokens.json — the
    // /theming reference table renders it, so it can never drift from the CSS.
    themeTokensPlugin({
      src: '../../packages/ui/src/styles/theme.css',
      out: 'public/theme-tokens.json',
    }),
    // Walks packages/ui/src with the TypeScript compiler API and emits
    // public/search-index.json — every exported component, hook, util and prop,
    // with its TSDoc. The Cmd-K palette fetches it lazily on first open.
    searchIndexPlugin({
      src: '../../packages/ui/src',
      out: 'public/search-index.json',
      routeBase: '#/c/',
      idOverrides: {
        // Sources whose docs card is filed under an id other than their folder.
        'lib/utils.ts': 'cn',
        'lib/format.ts': 'format',
        'lib/search.ts': 'fuzzy-list',
        'lib/highlight.tsx': 'fuzzy-list',
      },
    }),
  ],
  server: {
    // Allow ?raw imports of the library source (packages/ui/src) for the
    // "copy full source" IDE panel — it lives outside the docs app root.
    fs: { allow: ['../..'] },
  },
});
