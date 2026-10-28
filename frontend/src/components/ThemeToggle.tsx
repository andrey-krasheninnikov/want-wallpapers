import { trackProductEvent } from '@/lib/analytics';
import { useEffect, useState } from 'react';
import { ThemeToggle as SharedThemeToggle } from '@want-foundation/desyst-react';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';
import { currentTheme, saveTheme } from '@/lib/theme';

export default function ThemeToggle({ locale }: { locale: Locale }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const text = interfaceCopy[locale];
  useEffect(() => {
    const update = () => setTheme(currentTheme());
    update();
    document.addEventListener('want:theme-change', update);
    return () => document.removeEventListener('want:theme-change', update);
  }, []);

  return <SharedThemeToggle theme={theme} label={text.darkTheme}
    title={theme === 'dark' ? text.lightTheme : text.darkTheme} onThemeChange={(value) => {
      trackProductEvent('feature_action', { feature: 'theme', action: value });
      saveTheme(value);
    }} />;
}
