import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://want-wallpapers.web.app',
  integrations: [react(), sitemap({ filter: (page) => !page.endsWith('/404/') })],
  vite: { plugins: [tailwindcss()] },
  output: 'static',
});
