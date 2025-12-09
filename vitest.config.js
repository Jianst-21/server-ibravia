// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Penting: Set environment ke 'node' untuk backend
    environment: 'node', 
    coverage: {
      provider: 'v8', // Disarankan pakai 'v8' bawaan vitest (lebih cepat dari istanbul)
      reporter: ['text', 'html'],
    },
  },
});