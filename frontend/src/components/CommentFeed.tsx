import { Check, Flag, Trash2, UserRound } from 'lucide-react';
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
  return <div className="comment-feed" data-comment-feed>{comments.length === 0 ? <p className="text-sm leading-relaxed text-muted-foreground">{ui.commentEmpty}</p> : comments.map((item) => {
    const own = item.uid === ownUid;
    const saved = reported.includes(item.id);
    return <article key={item.id} className="comment-row" data-comment={item.id}>
      <span className="comment-avatar" data-own={own} aria-hidden="true"><UserRound /></span>
      <div className="min-w-0"><div className="comment-meta"><strong>{own ? text.you : text.guest}</strong>{own && <span className="text-muted-foreground">{interfaceCopy[locale].ownComment}</span>}{item.createdAt && <time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleDateString(locale)}</time>}</div>
        <p className="comment-text">{item.text}</p>
        <div className="comment-actions"><Button type="button" variant="ghost" size="sm" disabled={busy || saved} onClick={() => onAction(item)}>{own ? <Trash2 data-icon="inline-start" aria-hidden="true" /> : saved ? <Check data-icon="inline-start" aria-hidden="true" /> : <Flag data-icon="inline-start" aria-hidden="true" />}{own ? ui.delete : saved ? interfaceCopy[locale].saved : ui.report}</Button></div>
      </div>
    </article>;
  })}</div>;
}
