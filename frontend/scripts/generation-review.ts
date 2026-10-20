import type { Run } from './generation-store';
import { locales } from '../src/data/catalog';

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export function reviewFields(run: Run & { spentPollen: number; reservedPollen: number }, origin: string) {
  const state: Record<string, string> = { queued: 'Ожидает выполнения', generating: 'Генерация', review: 'Готов к проверке', approved: 'Одобрен', blocked: 'Остановлен', cancelled: 'Отменён', rejected: 'Отклонён' };
  const media = (variant: string, preview: boolean) => `${origin}/webhook/collection-draft-media?runId=${run.runId}&version=${run.version}&variant=${variant}&preview=${preview}`;
  let html = `<p>${escape(run.collectionId)}. Версия ${run.version}. ${state[run.status] ?? 'Неизвестное состояние'}.</p><p>Расход: ${run.spentPollen} Pollen; резерв: ${run.reservedPollen}. Изображения: ${run.imageAttempts}/14, дополнительные: ${run.extraImageAttempts}/4. Текст: ${run.textAttempts}/2.</p>`;
  if (run.errorCode) html += `<p>Остановка: ${escape(run.errorCode)}.</p>`;
  if (run.manifest) {
    for (const locale of locales) html += `<h2>${locale}: ${escape(run.manifest.collection.title[locale] ?? 'Перевод отсутствует')}</h2><p>${escape(run.manifest.collection.description[locale] ?? 'Перевод отсутствует')}</p>`;
    for (const wallpaper of run.manifest.wallpapers) {
      html += `<h2>Дизайн ${wallpaper.number}</h2>`;
      for (const variant of ['desktop', 'mobile']) {
        const name = `${wallpaper.number}-${variant}`;
        if (run.assets[name]) html += `<img src="${media(name, true)}" alt="${escape(wallpaper.title.ru)}: ${variant}" width="${variant === 'desktop' ? 960 : 540}" height="${variant === 'desktop' ? 540 : 960}"><p><a href="${media(name, false)}">Оригинал ${variant} PNG</a></p>`;
      }
      for (const locale of locales) html += `<h3>${locale}: ${escape(wallpaper.title[locale] ?? 'Перевод отсутствует')}</h3><p>${escape(wallpaper.description[locale] ?? 'Перевод отсутствует')}</p>`;
    }
  }
  if (run.approval) html += `<p><a href="${origin}/webhook/collection-draft-media?runId=${run.runId}&version=${run.version}&package=true">Скачать одобренный пакет</a></p>`;
  html += '<p>Одобрение подтверждает изображения и тексты. Публичная публикация требует отдельного подтверждения прав.</p>';
  return [
    { fieldType: 'html', html },
    { fieldLabel: 'Run', fieldName: 'runId', fieldType: 'hiddenField', fieldValue: run.runId },
    { fieldLabel: 'Version', fieldName: 'version', fieldType: 'hiddenField', fieldValue: String(run.version) },
    { fieldLabel: 'Package', fieldName: 'packageHash', fieldType: 'hiddenField', fieldValue: run.packageHash ?? '' },
    { fieldLabel: 'Действие', fieldName: 'action', fieldType: 'radio', requiredField: true,
      fieldOptions: { values: ['Одобрить', 'Запросить правки', 'Отклонить', 'Отменить', 'Возобновить'].map(option => ({ option })) } },
    { fieldLabel: 'Проверка содержания', fieldName: 'contentChecked', fieldType: 'checkbox', fieldOptions: { values: [{ option: 'Пять разных дизайнов, сцена совпадает в каждой паре, все переводы соответствуют изображениям' }] } },
    { fieldLabel: 'Варианты для правки', fieldName: 'variants', fieldType: 'checkbox', fieldOptions: { values: Array.from({ length: 5 }, (_, index) => ['desktop', 'mobile'].map(variant => ({ option: `${index + 1}-${variant}` }))).flat() } },
    { fieldLabel: 'Тексты', fieldName: 'texts', fieldType: 'checkbox', fieldOptions: { values: [{ option: 'Исправить тексты' }] } },
    { fieldLabel: 'Замечание для правок', fieldName: 'feedback', fieldType: 'textarea' },
  ];
}
