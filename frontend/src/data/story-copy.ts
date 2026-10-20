import type { Locale } from './catalog';

export const storyCopy = {
  en: { title: 'Stories from the collections', previous: 'Previous stories', next: 'Next stories', loading: 'Loading the story…', failed: 'The story could not load. Open the collection to read it.' },
  ru: { title: 'Истории коллекций', previous: 'Предыдущие истории', next: 'Следующие истории', loading: 'Загружаем историю…', failed: 'Не удалось загрузить историю. Прочитайте её на странице коллекции.' },
  'zh-cn': { title: '系列中的故事', previous: '上一组故事', next: '下一组故事', loading: '正在加载故事…', failed: '故事加载失败，请打开系列页面阅读。' },
  'pt-br': { title: 'Histórias das coleções', previous: 'Histórias anteriores', next: 'Próximas histórias', loading: 'Carregando a história…', failed: 'Não foi possível carregar a história. Abra a coleção para ler.' },
} satisfies Record<Locale, Record<string, string>>;
