import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { searchIndexPlugin } from './plugins/search-index';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
