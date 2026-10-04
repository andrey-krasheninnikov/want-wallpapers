import { api } from './api-client';

export type RecaptchaAction = 'rating' | 'comment' | 'comment_delete' | 'comment_report' | 'feedback' | 'admin_login';
type Enterprise = { ready(callback: () => void): void; execute(key: string, options: { action: RecaptchaAction }): Promise<string> };
declare global { interface Window { grecaptcha?: { enterprise: Enterprise } } }
let configuration: Promise<{ enabled: boolean; siteKey: string | null }> | undefined;
let loader: Promise<Enterprise> | undefined;
function load(key: string): Promise<Enterprise> {
  return loader ??= new Promise<Enterprise>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(), 10000);
    function fail() { clearTimeout(timer); script.remove(); reject(new Error('recaptcha-unavailable')); }
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      const enterprise = window.grecaptcha?.enterprise;
      if (!enterprise) { fail(); return; }
      enterprise.ready(() => { clearTimeout(timer); resolve(enterprise); });
    };
    document.head.append(script);
  }).catch((error) => { loader = undefined; throw error; });
}
export async function recaptchaHeaders(action: RecaptchaAction): Promise<Record<string, string>> {
  const config = await (configuration ??= api<{ enabled: boolean; siteKey: string | null }>('/recaptcha/config')
    .catch((error) => { configuration = undefined; throw error; }));
  if (!config.enabled) return {};
  if (!config.siteKey) throw new Error('recaptcha-unavailable');
  const enterprise = await load(config.siteKey);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await Promise.race([
      enterprise.execute(config.siteKey, { action }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('recaptcha-unavailable')), 10000); }),
    ]);
    if (!token) throw new Error('recaptcha-unavailable');
    return { 'X-ReCAPTCHA-Token': token };
  } catch { throw new Error('recaptcha-unavailable'); }
  finally { clearTimeout(timer); }
}
