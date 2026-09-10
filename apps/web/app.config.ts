// app.config.ts
import { defineConfig } from '@vinxi/config'

export default defineConfig({
  server: {
    preset: 'vite',
  },
  routes: [
    {
      name: 'public',
      mode: 'static',
      base: '/',
      dir: './public',
    },
    {
      name: 'client',
      mode: 'spa',
      handler: './app/entry-client.tsx',
      target: 'browser',
      base: '/',
    },
    {
      name: 'ssr',
      mode: 'handler',
      handler: './app/entry-server.tsx',
      target: 'server',
      base: '/',
    },
  ],
})