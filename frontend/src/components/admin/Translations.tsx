import { Input } from '@want-foundation/desyst-react';
import { Textarea } from '@want-foundation/desyst-react';
import { Field, FieldLabel } from '@want-foundation/desyst-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@want-foundation/desyst-react';
import { locales, localeDirection, type Locale, type Localized } from '@/data/catalog';
const labels = { en: 'English', ru: 'Русский', 'zh-cn': '中文', 'pt-br': 'Português', ja: '日本語', ar: 'العربية' };
export function emptyTranslations(): Localized { return { en: '', ru: '', 'zh-cn': '', 'pt-br': '', ja: '', ar: '' }; }
export default function Translations({ title, description, change, locale, setLocale }: { title: Localized; description: Localized; change: (field: 'title' | 'description', locale: Locale, value: string) => void; locale: Locale; setLocale: (locale: Locale) => void }) {
  return <Tabs value={locale} onValueChange={(value) => setLocale(value as Locale)} className="mt-5">
    <TabsList className="h-auto! w-full flex-wrap" aria-label="Язык перевода">{locales.map((locale) => <TabsTrigger key={locale} value={locale} lang={locale} className="min-h-11">{labels[locale]}</TabsTrigger>)}</TabsList>
    {locales.map((locale) => <TabsContent key={locale} value={locale} className="space-y-4 pt-3">
      <Field><FieldLabel htmlFor={`title-${locale}`}>Название · {labels[locale]}</FieldLabel><Input id={`title-${locale}`} lang={locale} dir={localeDirection(locale)} value={title[locale] ?? ''} maxLength={200} onChange={(event) => change('title', locale, event.target.value)} /></Field>
      <Field><FieldLabel htmlFor={`description-${locale}`}>Описание · {labels[locale]}</FieldLabel><Textarea id={`description-${locale}`} lang={locale} dir={localeDirection(locale)} value={description[locale] ?? ''} maxLength={2000} rows={4} onChange={(event) => change('description', locale, event.target.value)} /></Field>
    </TabsContent>)}
  </Tabs>;
}
