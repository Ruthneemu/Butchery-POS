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
          'prop-types': 'PropTypes' // This matches the global variable name
        }
      }
    }
  },
  plugins: [react()]
});