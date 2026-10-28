import { useEffect, useState } from 'react';
import { WallpaperDownload } from '../components/WallpaperDownload';
import { Button } from '@want-foundation/desyst-react';
import { initializePrivacy, saveCookiePreferences } from '../lib/privacy';
import type { Locale } from '../data/catalog';

export default function DownloadVideoPreview({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const [variant, setVariant] = useState<'desktop' | 'mobile'>('desktop');
  useEffect(() => { void initializePrivacy(); }, []);
  return <div className="grid max-w-lg gap-6">
    <h1>Download video preview</h1><p>Development fixture. Browser tests substitute every advertising response.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={() => setVariant('desktop')}>Desktop</Button><Button onClick={() => setVariant('mobile')}>Mobile</Button>
      <Button onClick={() => saveCookiePreferences({ analytics: false, advertising: false })}>Deny advertising</Button>
      <Button onClick={() => saveCookiePreferences({ analytics: false, advertising: true })}>Allow advertising</Button></div>
    <WallpaperDownload locale={locale} wallpaper="fixture" variant={variant} href={`/downloads/fixture-${variant}.png`} enabled={enabled} />
  </div>;
}
