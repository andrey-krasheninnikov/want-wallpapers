import { ArrowUpRight, CodeXml, Send, Users } from 'lucide-react';
import { copy } from '@/data/copy';
import type { Locale } from '@/data/catalog';

export default function OwnerContact({ locale }: { locale: Locale }) {
  const name = copy[locale].owner;
  const contacts = [
    { title: 'Telegram', detail: '@andrey_krasheninnikov', href: 'https://t.me/andrey_krasheninnikov', icon: Send, label: 'Telegram Andrey Krasheninnikov' },
    { title: 'Want Foundation', detail: '@want_foundation', href: 'https://t.me/want_foundation', icon: Users, label: 'Telegram Want Foundation' },
    { title: 'GitHub', detail: 'andrey-krasheninnikov', href: 'https://github.com/andrey-krasheninnikov', icon: CodeXml, label: 'GitHub Andrey Krasheninnikov' },
  ];
  return <div className="contact-card" data-owner-contact>
    <div className="contact-identity"><span className="contact-avatar" aria-hidden="true">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{name}</strong><small>Want Foundation</small></div></div>
    <div className="contact-actions">{contacts.map(({ title, detail, href, icon: Icon, label }) => <a key={href} className="contact-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon aria-hidden="true" /><span>{title}<small>{detail}</small></span><ArrowUpRight className="contact-arrow" aria-hidden="true" /></a>)}</div>
  </div>;
}
