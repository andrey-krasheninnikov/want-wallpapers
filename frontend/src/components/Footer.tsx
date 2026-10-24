import { Button } from '@/components/ui/button';
import { copy, localPath } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';
import type { ReactNode } from 'react';

export default function Footer({ locale, logo, advertisement }: { locale: Locale; logo: string; advertisement?: ReactNode }) {
  const ui = copy[locale];
  const links = [['privacy', ui.privacy], ['terms', ui.terms], ['cookies', ui.cookies], ['license', ui.license], ['contact', ui.contact]];
  return <footer className="site-footer">
    <div className="shell py-10 sm:py-12">
      <div className="footer-layout">
        <div><a href={localPath(locale)} className="inline-flex min-h-11 items-center gap-3 font-semibold"><img src={logo} alt="" width={28} height={28} />Want Wallpapers</a><p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{interfaceCopy[locale].free}</p><div className="mt-3 flex flex-col items-start"><a dir="ltr" href="mailto:wallpapers@want.foundation" className="inline-flex min-h-11 max-w-full items-center break-all py-2 text-sm text-link">wallpapers@want.foundation</a><a href="https://t.me/want_wallpapers" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center py-2 text-sm text-link">Telegram Channel</a><a href="https://github.com/andrey-krasheninnikov/want-wallpapers" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center py-2 text-sm text-link">{interfaceCopy[locale].githubProject}</a></div></div>
        <nav aria-label={interfaceCopy[locale].legal} className="grid content-start grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{links.map(([path, title]) => <Button key={path} asChild variant="ghost" className="footer-link"><a href={localPath(locale, `/${path}/`)}>{title}</a></Button>)}<Button asChild variant="ghost" className="footer-link"><a href={localPath(locale, '/cookies/')} data-cookie-settings data-astro-reload>{ui.cookieSettings}</a></Button><Button type="button" variant="ghost" className="footer-link" data-background-toggle data-pause-label={interfaceCopy[locale].pauseBackground} data-play-label={interfaceCopy[locale].playBackground} hidden>{interfaceCopy[locale].pauseBackground}</Button></nav>
        {advertisement}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">© 2026 Want Foundation</p>
    </div>
  </footer>;
}
