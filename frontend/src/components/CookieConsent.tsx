import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { copy, localPath } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import { getCookiePreferences, initializePrivacy, readCookiePreferences, saveCookiePreferences, type CookiePreferences } from '@/lib/privacy';
import type { Locale } from '@/data/catalog';

export default function CookieConsent({ locale, analyticsAvailable }: { locale: Locale; analyticsAvailable: boolean }) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<CookiePreferences | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>({ analytics: false, advertising: false });
  const dirty = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  function openSettings() {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dirty.current = false;
    setDraft(getCookiePreferences());
    setOpen(true);
  }
  useEffect(() => {
    const update = () => {
      setChoice(readCookiePreferences());
      if (!dirty.current) setDraft(getCookiePreferences());
    };
    update(); setReady(true);
    window.addEventListener('want:privacy', update);
    void initializePrivacy();
    const settings = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-cookie-settings]')) return;
      event.preventDefault(); openSettings();
    };
    document.addEventListener('click', settings);
    return () => {
      document.removeEventListener('click', settings);
      window.removeEventListener('want:privacy', update);
    };
  }, []);
  function save(value: CookiePreferences) {
    saveCookiePreferences(value); setOpen(false);
  }
  function change(key: keyof CookiePreferences, value: boolean) {
    dirty.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
  }
  return <>
    {ready && !choice && !open && <section className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-3xl" aria-label={ui.cookieSettings}>
      <Card className="cookie-panel gap-0 border-input bg-card py-0 shadow-lg"><CardContent className="grid gap-4 p-4 sm:p-6">
        <div><h2 className="text-lg font-semibold">{ui.cookieTitle}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ui.cookieText} <a className="text-link underline" href={localPath(locale, '/cookies/')}>{ui.cookies}</a></p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => save({ analytics: false, advertising: false })}>{ui.essentialOnly}</Button><Button onClick={() => save({ analytics: true, advertising: true })}>{ui.acceptAll}</Button><Button variant="ghost" onClick={openSettings}>{ui.cookieSettings}</Button></div>
      </CardContent></Card>
    </section>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent closeLabel={text.close} onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('[data-cookie-settings]');
        target?.focus();
      }}>
        <DialogHeader className="pr-8 text-left"><DialogTitle>{ui.cookieSettings}</DialogTitle><DialogDescription>{text.settings}</DialogDescription></DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="flex items-start justify-between gap-4"><div><Label htmlFor="essential-storage">{text.necessary}</Label><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text.necessaryHint}</p></div><Switch id="essential-storage" checked disabled className="mt-1 shrink-0" aria-label={text.necessary} /></div>
          <Separator />
          <div className="flex items-start justify-between gap-4"><div><Label htmlFor="analytics-storage">{ui.analyticsLabel}</Label><p id="analytics-hint" className="mt-2 text-sm leading-relaxed text-muted-foreground">{analyticsAvailable ? text.analyticsHint : text.unavailableAnalytics}</p></div><Switch id="analytics-storage" checked={draft.analytics} onCheckedChange={(value) => change('analytics', value)} aria-describedby="analytics-hint" className="mt-1 shrink-0" /></div>
          <Separator />
          <div className="flex items-start justify-between gap-4"><div><Label htmlFor="advertising-storage">{ui.advertisingLabel}</Label><p id="advertising-hint" className="mt-2 text-sm leading-relaxed text-muted-foreground">{text.advertisingHint}</p></div><Switch id="advertising-storage" checked={draft.advertising} onCheckedChange={(value) => change('advertising', value)} aria-describedby="advertising-hint" className="mt-1 shrink-0" /></div>
          <a href={localPath(locale, '/cookies/')} className="w-fit text-sm text-link underline">{ui.cookies}</a>
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => save({ analytics: false, advertising: false })}>{ui.essentialOnly}</Button><Button onClick={() => save(draft)}>{text.save}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
