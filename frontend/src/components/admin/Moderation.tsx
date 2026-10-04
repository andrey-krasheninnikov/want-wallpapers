import { useEffect, useState } from 'react';
import { Eye, EyeOff, Check, RotateCcw, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { adminApi, errorText, type AdminSession } from './client';
type Kind = 'comments' | 'reports' | 'feedback';
type Item = { id: string; version: number; createdAt: string; text?: string; topic?: string; message?: string; email?: string; wallpaperId?: string; hidden?: boolean; status?: string; commentId?: string; commentVersion?: number };
type Action = { item: Item; label: string; target: Kind; id: string; body: { version: number; hidden?: boolean; status?: string } };
const labels: Record<string, string> = { open: 'Открыто', closed: 'Закрыто', resolved: 'Обработано', dismissed: 'Отклонено', visible: 'Видимые', hidden: 'Скрытые' };
export default function Moderation({ kind, session }: { kind: Kind; session: AdminSession }) {
  const [items, setItems] = useState<Item[]>([]), [hasMore, setHasMore] = useState(false), [page, setPage] = useState(0);
  const [status, setStatus] = useState(kind === 'comments' ? '' : 'open'), [loading, setLoading] = useState(true), [error, setError] = useState(''), [action, setAction] = useState<Action>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const data = await adminApi<{ items: Item[]; hasMore: boolean }>(session, `/moderation/${kind}?offset=${page * 25}&limit=25&status=${status}`); setItems(data.items); setHasMore(data.hasMore); }
    catch (error) { setError(errorText(error)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [status, page]);
  function change(item: Item, label: string, body: Action['body'], target = kind, id = item.id) { setAction({ item, label, body, target, id }); }
  async function confirm() {
    if (!action) return; setBusy(true); setError('');
    try { await adminApi(session, `/moderation/${action.target}/${action.id}`, 'PATCH', action.body); setAction(undefined); setNotice('Изменение сохранено.'); await load(); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  const filters = kind === 'comments' ? ['', 'visible', 'hidden'] : kind === 'reports' ? ['open', 'resolved', 'dismissed', ''] : ['open', 'closed', ''];
  return <div className="space-y-6">
    {kind === 'feedback' && <Alert><AlertDescription>Закрытые обращения удаляются через год. Повторное открытие отменяет срок удаления.</AlertDescription></Alert>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="Фильтр статуса" className="flex flex-wrap gap-2">{filters.map((value) => <Button variant={value === status ? 'secondary' : 'outline'} aria-pressed={value === status} key={value} onClick={() => { setStatus(value); setPage(0); }}>{labels[value] ?? 'Все'}</Button>)}</div><Button variant="outline" size="icon" aria-label="Обновить список" onClick={load} disabled={loading}><RefreshCw /></Button></div>
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading ? <div role="status" aria-label="Загрузка" className="space-y-4">{[1, 2, 3].map((id) => <Skeleton key={id} className="h-36 w-full" />)}</div> : items.length ? <ul className="space-y-4">{items.map((item) => <li key={item.id} className="rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div>{item.topic && <h2 className="mb-2 font-medium">{item.topic}</h2>}<p className="text-xs text-muted-foreground"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU')}</time>{item.wallpaperId && ` · ${item.wallpaperId}`}</p></div><Badge variant="outline">{item.status ? labels[item.status] : item.hidden ? 'Скрыт' : 'Виден'}</Badge></div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{item.message ?? item.text}</p>{item.email && <p className="mt-3 break-all text-sm text-muted-foreground">{item.email}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {kind === 'comments' && <Button variant="outline" size="sm" onClick={() => change(item, item.hidden ? 'Вернуть комментарий' : 'Скрыть комментарий', { version: item.version, hidden: !item.hidden })}>{item.hidden ? <Eye /> : <EyeOff />}{item.hidden ? 'Вернуть' : 'Скрыть'}</Button>}
        {kind === 'reports' && <><Button variant="outline" size="sm" onClick={() => change(item, item.hidden ? 'Вернуть комментарий' : 'Скрыть комментарий', { version: item.commentVersion!, hidden: !item.hidden }, 'comments', item.commentId!)}>{item.hidden ? <Eye /> : <EyeOff />}{item.hidden ? 'Вернуть комментарий' : 'Скрыть комментарий'}</Button>{item.status === 'open' ? <><Button size="sm" onClick={() => change(item, 'Отметить жалобу обработанной', { version: item.version, status: 'resolved' })}><Check />Обработано</Button><Button variant="ghost" size="sm" onClick={() => change(item, 'Отклонить жалобу', { version: item.version, status: 'dismissed' })}><X />Отклонить</Button></> : <Button variant="ghost" size="sm" onClick={() => change(item, 'Открыть жалобу повторно', { version: item.version, status: 'open' })}><RotateCcw />Открыть</Button>}</>}
        {kind === 'feedback' && <Button variant="outline" size="sm" onClick={() => change(item, item.status === 'open' ? 'Закрыть обращение' : 'Открыть обращение повторно', { version: item.version, status: item.status === 'open' ? 'closed' : 'open' })}>{item.status === 'open' ? <Check /> : <RotateCcw />}{item.status === 'open' ? 'Закрыть' : 'Открыть повторно'}</Button>}
      </div>
    </li>)}</ul> : <div className="rounded-lg border border-dashed p-12 text-center"><h2 className="font-medium">Список пуст</h2><p className="mt-2 text-sm text-muted-foreground">Новые записи появятся здесь.</p></div>}
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Страница {page + 1}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Предыдущая страница" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Следующая страница" disabled={!hasMore || loading} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div>
    <Dialog open={!!action} onOpenChange={(open) => { if (!open && !busy) setAction(undefined); }}><DialogContent closeLabel="Закрыть"><DialogHeader><DialogTitle>{action?.label}?</DialogTitle><DialogDescription>Изменение применяется сразу. При необходимости его можно отменить.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setAction(undefined)} disabled={busy}>Отмена</Button><Button onClick={confirm} disabled={busy}>{busy ? 'Сохраняем…' : 'Подтвердить'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
