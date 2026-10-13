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

export function useWallpaperSocial(id: string, locale: Locale) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [reported, setReported] = useState<string[]>([]);
  const [noticeTarget, setNoticeTarget] = useState<'ratings' | 'comments'>('comments');
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
    setNoticeTarget('ratings');
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
    setNoticeTarget('comments');
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
    setNoticeTarget('comments');
    setBusy(true); setError(''); setStatus('');
    try {
      const service = await import('@/lib/wallpaper-client');
      if (await service.actOnComment(id, item) === 'reported') { setReported((value) => [...value, item.id]); setStatus(ui.reportThanks); }
      else await refresh();
    } catch (error) { setError(mutationError(locale, error)); }
    finally { setBusy(false); }
  }
  return { data, loading, error, status, busy, comment, reported, noticeTarget, setComment, refresh, rate, submit, action };
}

type SocialState = ReturnType<typeof useWallpaperSocial>;

function SocialNotice({ locale, social, target }: { locale: Locale; social: SocialState; target: SocialState['noticeTarget'] }) {
  const active = social.noticeTarget === target;
  return <>
    {active && social.error && <Alert variant="destructive" role="alert"><AlertDescription>{social.error}<Button type="button" variant="outline" className="mt-3 w-fit" disabled={social.busy || social.loading} onClick={() => void social.refresh()}>{interfaceCopy[locale].retry}</Button></AlertDescription></Alert>}
    <p className="comment-social-status text-sm leading-relaxed text-link" role="status">{active ? social.status : ''}</p>
  </>;
}

export function WallpaperRatings({ locale, social }: { locale: Locale; social: SocialState }) {
  const ui = copy[locale], text = interfaceCopy[locale];
  const { data, loading, busy } = social;
  return <section className="wallpaper-ratings grid gap-3" aria-labelledby="ratings-title" data-wallpaper-ratings>
    <h2 id="ratings-title">{ui.ratings}</h2><p className="text-sm leading-relaxed text-muted-foreground">{ui.ratingHint}</p>
    {loading && !data ? <div role="status" className="grid grid-cols-4 gap-2" aria-label={ui.loading} aria-busy="true">{ratingValues.map((value) => <Skeleton key={value} className="h-14" />)}</div> : <RadioGroup value={data?.ownRating ?? ''} onValueChange={(value) => void social.rate(value)} disabled={busy || !data} aria-label={ui.ratings} className="grid grid-cols-4 gap-2">
      {ratingValues.map((value) => <Label key={value} htmlFor={`rating-${value}`} title={ui[value]} className="rating-tile">
        <RadioGroupItem id={`rating-${value}`} value={value} aria-label={ui[value]} aria-describedby={`rating-count-${value}`} className="absolute inset-0 size-full rounded-lg border-0 opacity-0" /><span aria-hidden="true" className="pointer-events-none text-xl leading-none">{ratingEmoji[value]}</span>{data?.ownRating === value && <Check aria-hidden="true" className="pointer-events-none absolute top-1 right-1 size-3 text-link" />}<span id={`rating-count-${value}`} className="pointer-events-none text-center text-sm text-muted-foreground tabular-nums wrap-anywhere"><span className="sr-only">{text.votes}: </span>{data?.counts[value].toLocaleString(locale) ?? '…'}</span>
      </Label>)}
    </RadioGroup>}
    <SocialNotice locale={locale} social={social} target="ratings" />
  </section>;
}

export function WallpaperComments({ locale, social }: { locale: Locale; social: SocialState }) {
  const ui = copy[locale], text = interfaceCopy[locale];
  const { data, loading, busy, comment, reported } = social;
  return <section aria-labelledby="comments-title" className="wallpaper-comments grid gap-4" data-social-panel>
    <h2 id="comments-title" className="section-title">{ui.comments}</h2>
    <SocialNotice locale={locale} social={social} target="comments" />
    <form className="comment-composer" onSubmit={(event) => void social.submit(event)} aria-busy={busy}>
      <FieldGroup><Field data-disabled={busy || !data}>
        <div className="comment-compose-row"><span className="comment-avatar" data-own="true" aria-hidden="true"><UserRound /></span><FieldLabel htmlFor="comment-text">{text.commentTitle}</FieldLabel></div>
        <p id="comment-hint" className="text-sm leading-relaxed text-muted-foreground">{text.commentPublic}</p>
        <Textarea id="comment-text" name="comment" value={comment} onChange={(event) => social.setComment(event.target.value)} minLength={2} maxLength={1000} required placeholder={ui.commentPlaceholder} disabled={busy || !data} aria-describedby="comment-hint" />
      </Field></FieldGroup>
      <div className="comment-compose-footer"><span className="text-sm text-muted-foreground tabular-nums"><span className="sr-only">{text.characters}: </span>{comment.length}/1000</span><Button type="submit" disabled={busy || !data}>{busy ? ui.loading : ui.commentSubmit}</Button></div>
    </form>
    <div aria-busy={loading}>{loading && !data ? <div role="status" aria-label={ui.loading} className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : <CommentFeed locale={locale} comments={data?.comments ?? []} ownUid={data?.ownUid ?? null} reported={reported} busy={busy} onAction={(item) => void social.action(item)} />}</div>
    <RecaptchaNotice locale={locale} />
    <noscript><p className="text-sm leading-relaxed text-muted-foreground">{text.javascriptRequired}</p></noscript>
  </section>;
}
