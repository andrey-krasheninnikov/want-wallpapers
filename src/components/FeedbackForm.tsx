import { useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { copy } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import { useRegion } from '@/lib/use-region';
import type { Locale } from '@/data/catalog';

export default function FeedbackForm({ locale }: { locale: Locale }) {
  const ui = copy[locale];
  const region = useRegion();
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!topic.trim() || message.trim().length < 5) { setError(ui.required); return; }
    setBusy(true); setError(''); setSent(false);
    try {
      const { sendFeedback } = await import('@/lib/feedback-client'); await sendFeedback({ topic, message, email });
      setTopic(''); setMessage(''); setEmail(''); setSent(true);
    } catch { setError(ui.serviceError); }
    finally { setBusy(false); }
  }
  if (region === 'pending') return <div data-region-pending className="grid max-w-2xl gap-4" role="status"><p className="text-sm text-muted-foreground">{interfaceCopy[locale].checkingRegion}</p><Skeleton className="h-96" /></div>;
  if (region === 'restricted') return <Alert className="max-w-2xl"><AlertDescription>{ui.regionUnavailable} <a className="text-link underline" href="mailto:wallpapers@want.foundation">wallpapers@want.foundation</a></AlertDescription></Alert>;
  return <Card className="max-w-2xl gap-0 py-0 shadow-none"><CardContent className="p-5 sm:p-8">
    <form onSubmit={(event) => void submit(event)} className="grid gap-6" aria-busy={busy}>
      <Field><FieldLabel htmlFor="feedback-topic">{ui.topic}</FieldLabel><Input id="feedback-topic" name="topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={100} required disabled={busy} /></Field>
      <Field><FieldLabel htmlFor="feedback-message">{ui.message}</FieldLabel><Textarea id="feedback-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={2000} required disabled={busy} className="min-h-40" /></Field>
      <Field><FieldLabel htmlFor="feedback-email">{ui.emailOptional}</FieldLabel><Input id="feedback-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" disabled={busy} /></Field>
      <div><Button type="submit" disabled={busy}>{busy ? ui.loading : ui.feedbackSubmit}</Button>{error && <FieldError className="mt-4" role="alert">{error}</FieldError>}<p className="mt-4 text-sm text-link" role="status">{sent ? ui.feedbackThanks : ''}</p></div>
    </form>
  </CardContent></Card>;
}
