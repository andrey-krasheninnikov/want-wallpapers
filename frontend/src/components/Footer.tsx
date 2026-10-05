import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { copy, localPath } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';

export default function Footer({ locale, logo }: { locale: Locale; logo: string }) {
  const ui = copy[locale];
  const links = [['privacy', ui.privacy], ['terms', ui.terms], ['cookies', ui.cookies], ['license', ui.license], ['contact', ui.contact]];
  return <footer className="mt-20 border-t border-border/70 sm:mt-24">
    <div className="shell py-10 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div><a href={localPath(locale)} className="inline-flex min-h-11 items-center gap-3 font-semibold"><img src={logo} alt="" width={28} height={28} />Want Wallpapers</a><p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{interfaceCopy[locale].free}</p><div className="mt-3 flex flex-col items-start"><a href="mailto:wallpapers@want.foundation" className="inline-flex min-h-11 items-center py-2 text-sm text-link">wallpapers@want.foundation</a><a href="https://t.me/want_wallpapers" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center py-2 text-sm text-link">Telegram Want Wallpapers</a></div></div>
        <nav aria-label={interfaceCopy[locale].legal} className="grid content-start grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{links.map(([path, title]) => <Button key={path} asChild variant="ghost" className="footer-link"><a href={localPath(locale, `/${path}/`)}>{title}</a></Button>)}<Button asChild variant="ghost" className="footer-link"><a href={localPath(locale, '/cookies/')} data-cookie-settings>{ui.cookieSettings}</a></Button></nav>
      </div>
      <Separator className="my-8" /><p className="text-sm text-muted-foreground">© 2026 Want Foundation</p>
    </div>
  </footer>;
}
