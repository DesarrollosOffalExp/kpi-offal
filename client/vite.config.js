import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El backend del tablero corre en :3006. En dev, /api y /health van hacia allá.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/api': 'http://localhost:3006',
      '/health': 'http://localhost:3006',
    },
  },
});
