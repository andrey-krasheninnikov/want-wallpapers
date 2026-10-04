import { useEffect, useState } from 'react';
import { Plus, Pencil, Archive, RotateCcw, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { Collection, Wallpaper } from '@/data/catalog';
import { adminApi, errorText, type AdminSession, type RecordItem } from './client';
import CatalogEditor, { type Editor } from './CatalogEditor';
type Data = { collections: RecordItem<Collection>[]; wallpapers: RecordItem<Wallpaper>[] };
export default function Catalog({ session }: { session: AdminSession }) {
  const [data, setData] = useState<Data>(), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'collections' | 'wallpapers'>('collections'), [search, setSearch] = useState(''), [archived, setArchived] = useState(false), [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Editor>(), [confirmation, setConfirmation] = useState<RecordItem<Collection | Wallpaper>>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setData(await adminApi<Data>(session, '/catalog')); } catch (error) { setError(errorText(error)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const rows = (data?.[kind] ?? []).filter((record) => record.archived === archived && `${record.item.id} ${Object.values(record.item.title).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(rows.length / 25)), currentPage = Math.min(page, pages - 1);
  async function archive() {
    if (!confirmation) return; setBusy(true); setError('');
    try {
      await adminApi(session, `/catalog/${kind}/${encodeURIComponent(confirmation.item.id)}/archive`, 'PATCH', { version: confirmation.version, archived: !confirmation.archived });
      setConfirmation(undefined); setNotice('Изменение сохранено. Обновите snapshot и пересоберите сайт.'); await load();
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <Alert><AlertDescription>Публичные страницы обновляются после экспорта каталога и сборки сайта. Оценки и комментарии работают сразу.</AlertDescription></Alert>
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="Тип записей" className="flex gap-2"><Button variant={kind === 'collections' ? 'secondary' : 'outline'} aria-pressed={kind === 'collections'} onClick={() => { setKind('collections'); setPage(0); }}>Коллекции</Button><Button variant={kind === 'wallpapers' ? 'secondary' : 'outline'} aria-pressed={kind === 'wallpapers'} onClick={() => { setKind('wallpapers'); setPage(0); }}>Обои</Button></div>
      <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Обновить каталог" onClick={load} disabled={loading}><RefreshCw aria-hidden="true" /></Button><Button onClick={() => setEditor({ kind })} disabled={!data || (kind === 'wallpapers' && !data.collections.some((c) => !c.archived))}><Plus aria-hidden="true" />Добавить</Button></div>
    </div>
    <div className="flex flex-wrap items-center gap-3"><Input aria-label="Поиск по каталогу" className="max-w-md" placeholder="Название или ID" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /><Button variant={archived ? 'secondary' : 'outline'} onClick={() => { setArchived(!archived); setPage(0); }}><Archive aria-hidden="true" />{archived ? 'В архиве' : 'Показать архив'}</Button><span className="text-sm text-muted-foreground">{rows.length} записей</span></div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading ? <div role="status" className="space-y-3" aria-label="Загрузка каталога">{[1, 2, 3].map((id) => <Skeleton key={id} className="h-24 w-full" />)}</div> : rows.length ? <ul className="divide-y divide-border rounded-lg border">
      {rows.slice(currentPage * 25, currentPage * 25 + 25).map((record) => <li key={record.item.id} className="flex flex-col items-stretch gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1"><h2 className="font-medium">{record.item.title.ru}</h2><p className="mt-1 break-all text-xs text-muted-foreground">{record.item.id}</p><div className="mt-2 flex gap-2"><Badge variant="outline">{record.archived ? 'Архив' : 'Активно'}</Badge>{'count' in record.item && <span className="text-xs text-muted-foreground">{record.item.count} дизайнов</span>}</div></div>
        <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEditor({ kind, record })}><Pencil aria-hidden="true" />Изменить<span className="sr-only"> {record.item.title.ru}</span></Button><Button variant="ghost" size="icon" aria-label={`${record.archived ? 'Восстановить' : 'Архивировать'} ${record.item.title.ru}`} onClick={() => setConfirmation(record)}>{record.archived ? <RotateCcw aria-hidden="true" /> : <Archive aria-hidden="true" />}</Button></div>
      </li>)}
    </ul> : <div className="rounded-lg border border-dashed p-12 text-center"><h2 className="font-medium">Записей нет</h2><p className="mt-2 text-sm text-muted-foreground">Измените поиск или добавьте новую запись.</p></div>}
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Страница {currentPage + 1} из {pages}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Предыдущая страница" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Следующая страница" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></div></div>
    {editor && data && <CatalogEditor editor={editor} collections={data.collections} session={session} close={() => setEditor(undefined)} saved={() => { setEditor(undefined); setNotice('Изменение сохранено. Обновите snapshot и пересоберите сайт.'); void load(); }} />}
    <Dialog open={!!confirmation} onOpenChange={(open) => { if (!open && !busy) setConfirmation(undefined); }}><DialogContent closeLabel="Закрыть"><DialogHeader><DialogTitle>{confirmation?.archived ? 'Восстановить запись?' : 'Архивировать запись?'}</DialogTitle><DialogDescription>{confirmation?.item.title.ru}. {confirmation?.archived ? 'Запись снова появится в следующей сборке.' : 'Запись будет скрыта из следующей сборки. Оценки и комментарии сохранятся.'}</DialogDescription></DialogHeader>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setConfirmation(undefined)} disabled={busy}>Отмена</Button><Button variant={confirmation?.archived ? 'default' : 'destructive'} onClick={archive} disabled={busy}>{busy ? 'Сохраняем…' : confirmation?.archived ? 'Восстановить' : 'Архивировать'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
