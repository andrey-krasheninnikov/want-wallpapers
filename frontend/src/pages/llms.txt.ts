import type { APIRoute } from 'astro';
import { collections, locales, wallpapers } from '../data/catalog';
import { localPath, copy } from '../data/copy';
import { legalPage } from '../data/legal';

export const GET: APIRoute = ({ site }) => {
  const link = (title: string, path: string, description: string) => `- [${title}](${new URL(path, site)}): ${description}`;
  const license = legalPage('en', 'license');
  const lines = ['# Want Wallpapers', '', '> A public gallery of desktop and mobile wallpapers with original PNG downloads.', '',
    '## Usage license', '', license.intro, ...license.sections.flatMap((section) => section.paragraphs), ''];
  for (const locale of locales) {
    lines.push(`## ${locale}`, '', link(copy[locale].home, localPath(locale), copy[locale].heroText),
      link(copy[locale].collections, localPath(locale, '/collections/'), copy[locale].allCollectionsText),
      link(copy[locale].license, localPath(locale, '/license/'), legalPage(locale, 'license').intro),
      ...collections.map((collection) => link(collection.title[locale], localPath(locale, `/collections/${collection.slug}/`), collection.description[locale])),
      ...wallpapers.map((wallpaper) => link(wallpaper.title[locale], localPath(locale, `/wallpapers/${wallpaper.slug}/`), wallpaper.description[locale])), '');
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
