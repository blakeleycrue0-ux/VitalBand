import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        product: resolve(__dirname, 'product.html'),
        success: resolve(__dirname, 'success.html'),
        track: resolve(__dirname, 'track.html'),
        cancel: resolve(__dirname, 'cancel.html'),
        notFound: resolve(__dirname, '404.html')
      }
    }
  }
});
