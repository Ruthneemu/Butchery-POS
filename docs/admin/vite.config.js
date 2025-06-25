import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['prop-types'], // Explicitly mark prop-types as external
    },
  },
  plugins: [react()],
});