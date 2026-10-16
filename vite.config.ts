import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build also works under a GitHub Pages subpath.
  base: './',
  build: {
    // Phaser is one large module; keep the build quiet about it.
    chunkSizeWarningLimit: 1600,
  },
});
