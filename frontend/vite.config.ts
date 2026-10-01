import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'document-worker-isolation',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.includes('/documents/document.worker.ts')) {
            response.setHeader(
              'Content-Security-Policy',
              "default-src 'none'; script-src 'self'; connect-src 'none'; worker-src 'none'",
            );

            response.setHeader('Cache-Control', 'no-store');
          }

          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.startsWith('/assets/document-parser-')) {
            response.setHeader(
              'Content-Security-Policy',
              "default-src 'none'; script-src 'none'; connect-src 'none'; worker-src 'none'",
            );

            response.setHeader('Cache-Control', 'no-store');
          }

          next();
        });
      },
    },
  ],
  worker: {
    format: 'iife',
    rollupOptions: { output: { entryFileNames: 'assets/document-parser-[hash].js' } },
  },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
