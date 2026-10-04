import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import RecaptchaNotice from '@/components/RecaptchaNotice';
import { errorText } from './client';
export default function Login() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const { recaptchaHeaders } = await import('@/lib/recaptcha-client');
      const headers = await recaptchaHeaders('admin_login');
      await api('/admin/login', { method: 'POST', headers, body: JSON.stringify({ username: form.get('username'), password: form.get('password'), code: form.get('code') }) });
      window.location.assign('/admin/');
    } catch (error) {
      setError(error instanceof Error && error.message === 'unauthorized' ? 'Не удалось войти. Проверьте логин, пароль и текущий код.' : errorText(error));
    } finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
    <a href="/" className="w-fit text-sm text-muted-foreground hover:text-foreground">Want Wallpapers</a>
    <div><LockKeyhole className="mb-4 size-7 text-primary" aria-hidden="true" /><h1 className="text-3xl font-semibold tracking-tight">Вход в управление</h1><p className="mt-3 text-muted-foreground">Каталог, комментарии и обращения.</p></div>
    <form className="space-y-5" onSubmit={submit} aria-busy={busy}>
      <Field><FieldLabel htmlFor="username">Логин</FieldLabel><Input id="username" name="username" autoComplete="username" required maxLength={100} autoFocus /></Field>
      <Field><FieldLabel htmlFor="password">Пароль</FieldLabel><Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} /></Field>
      <Field><FieldLabel htmlFor="code">Код аутентификатора</FieldLabel><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /><FieldDescription>Шесть цифр из приложения аутентификатора.</FieldDescription></Field>
      <FieldError>{error}</FieldError><Button type="submit" className="w-full" disabled={busy}>{busy ? 'Проверяем…' : 'Войти'}</Button>
      <RecaptchaNotice locale="ru" />
    </form>
  </main>;
}
