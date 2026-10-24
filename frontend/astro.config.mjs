import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://wallpapers.want.foundation',
  integrations: [react(), {
    name: 'ui-kit-preview',
    hooks: { 'astro:config:setup': ({ command, injectRoute }) => {
      if (command === 'dev') {
        injectRoute({ pattern: '/ui-kit/', entrypoint: './src/dev/ui-kit.astro' });
        injectRoute({ pattern: '/ui-kit/download-video/', entrypoint: './src/dev/download-video.astro' });
      }
    } },
  }, sitemap({ filter: (page) => !new URL(page).pathname.endsWith('/404/') && !new URL(page).pathname.endsWith('/search/') && !new URL(page).pathname.startsWith('/admin/') })],
  vite: { resolve: { alias: { 'three/examples/jsm/libs/meshopt_decoder.module.js': new URL('./src/lib/uncompressed-model.ts', import.meta.url).pathname } }, plugins: [tailwindcss()], build: { assetsInlineLimit: 0 }, server: { proxy: { '/api': 'http://127.0.0.1:8080' } } },
  devToolbar: { enabled: false },
  output: 'static',
});
