/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DeepStateCore',
    },
  },
  test: {
    globals: true,
    include: ['**/__tests__/**'],
  },
});
