import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/prop-types/, /node_modules/]
    }
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['prop-types']
  }
});