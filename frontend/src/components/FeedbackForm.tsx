import React, { useEffect, useState, type SubmitEvent } from 'react';
import { Check, LockKeyhole, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [invalid, setInvalid] = useState<'topic' | 'message' | null>(null);
  const topicInput = React.useRef<HTMLInputElement>(null);
  const messageInput = React.useRef<HTMLTextAreaElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [busy, setBusy] = useState(false);
  const disabled = !ready || busy;
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!topic.trim() || message.trim().length < 5) {
      const field = !topic.trim() ? 'topic' : 'message';
      setInvalid(field); (field === 'topic' ? topicInput : messageInput).current?.focus(); return;
    }
    setInvalid(null); setBusy(true); setError(''); setSent(false);
    try {
      const { sendFeedback } = await import('@/lib/feedback-client'); await sendFeedback({ topic, message, email });
      setTopic(''); setMessage(''); setEmail(''); setSent(true);
    } catch (error) { setError(mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  return <div className="feedback-form">
    <form onSubmit={(event) => void submit(event)} aria-busy={disabled}>
      <header className="feedback-form-head"><h2>{text.feedbackFormTitle}</h2></header>
      <FieldGroup className="feedback-fields">
        <Field data-disabled={disabled} data-invalid={invalid === 'topic'} className="gap-2"><FieldLabel htmlFor="feedback-topic">{ui.topic}</FieldLabel><Input ref={topicInput} id="feedback-topic" name="topic" value={topic} onChange={(event) => { setTopic(event.target.value); if (invalid === 'topic') setInvalid(null); }} maxLength={100} required disabled={disabled} autoComplete="off" aria-invalid={invalid === 'topic'} aria-describedby={invalid === 'topic' ? 'feedback-topic-error' : 'feedback-topic-hint'} /><FieldDescription id="feedback-topic-hint">{text.feedbackTopicHint}</FieldDescription>{invalid === 'topic' && <FieldError id="feedback-topic-error">{ui.required}</FieldError>}</Field>
        <Field data-disabled={disabled} className="gap-2"><FieldLabel htmlFor="feedback-email">{ui.emailOptional}</FieldLabel><Input id="feedback-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" spellCheck={false} disabled={disabled} aria-describedby="feedback-email-hint" /><FieldDescription id="feedback-email-hint">{text.feedbackEmailHint}</FieldDescription></Field>
        <Field data-disabled={disabled} data-invalid={invalid === 'message'} className="gap-2"><FieldLabel htmlFor="feedback-message">{ui.message}</FieldLabel><Textarea ref={messageInput} id="feedback-message" name="message" value={message} onChange={(event) => { setMessage(event.target.value); if (invalid === 'message') setInvalid(null); }} minLength={5} maxLength={2000} required disabled={disabled} aria-invalid={invalid === 'message'} aria-describedby={invalid === 'message' ? 'feedback-message-error' : 'feedback-message-hint'} className="feedback-message" /><div className="flex items-start justify-between gap-4"><FieldDescription id="feedback-message-hint" className="min-w-0">{text.feedbackMessageHint}</FieldDescription><span className="shrink-0 text-sm text-muted-foreground tabular-nums"><span className="sr-only">{text.characters}: </span>{message.length}/2000</span></div>{invalid === 'message' && <FieldError id="feedback-message-error">{ui.required}</FieldError>}</Field>
      </FieldGroup>
      <div className="feedback-footer"><div className="feedback-submit-row"><Button type="submit" size="lg" disabled={disabled}><Send data-icon="inline-start" aria-hidden="true" />{busy ? ui.loading : ui.feedbackSubmit}</Button><p className="feedback-private"><LockKeyhole aria-hidden="true" />{text.feedbackPrivate}</p></div><RecaptchaNotice locale={locale} />{error && <FieldError>{error}</FieldError>}<p className="feedback-status" role="status">{sent && <span className="flex items-center gap-3"><Check aria-hidden="true" />{ui.feedbackThanks}</span>}</p></div>
    </form>
  </div>;
}
