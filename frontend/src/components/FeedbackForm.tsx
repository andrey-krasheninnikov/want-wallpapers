import { trackProductEvent, captureProductEvents, analyticsFailure } from '@/lib/analytics';
import React, { useEffect, useState, type SubmitEvent } from 'react';
import { Check, LockKeyhole, Send } from 'lucide-react';
import { Button } from '@want-foundation/desyst-react';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@want-foundation/desyst-react';
import { Input } from '@want-foundation/desyst-react';
import { Textarea } from '@want-foundation/desyst-react';
import RecaptchaNotice from '@/components/RecaptchaNotice';
import { copy, mutationError } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';

export function useFeedbackForm(locale: Locale) {
  const started = React.useRef(false);
  const start = () => { if (!started.current) { started.current = true; trackProductEvent('feedback_action', { stage: 'start' }); } };
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
    const track = captureProductEvents();
    track('feedback_action', { stage: 'attempt' });
    if (!topic.trim() || message.trim().length < 5) {
      track('feedback_action', { stage: 'error', error_code: 'validation' });
      const field = !topic.trim() ? 'topic' : 'message';
      setInvalid(field); (field === 'topic' ? topicInput : messageInput).current?.focus(); return;
    }
    setInvalid(null); setBusy(true); setError(''); setSent(false);
    try {
      const { sendFeedback } = await import('@/lib/feedback-client'); await sendFeedback({ topic, message, email });
      track('feedback_action', { stage: 'success' }); started.current = false;
      setTopic(''); setMessage(''); setEmail(''); setSent(true);
    } catch (error) { track('feedback_action', { stage: 'error', error_code: analyticsFailure(error) }); setError(mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  return { start, topic, setTopic, message, setMessage, email, setEmail, invalid, setInvalid, topicInput, messageInput, disabled, busy, error, sent, submit };
}

export function FeedbackFields({ locale, state }: { locale: Locale; state: ReturnType<typeof useFeedbackForm> }) {
  const ui = copy[locale], text = interfaceCopy[locale];
  const prefix = React.useId();
  const { start, topic, setTopic, message, setMessage, email, setEmail, invalid, setInvalid, topicInput, messageInput, disabled, busy, error, sent, submit } = state;
  return <div className="feedback-form">
    <form onInput={start} onSubmit={(event) => void submit(event)} aria-busy={disabled}>
      <header className="feedback-form-head"><h2>{text.feedbackFormTitle}</h2></header>
      <FieldGroup className="feedback-fields">
        <Field data-disabled={disabled} data-invalid={invalid === 'topic'} className="gap-2"><FieldLabel htmlFor={`${prefix}-topic`}>{ui.topic}</FieldLabel><Input ref={topicInput} id={`${prefix}-topic`} name="topic" dir="auto" value={topic} onChange={(event) => { setTopic(event.target.value); if (invalid === 'topic') setInvalid(null); }} maxLength={100} required disabled={disabled} autoComplete="off" aria-invalid={invalid === 'topic'} aria-describedby={invalid === 'topic' ? `${prefix}-topic-error` : `${prefix}-topic-hint`} /><FieldDescription id={`${prefix}-topic-hint`}>{text.feedbackTopicHint}</FieldDescription>{invalid === 'topic' && <FieldError id={`${prefix}-topic-error`}>{ui.required}</FieldError>}</Field>
        <Field data-disabled={disabled} className="gap-2"><FieldLabel htmlFor={`${prefix}-email`}>{ui.emailOptional}</FieldLabel><Input id={`${prefix}-email`} name="email" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" spellCheck={false} disabled={disabled} aria-describedby={`${prefix}-email-hint`} /><FieldDescription id={`${prefix}-email-hint`}>{text.feedbackEmailHint}</FieldDescription></Field>
        <Field data-disabled={disabled} data-invalid={invalid === 'message'} className="gap-2"><FieldLabel htmlFor={`${prefix}-message`}>{ui.message}</FieldLabel><Textarea ref={messageInput} id={`${prefix}-message`} name="message" dir="auto" value={message} onChange={(event) => { setMessage(event.target.value); if (invalid === 'message') setInvalid(null); }} minLength={5} maxLength={2000} required disabled={disabled} aria-invalid={invalid === 'message'} aria-describedby={invalid === 'message' ? `${prefix}-message-error` : `${prefix}-message-hint`} className="feedback-message" /><div className="flex items-start justify-between gap-4"><FieldDescription id={`${prefix}-message-hint`} className="min-w-0">{text.feedbackMessageHint}</FieldDescription><span className="shrink-0 text-sm text-muted-foreground tabular-nums"><span className="sr-only">{text.characters}: </span>{message.length}/2000</span></div>{invalid === 'message' && <FieldError id={`${prefix}-message-error`}>{ui.required}</FieldError>}</Field>
      </FieldGroup>
      <div className="feedback-footer"><div className="feedback-submit-row"><Button type="submit" size="lg" disabled={disabled}><Send data-icon="inline-start" aria-hidden="true" />{busy ? ui.loading : ui.feedbackSubmit}</Button><p className="feedback-private"><LockKeyhole aria-hidden="true" />{text.feedbackPrivate}</p></div><RecaptchaNotice locale={locale} />{error && <FieldError>{error}</FieldError>}<p className="feedback-status" role="status">{sent && <span className="flex items-center gap-3"><Check aria-hidden="true" />{ui.feedbackThanks}</span>}</p></div>
    </form>
  </div>;
}

export default function FeedbackForm({ locale }: { locale: Locale }) {
  const state = useFeedbackForm(locale);
  return <FeedbackFields locale={locale} state={state} />;
}
