import type { Locale } from './catalog';

export const designCopy = {
  en: { view: 'View in 3D', loading: 'Loading 3D view…', failed: '3D view is unavailable. The wallpaper preview is still available.', retry: 'Try 3D again', left: 'Rotate left', right: 'Rotate right', reset: 'Reset view', scene: 'Phone and monitor showing the featured wallpaper' },
  ru: { view: 'Смотреть в 3D', loading: 'Загружаем 3D…', failed: '3D-просмотр недоступен. Обои можно посмотреть на превью.', retry: 'Повторить 3D-просмотр', left: 'Повернуть влево', right: 'Повернуть вправо', reset: 'Исходный ракурс', scene: 'Телефон и монитор с выбранными обоями' },
  'zh-cn': { view: '查看 3D', loading: '正在加载 3D 视图…', failed: '3D 视图暂不可用，您仍可查看壁纸预览。', retry: '重试 3D 视图', left: '向左旋转', right: '向右旋转', reset: '重置视角', scene: '展示精选壁纸的手机和显示器' },
  'pt-br': { view: 'Ver em 3D', loading: 'Carregando a visualização 3D…', failed: 'A visualização 3D está indisponível. A prévia do papel de parede continua disponível.', retry: 'Tentar 3D novamente', left: 'Girar à esquerda', right: 'Girar à direita', reset: 'Restaurar a vista', scene: 'Celular e monitor exibindo o papel de parede em destaque' },
} satisfies Record<Locale, Record<string, string>>;
