import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Flag, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copy } from '@/data/copy';
import { designCopy } from '@/data/design-copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';
import type { Comment } from '@/lib/wallpaper-client';

export default function CommentFeed({ locale, comments, ownUid, reported, busy, onAction }: {
  locale: Locale; comments: Comment[]; ownUid: string | null; reported: string[]; busy: boolean; onAction: (item: Comment) => void;
}) {
  const ui = copy[locale], text = designCopy[locale];
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState({ at: 1, total: 1 });
  const step = useRef(0);
  useEffect(() => {
    const element = track.current!;
    const update = () => {
      const card = element.querySelector('article')?.getBoundingClientRect();
      if (!card) { setPage({ at: 1, total: 1 }); return; }
      const gap = parseFloat(getComputedStyle(element).columnGap);
      const count = Math.max(1, Math.round((element.clientWidth + gap) / (card.width + gap)));
      step.current = count * (card.width + gap);
      const total = Math.ceil(comments.length / count);
      const end = element.scrollLeft >= element.scrollWidth - element.clientWidth - 2;
      setPage({ at: end ? total : Math.min(total, Math.round(element.scrollLeft / step.current) + 1), total });
    };
    const observer = new ResizeObserver(update); observer.observe(element);
    element.addEventListener('scroll', update, { passive: true }); update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, [comments.length]);
  function move(direction: number) {
    const element = track.current!;
    element.scrollTo({ left: Math.max(0, Math.min(element.scrollWidth - element.clientWidth, (page.at - 1 + direction) * step.current)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <div data-comment-carousel><div ref={track} className="comment-feed" data-comment-feed role="group" tabIndex={0} aria-label={ui.comments}>{comments.length === 0 ? <p className="text-sm leading-relaxed text-muted-foreground">{ui.commentEmpty}</p> : comments.map((item) => {
    const own = item.uid === ownUid;
    const saved = reported.includes(item.id);
    return <article key={item.id} className="comment-row" data-comment={item.id}>
      <span className="comment-avatar" data-own={own} aria-hidden="true"><UserRound /></span>
      <div className="min-w-0"><div className="comment-meta"><strong>{own ? text.you : text.guest}</strong>{own && <span className="text-muted-foreground">{interfaceCopy[locale].ownComment}</span>}{item.createdAt && <time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleDateString(locale)}</time>}</div>
        {item.text.length > 240 || item.text.split('\n').length > 6 ? <details className="comment-disclosure"><summary><span className="comment-excerpt" aria-hidden="true">{item.text}</span><span className="comment-read">{text.readComment}</span><span className="comment-collapse">{text.collapseComment}</span></summary><p className="comment-text">{item.text}</p></details> : <p className="comment-text">{item.text}</p>}
        <div className="comment-actions"><Button type="button" variant="ghost" size="sm" disabled={busy || saved} onClick={() => onAction(item)}>{own ? <Trash2 data-icon="inline-start" aria-hidden="true" /> : saved ? <Check data-icon="inline-start" aria-hidden="true" /> : <Flag data-icon="inline-start" aria-hidden="true" />}{own ? ui.delete : saved ? interfaceCopy[locale].saved : ui.report}</Button></div>
      </div>
    </article>;
  })}</div>{comments.length > 0 && <nav className="carousel-pagination" aria-label={ui.comments}>
    <Button variant="secondary" size="icon" disabled={page.at === 1} onClick={() => move(-1)} aria-label={text.previousComments}><ArrowLeft aria-hidden="true" /></Button>
    <output aria-live="polite">{page.at} / {page.total}</output>
    <Button variant="secondary" size="icon" disabled={page.at === page.total} onClick={() => move(1)} aria-label={text.nextComments}><ArrowRight aria-hidden="true" /></Button>
  </nav>}</div>;
}
