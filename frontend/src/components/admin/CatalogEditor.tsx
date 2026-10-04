import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { locales, categoryLabels, tagLabels, type Collection, type Wallpaper, type Locale } from '@/data/catalog';
import { adminApi, errorText, type AdminSession, type RecordItem } from './client';
import Translations, { emptyTranslations } from './Translations';
export type Editor = { kind: 'collections' | 'wallpapers'; record?: RecordItem<Collection | Wallpaper> };
export default function CatalogEditor({ editor, collections, session, close, saved }: { editor: Editor; collections: RecordItem<Collection>[]; session: AdminSession; close: () => void; saved: () => void }) {
  const first = collections.find((record) => !record.archived)?.item;
  const blankCollection: Collection = { id: '', slug: '', count: 0, title: emptyTranslations(), description: emptyTranslations() };
  const blankWallpaper: Wallpaper = { id: '', slug: '', collection: first?.slug ?? '', collectionId: first?.id ?? '', s3Folder: first?.id ?? '', fileStem: first?.slug ?? '', number: 1, category: 'abstract', tags: ['light'], title: emptyTranslations(), description: emptyTranslations() };
  const [item, setItem] = useState<Collection | Wallpaper>(() => structuredClone(editor.record?.item ?? (editor.kind === 'collections' ? blankCollection : blankWallpaper)));
  const [folderNumber, setFolderNumber] = useState(item.id.split('-')[0] ?? ''), [locale, setLocale] = useState<Locale>('ru');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false);
  const existing = !!editor.record, wallpaper = 'number' in item ? item : undefined;
  function change(values: Partial<Collection | Wallpaper>) { setItem((item) => ({ ...item, ...values } as Collection | Wallpaper)); setDirty(true); }
  function requestClose() { if (busy) return; if (dirty) setDiscard(true); else close(); }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const missing = locales.find((locale) => !item.title[locale].trim() || !item.description[locale].trim());
    if (missing) { setLocale(missing); setError('Заполните название и описание на всех четырёх языках.'); return; }
    let value = item;
    if (!existing) {
      if (wallpaper) value = { ...wallpaper, id: `${wallpaper.collection}-${wallpaper.number}`, slug: `${wallpaper.collection}-${wallpaper.number}` };
      else value = { ...item, id: `${folderNumber}-${item.slug}` };
    }
    setBusy(true);
    try { await adminApi(session, `/catalog/${editor.kind}`, 'PUT', { item: value, version: editor.record?.version ?? null }); saved(); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <><Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}><DialogContent closeLabel="Закрыть" className="sm:max-w-2xl" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{existing ? 'Редактировать' : 'Добавить'} {wallpaper ? 'обои' : 'коллекцию'}</DialogTitle><DialogDescription>{existing ? 'Адреса и CDN-ссылки сохраняются.' : 'Используйте номер и название существующей папки CDN.'}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5">
      {wallpaper ? <>
        <Field><FieldLabel htmlFor="collection">Коллекция</FieldLabel><Select disabled={existing} value={wallpaper.collectionId} onValueChange={(id) => { const collection = collections.find((c) => c.item.id === id)!.item; change({ collectionId: id, collection: collection.slug, s3Folder: id, fileStem: collection.slug }); }}><SelectTrigger id="collection" className="w-full"><SelectValue placeholder="Выберите коллекцию" /></SelectTrigger><SelectContent>{collections.filter((c) => !c.archived).map((c) => <SelectItem key={c.item.id} value={c.item.id}>{c.item.title.ru}</SelectItem>)}</SelectContent></Select></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="number">Номер дизайна</FieldLabel><Input id="number" type="number" min={1} step={1} required disabled={existing} value={wallpaper.number} onChange={(event) => change({ number: Number(event.target.value) })} /></Field>
          <Field><FieldLabel htmlFor="category">Категория</FieldLabel><Select value={wallpaper.category} onValueChange={(category) => change({ category: category as Wallpaper['category'] })}><SelectTrigger id="category" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([id, label]) => <SelectItem key={id} value={id}>{label.ru}</SelectItem>)}</SelectContent></Select></Field></div>
        <fieldset><legend className="mb-3 text-sm font-medium">Теги · минимум один</legend><div className="flex flex-wrap gap-3">{Object.entries(tagLabels).map(([id, label]) => <label key={id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={wallpaper.tags.includes(id as Wallpaper['tags'][number])} onChange={(event) => change({ tags: event.target.checked ? [...wallpaper.tags, id as Wallpaper['tags'][number]] : wallpaper.tags.filter((tag) => tag !== id) })} />{label.ru}</label>)}</div></fieldset>
        <FieldDescription>CDN: {wallpaper.s3Folder}/{wallpaper.number}-desktop.png и -mobile.png</FieldDescription>
      </> : <div className="grid gap-4 sm:grid-cols-2">
        <Field><FieldLabel htmlFor="folder-number">Номер папки CDN</FieldLabel><Input id="folder-number" value={folderNumber} disabled={existing} pattern="[0-9]+" required onChange={(event) => { setFolderNumber(event.target.value); setDirty(true); }} placeholder="0004" /></Field>
        <Field><FieldLabel htmlFor="slug">Slug</FieldLabel><Input id="slug" value={item.slug} disabled={existing} pattern="[a-z0-9]+(-[a-z0-9]+)*" required onChange={(event) => change({ slug: event.target.value })} placeholder="quiet-light" /></Field>
      </div>}
      <Translations title={item.title} description={item.description} locale={locale} setLocale={setLocale} change={(field, locale, value) => change({ [field]: { ...item[field], [locale]: value } })} />
      <FieldError>{error}</FieldError><DialogFooter><Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
  <Dialog open={discard} onOpenChange={setDiscard}><DialogContent closeLabel="Закрыть"><DialogHeader><DialogTitle>Закрыть без сохранения?</DialogTitle><DialogDescription>Введённые изменения будут потеряны.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscard(false)}>Продолжить редактирование</Button><Button variant="destructive" onClick={close}>Закрыть</Button></DialogFooter></DialogContent></Dialog></>;
}
