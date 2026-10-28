import { ContactCard } from '@want-foundation/desyst-react';
import { CodeXml, Mail, Send, Users } from 'lucide-react';
import { copy } from '@/data/copy';
import type { Locale } from '@/data/catalog';

export default function OwnerContact({ locale }: { locale: Locale }) {
  const name = copy[locale].owner;
  const emailTitle = copy[locale].contactEmail;
  const contacts = [
    { title: 'Telegram', detail: '@andrey_krasheninnikov', href: 'https://t.me/andrey_krasheninnikov', icon: Send, label: 'Telegram Andrey Krasheninnikov' },
    { title: 'Want Foundation', detail: '@want_foundation', href: 'https://t.me/want_foundation', icon: Users, label: 'Telegram Want Foundation' },
    { title: 'GitHub', detail: 'andrey-krasheninnikov', href: 'https://github.com/andrey-krasheninnikov', icon: CodeXml, label: 'GitHub Andrey Krasheninnikov' },
    { title: 'GitHub Project', detail: 'want-wallpapers', href: 'https://github.com/andrey-krasheninnikov/want-wallpapers', icon: CodeXml, label: 'GitHub Want Wallpapers' },
    { title: emailTitle, detail: 'wallpapers@want.foundation', href: 'mailto:wallpapers@want.foundation', icon: Mail, label: `${emailTitle} wallpapers@want.foundation` },
  ];
  return <ContactCard name={name} subtitle="Want Foundation" actions={contacts} data-owner-contact />;
}
