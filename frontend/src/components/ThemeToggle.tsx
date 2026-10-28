import { trackProductEvent } from '@/lib/analytics';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';
import { currentTheme, saveTheme } from '@/lib/theme';

export default function ThemeToggle({ locale }: { locale: Locale }) {
  const [dark, setDark] = useState(true);
  const text = interfaceCopy[locale];
  useEffect(() => {
    const update = () => setDark(currentTheme() === 'dark');
    update();
    document.addEventListener('want:theme-change', update);
    return () => document.removeEventListener('want:theme-change', update);
  }, []);

  return <span className="theme-switch" dir="ltr">
    <Switch className="theme-toggle" checked={dark} aria-label={text.darkTheme}
      title={dark ? text.lightTheme : text.darkTheme} onCheckedChange={(checked) => {
        const theme = checked ? 'dark' : 'light';
        trackProductEvent('feature_action', { feature: 'theme', action: theme });
        saveTheme(theme);
      }} />
    <Sun className="theme-symbol theme-sun" aria-hidden="true" />
    <Moon className="theme-symbol theme-moon" aria-hidden="true" />
  </span>;
}
