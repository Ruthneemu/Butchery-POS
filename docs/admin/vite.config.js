import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    // Remove all rollupOptions for prop-types
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['prop-types'] // Ensures proper bundling
  }
});