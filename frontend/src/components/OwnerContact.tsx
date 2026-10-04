import { Button } from '@/components/ui/button';
import { copy } from '@/data/copy';
import type { Locale } from '@/data/catalog';

export default function OwnerContact({ locale }: { locale: Locale }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-owner-contact>
    <span className="font-semibold text-foreground">{copy[locale].owner}</span>
    <div className="flex flex-wrap gap-1">
      <Button asChild variant="link" className="h-auto px-3 py-2"><a href="https://t.me/andrey_krasheninnikov" target="_blank" rel="noopener noreferrer" aria-label="Telegram Andrey Krasheninnikov">Telegram</a></Button>
      <Button asChild variant="link" className="h-auto px-3 py-2"><a href="https://t.me/want_foundation" target="_blank" rel="noopener noreferrer" aria-label="Telegram Want Foundation">Want Foundation</a></Button>
      <Button asChild variant="link" className="h-auto px-3 py-2"><a href="https://github.com/andrey-krasheninnikov" target="_blank" rel="noopener noreferrer" aria-label="GitHub Andrey Krasheninnikov">GitHub</a></Button>
    </div>
  </div>;
}
