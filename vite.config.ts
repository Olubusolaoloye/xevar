import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
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
