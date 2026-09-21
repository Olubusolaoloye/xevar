import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  /**
   * The build's identity, baked in at compile time.
   *
   * The running app compares this against a version file fetched from the
   * server to notice it is out of date. CI supplies the commit SHA; a local
   * build just says "dev".
   */
  define: {
    __BUILD_ID__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 8) ?? 'dev',
    ),
  },

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
    // The charting library is split out so it caches across deploys
    // independently of the app chunk, which changes on every release.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['lightweight-charts'],
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
