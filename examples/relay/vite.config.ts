import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import relay from 'vite-plugin-relay';

export default defineConfig({
  plugins: [relay, react()],
  server: {
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});
