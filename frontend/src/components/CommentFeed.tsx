import { Check, Flag, Trash2 } from 'lucide-react';
import { CommentFeed as SharedCommentFeed, type CommentItem } from '@want-foundation/desyst-react';
import { copy } from '@/data/copy';
import { designCopy } from '@/data/design-copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';
import type { Comment } from '@/lib/wallpaper-client';

export default function CommentFeed({ locale, comments, ownUid, reported, busy, onAction }: {
  locale: Locale; comments: Comment[]; ownUid: string | null; reported: string[]; busy: boolean; onAction: (item: Comment) => void;
}) {
  const ui = copy[locale], text = designCopy[locale];
  const items: CommentItem[] = comments.map((item) => {
    const own = item.uid === ownUid;
    const saved = reported.includes(item.id);
    return {
      id: item.id, text: item.text, own,
      author: own ? `${text.you} · ${interfaceCopy[locale].ownComment}` : text.guest,
      createdAt: item.createdAt ? { dateTime: new Date(item.createdAt).toISOString(), label: new Date(item.createdAt).toLocaleDateString(locale, { timeZone: 'UTC' }) } : undefined,
      actions: [{ id: own ? 'delete' : 'report', label: own ? ui.delete : saved ? interfaceCopy[locale].saved : ui.report, disabled: saved, icon: own ? Trash2 : saved ? Check : Flag }],
    };
  });
  return <SharedCommentFeed comments={items} busy={busy}
    labels={{ title: ui.comments, empty: ui.commentEmpty, previous: text.previousComments, next: text.nextComments, readMore: text.readComment, collapse: text.collapseComment }}
    onAction={(id) => { const item = comments.find(comment => comment.id === id); if (item) onAction(item); }} />;
}
