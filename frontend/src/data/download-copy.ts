import type { Locale } from './catalog';

export const downloadCopy = {
  en: { title: 'Advertisement', description: 'You can close the video and download your PNG now.', download: 'Download PNG', close: 'Close and download', loading: 'Loading video advertisement' },
  ru: { title: 'Реклама', description: 'Можно закрыть видео и сразу скачать PNG.', download: 'Скачать PNG', close: 'Закрыть и скачать', loading: 'Загружается видеореклама' },
  'zh-cn': { title: '广告', description: '您可以关闭视频并立即下载 PNG。', download: '下载 PNG', close: '关闭并下载', loading: '正在加载视频广告' },
  'pt-br': { title: 'Publicidade', description: 'Você pode fechar o vídeo e baixar o PNG agora.', download: 'Baixar PNG', close: 'Fechar e baixar', loading: 'Carregando anúncio em vídeo' },
  ja: { title: '広告', description: '動画を閉じて、すぐにPNGをダウンロードできます。', download: 'PNGをダウンロード', close: '閉じてダウンロード', loading: '動画広告を読み込み中' },
  ar: { title: 'إعلان', description: 'يمكنك إغلاق الفيديو وتنزيل ملف PNG الآن.', download: 'تنزيل PNG', close: 'إغلاق وتنزيل', loading: 'جارٍ تحميل إعلان الفيديو' },
} satisfies Record<Locale, { title: string; description: string; download: string; close: string; loading: string }>;
