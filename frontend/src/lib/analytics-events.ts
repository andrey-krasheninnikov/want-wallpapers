export type Variant = 'desktop' | 'mobile';
export type Placement = 'hero' | 'scene' | 'home_mosaic' | 'collection_carousel' | 'story_carousel' | 'search' | 'collection' | 'related' | 'header' | 'footer' | 'detail' | 'content';
type Item = { item_id: string; collection_id?: string; category?: string; placement?: Placement; position?: number; variant?: Variant };
type Stage = 'attempt' | 'success' | 'error';
export type AnalyticsEvents = {
  page_view: Record<string, never>;
  navigation_click: { target_page: string; placement: Placement };
  card_view: Item & { content_type: 'wallpaper' | 'collection' | 'story' };
  content_select: Item & { content_type: 'wallpaper' | 'collection' | 'story' };
  wallpaper_view: Item;
  download_click: Item & { variant: Variant };
  wallpaper_download: { wallpaper: string; variant: Variant };
  variant_change: Item & { variant: Variant };
  wallpaper_navigate: { direction: 'previous' | 'next'; method: 'button' | 'keyboard' | 'swipe' };
  catalog_search: { category?: string; collection_id?: string; result_count: number; query_length: number; search_terms?: string };
  filter_change: { filter_type: 'category' | 'collection'; filter_id?: string };
  search_reset: Record<string, never>;
  rating_action: { item_id: string; stage: Stage; rating?: 'cringe' | 'minus' | 'plus' | 'imba'; error_code?: string };
  comment_action: { item_id: string; stage: Stage; action: 'submit' | 'delete' | 'report'; error_code?: string };
  feedback_action: { stage: 'open' | 'start' | Stage; error_code?: string };
  feature_action: { feature: 'menu' | 'scene' | 'cover' | 'mosaic' | 'carousel' | 'story' | 'faq' | 'background' | 'theme' | 'language'; action: 'play' | 'pause' | 'rotate' | 'reset' | 'retry' | 'open' | 'close' | 'previous' | 'next' | 'light' | 'dark' | 'select'; item_id?: string };
  section_view: { section: string };
  outbound_click: { destination: 'github' | 'email' | 'website'; placement?: Placement };
  telegram_click: { destination: 'channel' | 'author' | 'foundation' | 'emoji'; placement?: Placement };
  advertising_stage: { placement: 'top' | 'content' | 'footer' | 'video'; stage: 'request' | 'container_ready' | 'error' | 'play' | 'complete' | 'dismiss' };
  media_error: { media: 'image' | 'model' | 'cover' | 'gallery' };
  web_vital: { metric_name: 'LCP' | 'INP' | 'CLS'; metric_value: number; rating: 'good' | 'needs-improvement' | 'poor' };
};
export type AnalyticsEventName = keyof AnalyticsEvents;
export type AnalyticsParameters = Record<string, string | number>;
const names = new Set<AnalyticsEventName>(['page_view', 'navigation_click', 'card_view', 'content_select', 'wallpaper_view', 'download_click', 'wallpaper_download', 'variant_change', 'wallpaper_navigate', 'catalog_search', 'filter_change', 'search_reset', 'rating_action', 'comment_action', 'feedback_action', 'feature_action', 'section_view', 'outbound_click', 'telegram_click', 'advertising_stage', 'media_error', 'web_vital']);
const values: Record<string, readonly string[]> = {
  variant: ['desktop', 'mobile'], placement: ['hero', 'scene', 'home_mosaic', 'collection_carousel', 'story_carousel', 'search', 'collection', 'related', 'header', 'footer', 'detail', 'content', 'top', 'video'],
  content_type: ['wallpaper', 'collection', 'story'], direction: ['previous', 'next'], method: ['button', 'keyboard', 'swipe'],
  filter_type: ['category', 'collection'], stage: ['attempt', 'success', 'error', 'open', 'start', 'request', 'container_ready', 'play', 'complete', 'dismiss'],
  action: ['submit', 'delete', 'report', 'play', 'pause', 'rotate', 'reset', 'retry', 'open', 'close', 'previous', 'next', 'light', 'dark', 'select'],
  feature: ['menu', 'scene', 'cover', 'mosaic', 'carousel', 'story', 'faq', 'background', 'theme', 'language'],
  destination: ['github', 'email', 'website', 'channel', 'author', 'foundation', 'emoji'],
  rating: ['cringe', 'minus', 'plus', 'imba', 'good', 'needs-improvement', 'poor'],
  error_code: ['request_failed', 'validation', 'unavailable', 'captcha', 'rate_limited', 'unauthorized'], media: ['image', 'model', 'cover', 'gallery'], metric_name: ['LCP', 'INP', 'CLS'],
};
const idKeys = new Set(['item_id', 'wallpaper', 'collection_id', 'category', 'filter_id', 'section', 'target_page']);
const numberKeys = new Set(['position', 'result_count', 'query_length', 'metric_value']);
export const analyticsId = (value: unknown): value is string => typeof value === 'string' && value.length <= 80 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value);

export function sanitizeAnalyticsEvent(name: string, parameters: unknown): AnalyticsParameters | null {
  if (!names.has(name as AnalyticsEventName) || !parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return null;
  const safe: AnalyticsParameters = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined) continue;
    if (idKeys.has(key) && analyticsId(value)) safe[key] = value;
    else if (Object.hasOwn(values, key) && typeof value === 'string' && values[key].includes(value)) safe[key] = value;
    else if (numberKeys.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000000) safe[key] = value;
    else if (key === 'search_terms' && typeof value === 'string' && value.length <= 100 && value.split(',').every(analyticsId)) safe[key] = value;
    else return null;
  }
  if (name === 'wallpaper_download' && (!analyticsId(safe.wallpaper) || !['desktop', 'mobile'].includes(String(safe.variant)))) return null;
  return safe;
}

export function analyticsPage(path: string) {
  const localized = path.replace(/^\/(ru|zh-cn|pt-br|ja|ar)(?=\/)/, '');
  const type = localized === '/' ? 'home' : localized.split('/')[1];
  const fixed = ['search', 'collections', 'feedback', 'privacy', 'terms', 'cookies', 'license', 'contact', '404'];
  const valid = localized === '/' || /^\/(wallpapers|collections|tags|categories)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(localized)
    || fixed.some(value => localized === `/${value}/`);
  return { path: valid ? path : '/404/', type: valid ? type! : '404' };
}

export function analyticsContext(path: string, locale: string, origin: string, referrer: string): AnalyticsParameters {
  const page = analyticsPage(path);
  let previous = '';
  try { const url = new URL(referrer); if (['http:', 'https:'].includes(url.protocol)) previous = url.origin + '/'; } catch { /* No referrer is a valid direct visit. */ }
  return { page_location: origin + page.path, page_referrer: previous, page_title: page.type, page_type: page.type,
    locale: ['en', 'ru', 'zh-cn', 'pt-br', 'ja', 'ar'].includes(locale) ? locale : 'en' };
}

export function recognizedSearchTerms(query: string, entries: readonly { value: string; title: string }[], locale: string): string | undefined {
  const normalized = query.slice(0, 500).normalize('NFKC').toLocaleLowerCase(locale).trim();
  const terms: string[] = [];
  for (const entry of entries) {
    if (!analyticsId(entry.value) || terms.includes(entry.value)) continue;
    const title = entry.title.normalize('NFKC').toLocaleLowerCase(locale).trim();
    const index = normalized.indexOf(title);
    if (!title || index < 0 || /[\p{L}\p{N}]/u.test(normalized[index - 1] ?? '') || /[\p{L}\p{N}]/u.test(normalized[index + title.length] ?? '')) continue;
    if ([...terms, entry.value].join(',').length > 100) continue;
    terms.push(entry.value);
    if (terms.length === 3) break;
  }
  return terms.length ? terms.join(',') : undefined;
}

export function analyticsMetadata(value: string | undefined): AnalyticsParameters {
  const [collection, category] = value?.split('/') ?? [];
  return analyticsId(collection) && analyticsId(category) ? { collection_id: collection, category } : {};
}
