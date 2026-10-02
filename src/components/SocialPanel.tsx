import { useEffect, useState, type SubmitEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { copy } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import { ratingValues, type Rating } from '@/data/ratings';
import { useRegion } from '@/lib/use-region';
import type { Comment, SocialData } from '@/lib/wallpaper-client';
import type { Locale } from '@/data/catalog';

export default function SocialPanel({ id, locale }: { id: string; locale: Locale }) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
  const region = useRegion();
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
    catch { setError(ui.serviceError); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (region !== 'open') return;
    let active = true;
    void import('@/lib/wallpaper-client').then((service) => service.readSocial(id)).then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError(ui.serviceError); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, region, ui.serviceError]);
  async function rate(value: string) {
    if (busy || !ratingValues.includes(value as Rating)) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const service = await import('@/lib/wallpaper-client'); await service.saveRating(id, value as Rating);
      setStatus(text.ratingSaved); await refresh();
    } catch { setError(ui.serviceError); }
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
    } catch (error) { setError(error instanceof Error && error.message === 'comment-cooldown' ? ui.commentWait : ui.serviceError); }
    finally { setBusy(false); }
  }
  async function action(item: Comment) {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const service = await import('@/lib/wallpaper-client');
      if (await service.actOnComment(id, item) === 'reported') { setReported((value) => [...value, item.id]); setStatus(ui.reportThanks); }
      else await refresh();
    } catch { setError(ui.serviceError); }
    finally { setBusy(false); }
  }
  if (region === 'pending') return <div data-region-pending role="status" className="grid gap-4 py-4"><p className="text-sm text-muted-foreground">{text.checkingRegion}</p><Skeleton className="h-24 w-full" /></div>;
  if (region === 'restricted') return <Alert><AlertDescription>{ui.regionUnavailable}</AlertDescription></Alert>;
  return <div className="grid gap-6" data-social-panel>
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}<Button type="button" variant="outline" className="mt-3 w-fit" disabled={busy || loading} onClick={() => void refresh()}>{text.retry}</Button></AlertDescription></Alert>}
    <section aria-labelledby="ratings-title"><h2 id="ratings-title" className="text-2xl font-semibold tracking-tight">{ui.ratings}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ui.ratingHint}</p>
      {loading && !data ? <div role="status" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={ui.loading} aria-busy="true">{ratingValues.map((value) => <Skeleton key={value} className="h-24" />)}</div> : <RadioGroup value={data?.ownRating ?? ''} onValueChange={(value) => void rate(value)} disabled={busy || !data} aria-label={ui.ratings} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ratingValues.map((value) => <Label key={value} htmlFor={`rating-${value}`} className="flex min-h-24 cursor-pointer flex-col items-start gap-3 rounded-lg border bg-card p-4 leading-snug has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-accent has-[:disabled]:cursor-default">
          <span className="flex w-full items-center justify-between gap-3"><span>{ui[value]}</span><RadioGroupItem id={`rating-${value}`} value={value} /></span><span className="text-sm text-muted-foreground">{data?.counts[value] ?? '—'}</span>
        </Label>)}
      </RadioGroup>}
    </section>
    <p className="min-h-6 text-sm text-link" role="status">{status}</p>
    <Separator />
    <section aria-labelledby="comments-title"><h2 id="comments-title" className="mb-6 text-2xl font-semibold tracking-tight">{ui.comments}</h2>
      <div className="mb-6 grid gap-4" aria-busy={loading}>
        {loading && !data ? <><Skeleton className="h-24" /><Skeleton className="h-24" /></> : data?.comments.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-sm leading-relaxed text-muted-foreground">{ui.commentEmpty}</p> : data?.comments.map((item) => <Card key={item.id} className="gap-0 py-0 shadow-none"><CardContent className="p-5"><p className="whitespace-pre-wrap text-base leading-relaxed wrap-anywhere">{item.text}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3">{item.createdAt && <time dateTime={new Date(item.createdAt).toISOString()} className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleDateString(locale)}</time>}<Button type="button" variant="ghost" className="text-link" disabled={busy || reported.includes(item.id)} onClick={() => void action(item)}>{item.uid === data.ownUid ? ui.delete : reported.includes(item.id) ? text.saved : ui.report}</Button></div></CardContent></Card>)}
      </div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4"><Field><FieldLabel htmlFor="comment-text">{ui.comments}</FieldLabel><Textarea id="comment-text" name="comment" value={comment} onChange={(event) => setComment(event.target.value)} minLength={2} maxLength={1000} required placeholder={ui.commentPlaceholder} disabled={busy} className="min-h-32" /></Field><Button type="submit" disabled={busy} className="w-fit">{busy ? ui.loading : ui.commentSubmit}</Button></form>
    </section>
  </div>;
}
