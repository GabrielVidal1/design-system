import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow ?raw imports of the library source (packages/ui/src) for the
    // "copy full source" IDE panel — it lives outside the docs app root.
    fs: { allow: ['../..'] },
  },
});
