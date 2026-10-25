import react from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The list and demo data are imported from the Next app's lib/ folder (one level up),
// so the same code runs on both setups.
export default defineConfig({
  plugins: [
    react(),
    rsc({
      entries: {
        rsc: './src/entry.rsc.tsx',
        ssr: './src/entry.ssr.tsx',
        client: './src/entry.browser.tsx',
      },
    }),
  ],
  resolve: {
    // `@/…` as in the Next app, for the shared client list in ../app.
    alias: { '@': fileURLToPath(new URL('..', import.meta.url)) },
    // Files from ../ would otherwise resolve these from the Next app's node_modules,
    // giving two copies (and two React Query contexts). Use this app's copy only.
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  // React Query's "use client" files (HydrationBoundary) are loaded as client references
  // from their own path; pre-bundling it would give the client list a second copy.
  optimizeDeps: { exclude: ['@tanstack/react-query'] },
  server: { fs: { allow: ['..'] } },
});
