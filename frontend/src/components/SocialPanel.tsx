import { useEffect, useState, type SubmitEvent } from 'react';
import { Check, Flag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import RecaptchaNotice from '@/components/RecaptchaNotice';
import { copy, mutationError } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import { ratingValues, ratingEmoji, type Rating } from '@/data/ratings';
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
    catch (error) { setError(mutationError(locale, error)); }
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
  if (region === 'pending') return <div data-region-pending role="status" className="grid gap-4 py-4"><p className="text-sm text-muted-foreground">{text.checkingRegion}</p><Skeleton className="h-24 w-full" /></div>;
  if (region === 'restricted') return <Alert><AlertDescription>{ui.regionUnavailable}</AlertDescription></Alert>;
  return <div className="grid gap-6" data-social-panel>
    {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}<Button type="button" variant="outline" className="mt-3 w-fit" disabled={busy || loading} onClick={() => void refresh()}>{text.retry}</Button></AlertDescription></Alert>}
    <section aria-labelledby="ratings-title"><h2 id="ratings-title" className="text-2xl font-semibold tracking-tight">{ui.ratings}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ui.ratingHint}</p>
      {loading && !data ? <div role="status" className="mt-6 grid grid-cols-4 gap-2 sm:gap-4" aria-label={ui.loading} aria-busy="true">{ratingValues.map((value) => <Skeleton key={value} className="h-24" />)}</div> : <RadioGroup value={data?.ownRating ?? ''} onValueChange={(value) => void rate(value)} disabled={busy || !data} aria-label={ui.ratings} className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">
        {ratingValues.map((value) => <Label key={value} htmlFor={`rating-${value}`} title={ui[value]} className="relative flex min-h-24 min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border bg-card px-2 py-4 transition-colors has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
          <RadioGroupItem id={`rating-${value}`} value={value} aria-label={ui[value]} aria-describedby={`rating-count-${value}`} className="absolute inset-0 size-full rounded-lg border-0 opacity-0" /><span aria-hidden="true" className="pointer-events-none text-3xl leading-none">{ratingEmoji[value]}</span>{data?.ownRating === value && <Check aria-hidden="true" className="pointer-events-none absolute top-2 right-2 size-3.5 text-link" />}<span id={`rating-count-${value}`} className="pointer-events-none text-center text-sm text-muted-foreground tabular-nums wrap-anywhere"><span className="sr-only">{text.votes}: </span>{data?.counts[value].toLocaleString(locale) ?? '…'}</span>
        </Label>)}
      </RadioGroup>}
    </section>
    <RecaptchaNotice locale={locale} />
    <p className="min-h-6 text-sm text-link" role="status">{status}</p>
    <Separator />
    <section aria-labelledby="comments-title" className="grid gap-6"><h2 id="comments-title" className="text-2xl font-semibold tracking-tight">{ui.comments}</h2>
      <Card className="gap-0 py-0 shadow-none"><form onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <CardHeader className="p-6"><CardTitle className="text-lg tracking-tight">{text.commentTitle}</CardTitle><CardDescription id="comment-hint" className="leading-relaxed">{text.commentPublic}</CardDescription></CardHeader>
        <CardContent className="px-6 pb-4"><FieldGroup><Field data-disabled={busy}><FieldLabel htmlFor="comment-text" className="sr-only">{text.ownComment}</FieldLabel><Textarea id="comment-text" name="comment" value={comment} onChange={(event) => setComment(event.target.value)} minLength={2} maxLength={1000} required placeholder={ui.commentPlaceholder} disabled={busy} aria-describedby="comment-hint" className="min-h-32" /></Field></FieldGroup></CardContent>
        <CardFooter className="flex-wrap justify-between gap-4 px-6 pb-6"><span className="text-sm text-muted-foreground tabular-nums"><span className="sr-only">{text.characters}: </span>{comment.length}/1000</span><Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? ui.loading : ui.commentSubmit}</Button></CardFooter>
      </form></Card>
      <div className="grid gap-4" aria-busy={loading}>
        {loading && !data ? <><Skeleton className="h-24" /><Skeleton className="h-24" /></> : data?.comments.length === 0 ? <p className="px-2 py-4 text-sm leading-relaxed text-muted-foreground">{ui.commentEmpty}</p> : data?.comments.map((item) => <Card key={item.id} className="gap-4 py-0 shadow-none" data-comment={item.id}>
          <CardHeader className="items-center px-5 pt-4"><CardDescription className="flex flex-wrap items-center gap-2">{item.createdAt && <time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleDateString(locale)}</time>}{item.uid === data.ownUid && <Badge variant="outline">{text.ownComment}</Badge>}</CardDescription><CardAction><Button type="button" variant="ghost" size="sm" disabled={busy || reported.includes(item.id)} onClick={() => void action(item)}>{item.uid === data.ownUid ? <Trash2 data-icon="inline-start" /> : reported.includes(item.id) ? <Check data-icon="inline-start" /> : <Flag data-icon="inline-start" />}{item.uid === data.ownUid ? ui.delete : reported.includes(item.id) ? text.saved : ui.report}</Button></CardAction></CardHeader>
          <CardContent className="px-5 pb-5"><p className="whitespace-pre-wrap text-base leading-relaxed wrap-anywhere">{item.text}</p></CardContent>
        </Card>)}
      </div>
    </section>
  </div>;
}
