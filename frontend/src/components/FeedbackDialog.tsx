import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@want-foundation/desyst-react';
import { FeedbackFields, useFeedbackForm } from './FeedbackForm';
import { copy } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';

export function mountFeedback(locale: Locale) {
  const host = document.getElementById('feedback-root') ?? document.body.appendChild(document.createElement('div'));
  let show: ((value: boolean) => void) | undefined;
  let trigger: HTMLElement | null = null;
  function FeedbackDialog() {
    const [open, setOpen] = useState(false);
    show = setOpen;
    const state = useFeedbackForm(locale);
    return <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="feedback-dialog glass-surface" closeLabel={interfaceCopy[locale].close} onCloseAutoFocus={(event) => {
        event.preventDefault();
        const fallback = document.querySelector<HTMLElement>('[data-menu-trigger]');
        (trigger?.isConnected && trigger.getClientRects().length ? trigger : fallback)?.focus({ preventScroll: true });
      }}>
        <DialogHeader><DialogTitle>{copy[locale].feedback}</DialogTitle><DialogDescription>{copy[locale].feedbackText}</DialogDescription></DialogHeader>
        <FeedbackFields locale={locale} state={state} />
      </DialogContent>
    </Dialog>;
  }
  const root = createRoot(host);
  // The launcher must be callable immediately after the lazy module resolves.
  return async (element: HTMLElement) => {
    trigger = element;
    if (!show) {
      const { flushSync } = await import('react-dom');
      flushSync(() => root.render(<FeedbackDialog />));
    }
    show?.(true);
  };
}
