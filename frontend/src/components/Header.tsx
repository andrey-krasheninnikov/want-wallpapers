import { useState } from 'react';
import { Menu, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from '@/components/ui/navigation-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { copy, languageLabels, localPath } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';

export default function Header({ locale, path, logo }: { locale: Locale; path: string; logo: string }) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/collections/', title: ui.collections, active: path.startsWith('/collections/') },
    { href: '/search/', title: ui.search, active: path === '/search/' },
    { href: '/feedback/', title: ui.feedback, active: path === '/feedback/' },
  ];
  return <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-md">
    <div className="shell flex min-h-16 items-center justify-between gap-4 lg:min-h-20">
      <a href={localPath(locale)} aria-label="Want Wallpapers" className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg">
        <img src={logo} alt="" width={32} height={32} className="size-8" />
        <span className="text-xl font-bold tracking-tight">Want<span className="ml-1.5 hidden font-medium text-muted-foreground sm:inline">Wallpapers</span></span>
      </a>
      <NavigationMenu className="hidden lg:flex" aria-label={ui.menu}>
        <NavigationMenuList className="gap-2">{links.map((link) => <NavigationMenuItem key={link.href}>
          <NavigationMenuLink asChild active={link.active} className="min-h-11 justify-center px-4 text-sm"><a href={localPath(locale, link.href)} aria-current={link.active ? 'page' : undefined}>{link.title}</a></NavigationMenuLink>
        </NavigationMenuItem>)}</NavigationMenuList>
      </NavigationMenu>
      <div className="flex shrink-0 items-center gap-2">
        <Select value={locale} onValueChange={(value) => { window.location.href = localPath(value as Locale, path); }}>
          <SelectTrigger aria-label={text.language} className="h-11! w-auto min-w-24 gap-2 border-transparent bg-transparent shadow-none hover:bg-accent">
            <Globe className="size-4 text-muted-foreground" aria-hidden="true" /><SelectValue>{locale === 'zh-cn' ? '中文' : locale === 'pt-br' ? 'PT' : locale.toUpperCase()}</SelectValue>
          </SelectTrigger>
          <SelectContent>{Object.entries(languageLabels).map(([value, title]) => <SelectItem key={value} value={value} className="min-h-11">{title}</SelectItem>)}</SelectContent>
        </Select>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label={ui.menu}><Menu /></Button></SheetTrigger>
          <SheetContent closeLabel={text.close} className="w-full max-w-sm bg-card">
            <SheetHeader className="px-6 pt-8"><SheetTitle>{ui.menu}</SheetTitle><SheetDescription>Want Wallpapers</SheetDescription></SheetHeader>
            <nav className="grid gap-2 px-4" aria-label={ui.menu}>{links.map((link) => <Button key={link.href} asChild variant={link.active ? 'secondary' : 'ghost'} className="justify-start"><a href={localPath(locale, link.href)} aria-current={link.active ? 'page' : undefined} onClick={() => setOpen(false)}>{link.title}</a></Button>)}</nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
    <noscript><nav aria-label={ui.menu} className="shell flex flex-wrap gap-x-6 pb-4 lg:hidden">{links.map((link) => <a key={link.href} className="py-2 text-sm text-link" href={localPath(locale, link.href)}>{link.title}</a>)}</nav><div className="shell flex flex-wrap gap-4 pb-4">{Object.entries(languageLabels).map(([value, title]) => <a key={value} href={localPath(value as Locale, path)} lang={value}>{title}</a>)}</div></noscript>
  </header>;
}
