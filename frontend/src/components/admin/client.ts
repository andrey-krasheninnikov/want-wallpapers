import { api } from '@/lib/api-client';
export type AdminSession = { csrf: string; username: string };
export type RecordItem<T> = { item: T; version: number; archived: boolean };
export function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return ({ conflict: 'Запись уже изменена. Обновите список и повторите действие.', 'invalid-input': 'Проверьте поля и переводы на всех четырёх языках.', unauthorized: 'Сессия завершена. Войдите снова.', 'rate-limited': 'Слишком много попыток. Попробуйте позднее.', unavailable: 'Сервер недоступен. Введённые данные сохранены в форме.' } as Record<string, string>)[code] ?? 'Не удалось выполнить действие. Попробуйте ещё раз.';
}
export async function adminApi<T>(session: AdminSession, path: string, method = 'GET', body?: unknown): Promise<T> {
  try { return await api<T>(`/admin${path}`, { method, headers: { 'X-CSRF-Token': session.csrf }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch (error) { if (error instanceof Error && error.message === 'unauthorized') window.location.assign('/admin/login/'); throw error; }
}
