import { useEffect, useState } from 'react';
import { Images, MessageSquare, Flag, Inbox, LogOut, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { adminApi, errorText, type AdminSession } from './client';
import Catalog from './Catalog';
import Moderation from './Moderation';
const sections = [{ id: 'catalog', label: 'Каталог', icon: Images }, { id: 'comments', label: 'Комментарии', icon: MessageSquare }, { id: 'reports', label: 'Жалобы', icon: Flag }, { id: 'feedback', label: 'Обращения', icon: Inbox }] as const;
type Section = typeof sections[number]['id'];
export default function AdminApp() {
  const [session, setSession] = useState<AdminSession>(), [error, setError] = useState(''), [section, setSection] = useState<Section>('catalog');
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    if (sections.some((s) => s.id === requested)) setSection(requested as Section);
    api<AdminSession>('/admin/session').then(setSession).catch((error) => {
      if (error instanceof Error && error.message === 'unauthorized') window.location.replace('/admin/login/'); else setError(errorText(error));
    });
  }, []);
  async function logout() {
    if (!session) return; setExiting(true);
    try { await adminApi(session, '/logout', 'POST'); window.location.assign('/admin/login/'); } catch (error) { setError(errorText(error)); setExiting(false); }
  }
  function navigate(next: Section) { setSection(next); history.replaceState(null, '', `/admin/?section=${next}`); }
  return <div className="mx-auto min-h-dvh max-w-[1440px] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="border-b border-border p-5 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:p-7">
      <a href="/admin/" className="block text-lg font-semibold tracking-tight">Want Wallpapers</a><p className="mt-1 text-xs text-muted-foreground">Управление сайтом</p>
      <nav aria-label="Разделы управления" className="mt-6 grid grid-cols-2 gap-2 pb-2 sm:flex sm:flex-wrap lg:flex-col">
        {sections.map(({ id, label, icon: Icon }) => <Button key={id} variant={section === id ? 'secondary' : 'ghost'} className="justify-start px-2 sm:px-3" aria-current={section === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon aria-hidden="true" />{label}</Button>)}
      </nav>
      <div className="mt-5 flex flex-wrap gap-2 lg:absolute lg:bottom-7 lg:left-7 lg:flex-col">
        <Button variant="ghost" asChild><a href="/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Открыть сайт</a></Button>
        <Button variant="ghost" onClick={logout} disabled={!session || exiting}><LogOut aria-hidden="true" />Выйти</Button>
      </div>
    </aside>
    <main className="min-w-0 p-5 sm:p-8 lg:p-10">
      <div className="mb-8 flex items-center justify-between gap-4"><h1 className="text-3xl font-semibold tracking-tight">{sections.find((s) => s.id === section)?.label}</h1><span className="text-sm text-muted-foreground">{session?.username}</span></div>
      {error && <Alert variant="destructive" className="mb-6"><AlertDescription>{error}<Button variant="outline" onClick={() => window.location.reload()}>Повторить</Button></AlertDescription></Alert>}
      {!session && !error && <div role="status" aria-label="Загрузка" className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-72 w-full" /></div>}
      {session && (section === 'catalog' ? <Catalog session={session} /> : <Moderation key={section} kind={section} session={session} />)}
    </main>
  </div>;
}
