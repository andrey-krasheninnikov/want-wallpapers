export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.code ?? 'unavailable');
  return result as T;
}
let visitorSession: Promise<{ csrf: string; uid: string }> | undefined;
export async function visitorMutation<T>(path: string, method: string, body?: unknown): Promise<T> {
  const session = await (visitorSession ??= api('/session', { method: 'POST' }).catch((error) => { visitorSession = undefined; throw error; }) as Promise<{ csrf: string; uid: string }>);
  return api<T>(path, { method, headers: { 'X-CSRF-Token': session.csrf }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
