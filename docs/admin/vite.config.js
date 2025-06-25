// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['prop-types'],
      output: {
        globals: {
          'prop-types': 'PropTypes' // Must match CDN global
        }
      }
    }
  },
  plugins: [react()]
});