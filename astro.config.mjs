import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://want-wallpapers.web.app',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  output: 'static',
});
