import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  /**
   * Where the app's assets are served from.
   *
   * Netlify and Vercel serve at the domain root, so the default "/" is right.
   * GitHub Pages serves a project site from /<repo>/, and without a matching
   * base every script and stylesheet resolves to the wrong path and 404s.
   */
  base: process.env.VITE_BASE || '/',

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Recharts and its d3 dependencies dominate the bundle; splitting them out
    // keeps the app chunk small and lets the vendor chunk cache across deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },

  server: {
    // File watching is disabled in hosted agent environments to stop the page
    // flickering while files are being written.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
