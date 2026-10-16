import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Compact build config that externalizes React/Lucide to esm.sh CDN so the entire bundle is ~15-20KB
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'],
    },
  },
});
