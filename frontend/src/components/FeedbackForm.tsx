import { useState, type SubmitEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RecaptchaNotice from '@/components/RecaptchaNotice';
import { copy, mutationError } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';

export default function FeedbackForm({ locale }: { locale: Locale }) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
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
    } catch (error) { setError(mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  return <Card className="gap-0 py-0 shadow-none">
    <form onSubmit={(event) => void submit(event)} className="flex flex-col" aria-busy={busy}>
      <CardHeader className="p-6 sm:p-8"><CardTitle className="text-xl tracking-tight">{text.feedbackFormTitle}</CardTitle><CardDescription className="leading-relaxed">{text.feedbackPrivate}</CardDescription></CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8"><FieldGroup className="gap-6">
        <Field data-disabled={busy} className="gap-2"><FieldLabel htmlFor="feedback-topic">{ui.topic}</FieldLabel><Input id="feedback-topic" name="topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={100} required disabled={busy} aria-describedby="feedback-topic-hint" /><FieldDescription id="feedback-topic-hint">{text.feedbackTopicHint}</FieldDescription></Field>
        <Field data-disabled={busy} className="gap-2"><FieldLabel htmlFor="feedback-message">{ui.message}</FieldLabel><Textarea id="feedback-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={2000} required disabled={busy} aria-describedby="feedback-message-hint" className="min-h-40" /><div className="flex items-start justify-between gap-4"><FieldDescription id="feedback-message-hint" className="min-w-0">{text.feedbackMessageHint}</FieldDescription><span className="shrink-0 text-sm text-muted-foreground tabular-nums"><span className="sr-only">{text.characters}: </span>{message.length}/2000</span></div></Field>
        <Field data-disabled={busy} className="gap-2"><FieldLabel htmlFor="feedback-email">{ui.emailOptional}</FieldLabel><Input id="feedback-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" disabled={busy} aria-describedby="feedback-email-hint" /><FieldDescription id="feedback-email-hint">{text.feedbackEmailHint}</FieldDescription></Field>
      </FieldGroup></CardContent>
      <CardFooter className="flex-col items-stretch gap-4 border-t p-6 sm:items-start sm:p-8"><Button type="submit" disabled={busy}><Send data-icon="inline-start" />{busy ? ui.loading : ui.feedbackSubmit}</Button><RecaptchaNotice locale={locale} />{error && <FieldError>{error}</FieldError>}<p className="text-sm leading-relaxed text-link empty:hidden" role="status">{sent ? ui.feedbackThanks : ''}</p></CardFooter>
    </form>
  </Card>;
}
