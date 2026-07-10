import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const src = fileURLToPath(new URL('./src', import.meta.url));

// Library build. Output is ESM-only with `preserveModules` so every component
// stays in its own file — a consumer's bundler can drop anything it never
// imports (true tree-shaking). React, the icon set and the class utilities are
// left external so they are not duplicated into the consumer's graph.
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], entryRoot: 'src', tsconfigPath: './tsconfig.json' }),
  ],
  build: {
    lib: {
      entry: `${src}/index.ts`,
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-dom/client',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'fuse.js',
        '@tanstack/react-virtual',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
