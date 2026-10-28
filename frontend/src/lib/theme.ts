export type Theme = 'light' | 'dark';
let explicitTheme: Theme | undefined;

export function preferredTheme(): Theme {
  if (explicitTheme) return explicitTheme;
  try {
    const saved = localStorage.getItem('want-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: Theme) {
  explicitTheme = theme;
  applyTheme(theme);
  try { localStorage.setItem('want-theme', theme); } catch {}
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, target: Document = document) {
  target.documentElement.classList.toggle('dark', theme === 'dark');
  target.documentElement.dataset.theme = theme;
  target.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141414' : '#F6F5F3');
  if (target === document) document.dispatchEvent(new Event('want:theme-change'));
}
