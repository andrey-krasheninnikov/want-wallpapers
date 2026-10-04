import { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { WallpaperGrid, type WallpaperCardData } from '@/components/Gallery';
import { createSearchIndex } from '@/lib/catalog-search';
import { filterWallpapers } from '@/lib/search-client';
import { copy } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';

export default function CatalogSearch({ locale, items, categories, collections }: {
  locale: Locale; items: WallpaperCardData[]; categories: { value: string; title: string }[]; collections: { value: string; title: string }[];
}) {
  const ui = copy[locale];
  const text = interfaceCopy[locale];
  const [q, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [collection, setCollection] = useState('');
  const [ready, setReady] = useState(false);
  const index = useMemo(() => {
    try { return createSearchIndex(locale, items.map((item) => ({ id: item.id, text: item.searchText }))); }
    catch { return undefined; }
  }, [items, locale]);
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get('q') ?? '');
      setCategory(categories.some((item) => item.value === params.get('category')) ? params.get('category')! : '');
      setCollection(collections.some((item) => item.value === params.get('collection')) ? params.get('collection')! : '');
    };
    read(); setReady(true);
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [categories, collections]);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', q.trim()], ['category', category], ['collection', collection]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }, [q, category, collection, ready]);
  const results = filterWallpapers(items, locale, { q, category, collection }, index);
  const active = Boolean(q || category || collection);
  function reset() { setQuery(''); setCategory(''); setCollection(''); }
  return <div>
    <Card className="gap-0 py-0 shadow-none"><CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Field className="min-w-0 sm:col-span-2 lg:col-span-1"><FieldLabel htmlFor="search-query">{ui.search}</FieldLabel><div className="relative"><Search className="pointer-events-none absolute top-4 left-3 size-4 text-muted-foreground" aria-hidden="true" /><Input id="search-query" type="search" placeholder={ui.searchPlaceholder} value={q} onChange={(event) => setQuery(event.target.value)} autoComplete="off" className="pl-10" /></div></Field>
      <Field className="min-w-0"><FieldLabel htmlFor="search-category">{ui.category}</FieldLabel><Select value={category || 'all'} onValueChange={(value) => setCategory(value === 'all' ? '' : value)}><SelectTrigger id="search-category" className="min-h-12 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{ui.all}</SelectItem>{categories.map((item) => <SelectItem key={item.value} value={item.value}>{item.title}</SelectItem>)}</SelectContent></Select></Field>
      <Field className="min-w-0"><FieldLabel htmlFor="search-collection">{ui.collection}</FieldLabel><Select value={collection || 'all'} onValueChange={(value) => setCollection(value === 'all' ? '' : value)}><SelectTrigger id="search-collection" className="min-h-12 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{ui.all}</SelectItem>{collections.map((item) => <SelectItem key={item.value} value={item.value}>{item.title}</SelectItem>)}</SelectContent></Select></Field>
    </CardContent></Card>
    <div className="my-6 flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{results.length} {ui.results}</p>{active && <Button variant="ghost" onClick={reset}><RotateCcw aria-hidden="true" />{text.reset}</Button>}</div>
    {active && <div className="mb-6 flex flex-wrap gap-2">{q.trim() && <Badge variant="secondary" className="max-w-full py-2 whitespace-normal wrap-anywhere">{q.trim()}</Badge>}{category && <Badge variant="secondary" className="py-2">{categories.find((item) => item.value === category)?.title}</Badge>}{collection && <Badge variant="secondary" className="py-2">{collections.find((item) => item.value === collection)?.title}</Badge>}</div>}
    {results.length ? <WallpaperGrid items={results} headingLevel={2} /> : <Card className="border-dashed py-0 shadow-none"><CardContent className="grid justify-items-start gap-4 p-6 sm:p-8"><p className="text-base leading-relaxed text-muted-foreground">{ui.noResults}</p><Button variant="outline" onClick={reset}>{text.reset}</Button></CardContent></Card>}
  </div>;
}
