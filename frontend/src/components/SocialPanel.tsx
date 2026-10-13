import { useEffect, useState, type SubmitEvent } from 'react';
import { Check, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import RecaptchaNotice from '@/components/RecaptchaNotice';
import CommentFeed from '@/components/CommentFeed';
import { copy, mutationError } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import { ratingValues, ratingEmoji, type Rating } from '@/data/ratings';
import type { Comment, SocialData } from '@/lib/wallpaper-client';
import type { Locale } from '@/data/catalog';

export default function SocialPanel({ id, locale }: { id: string; locale: Locale }) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [reported, setReported] = useState<string[]>([]);
  async function refresh() {
    setLoading(true); setError('');
    try { const service = await import('@/lib/wallpaper-client'); setData(await service.readSocial(id)); }
    catch (error) { setError(mutationError(locale, error)); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    void import('@/lib/wallpaper-client').then((service) => service.readSocial(id)).then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError(ui.serviceError); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, ui.serviceError]);
  async function rate(value: string) {
    if (busy || !ratingValues.includes(value as Rating)) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const service = await import('@/lib/wallpaper-client'); await service.saveRating(id, value as Rating);
      setStatus(text.ratingSaved); await refresh();
    } catch (error) { setError(mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (comment.trim().length < 2) { setError(ui.required); return; }
    setBusy(true); setError(''); setStatus('');
    try {
      const service = await import('@/lib/wallpaper-client'); await service.postComment(id, comment);
      setComment(''); setStatus(text.commentSent); await refresh();
    } catch (error) { setError(error instanceof Error && error.message === 'comment-cooldown' ? ui.commentWait : mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  async function action(item: Comment) {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const service = await import('@/lib/wallpaper-client');
      if (await service.actOnComment(id, item) === 'reported') { setReported((value) => [...value, item.id]); setStatus(ui.reportThanks); }
      else await refresh();
    } catch (error) { setError(mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-6" data-social-panel>
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}<Button type="button" variant="outline" className="mt-3 w-fit" disabled={busy || loading} onClick={() => void refresh()}>{text.retry}</Button></AlertDescription></Alert>}
    <section aria-labelledby="ratings-title"><h2 id="ratings-title" className="section-title">{ui.ratings}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ui.ratingHint}</p>
      {loading && !data ? <div role="status" className="mt-6 grid grid-cols-4 gap-2 sm:gap-4" aria-label={ui.loading} aria-busy="true">{ratingValues.map((value) => <Skeleton key={value} className="h-24" />)}</div> : <RadioGroup value={data?.ownRating ?? ''} onValueChange={(value) => void rate(value)} disabled={busy || !data} aria-label={ui.ratings} className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">
        {ratingValues.map((value) => <Label key={value} htmlFor={`rating-${value}`} title={ui[value]} className="rating-tile">
          <RadioGroupItem id={`rating-${value}`} value={value} aria-label={ui[value]} aria-describedby={`rating-count-${value}`} className="absolute inset-0 size-full rounded-lg border-0 opacity-0" /><span aria-hidden="true" className="pointer-events-none text-3xl leading-none">{ratingEmoji[value]}</span>{data?.ownRating === value && <Check aria-hidden="true" className="pointer-events-none absolute top-2 right-2 size-3.5 text-link" />}<span id={`rating-count-${value}`} className="pointer-events-none text-center text-sm text-muted-foreground tabular-nums wrap-anywhere"><span className="sr-only">{text.votes}: </span>{data?.counts[value].toLocaleString(locale) ?? '…'}</span>
        </Label>)}
      </RadioGroup>}
    </section>
    <RecaptchaNotice locale={locale} />
    <p className="min-h-6 text-sm text-link" role="status">{status}</p>
    <section aria-labelledby="comments-title" className="grid gap-6"><h2 id="comments-title" className="section-title">{ui.comments}</h2>
      <form className="comment-composer" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <div className="comment-compose-row"><span className="comment-avatar" data-own="true" aria-hidden="true"><UserRound /></span><div className="min-w-0"><FieldGroup><Field data-disabled={busy}><FieldLabel htmlFor="comment-text">{text.commentTitle}</FieldLabel><p id="comment-hint" className="text-sm leading-relaxed text-muted-foreground">{text.commentPublic}</p><Textarea id="comment-text" name="comment" value={comment} onChange={(event) => setComment(event.target.value)} minLength={2} maxLength={1000} required placeholder={ui.commentPlaceholder} disabled={busy} aria-describedby="comment-hint" /></Field></FieldGroup><div className="comment-compose-footer"><span className="text-sm text-muted-foreground tabular-nums"><span className="sr-only">{text.characters}: </span>{comment.length}/1000</span><Button type="submit" disabled={busy}>{busy ? ui.loading : ui.commentSubmit}</Button></div></div></div>
      </form>
      <div aria-busy={loading}>{loading && !data ? <div role="status" aria-label={ui.loading} className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : <CommentFeed locale={locale} comments={data?.comments ?? []} ownUid={data?.ownUid ?? null} reported={reported} busy={busy} onAction={(item) => void action(item)} />}</div>
    </section>
  </div>;
}
