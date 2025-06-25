// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  base: './',
  build: {
    outDir: 'dist',
    // Remove all external/globals configuration
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['prop-types', 'react-csv'] // Ensure these are pre-bundled
  }
});