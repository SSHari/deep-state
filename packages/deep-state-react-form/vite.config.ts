/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'DeepStateReact',
    },
    rollupOptions: {
      external: ['react', '@deep-state/core'],
      output: {
        globals: {
          react: 'React',
          '@deep-state/core': 'DeepState',
        },
      },
    },
  },
  test: {
    globals: true,
    include: ['**/__tests__/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test.setup.ts'],
  },
});
