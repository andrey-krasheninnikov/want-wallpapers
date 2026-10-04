import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://wallpapers.want.foundation',
  integrations: [react(), sitemap({ filter: (page) => !page.endsWith('/404/') && !new URL(page).pathname.startsWith('/admin/') })],
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 }, server: { proxy: { '/api': 'http://127.0.0.1:8080' } } },
  output: 'static',
});
