import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev-only proxy: browsers block direct localhost->restcountries calls when the API's
    // error responses omit CORS headers. Routing through Vite (same-origin) sidesteps it
    // while developing. Production calls the CORS-enabled endpoints directly (see API_BASE).
    proxy: {
      '/rc': {
        target: 'https://restcountries.com/v3.1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rc/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
