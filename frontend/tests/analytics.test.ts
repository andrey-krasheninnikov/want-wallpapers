import { expect, test } from 'bun:test';
import { analyticsContext, analyticsPage, sanitizeAnalyticsEvent, recognizedSearchTerms, analyticsMetadata } from '../src/lib/analytics-events';

test('download contract preserves names and accepts only bounded public metadata', () => {
  expect(sanitizeAnalyticsEvent('wallpaper_download', { wallpaper: 'neon-tide-7', variant: 'mobile' })).toEqual({ wallpaper: 'neon-tide-7', variant: 'mobile' });
  for (const parameters of [undefined, {}, { wallpaper: 'email@example.com', variant: 'mobile' }, { wallpaper: 'neon-tide-7', variant: 'original' }, { wallpaper: 'neon-tide-7', variant: 'desktop', email: 'private@example.com' }]) expect(sanitizeAnalyticsEvent('wallpaper_download', parameters)).toBeNull();
  expect(sanitizeAnalyticsEvent('arbitrary_event', {})).toBeNull();
});

test('arbitrary text, error objects and nonfinite metrics never enter event parameters', () => {
  for (const parameters of [{ message: 'private' }, { error_code: 'private request contents' }, { query: 'private search' }, { metric_value: Infinity }, { metric_value: -1 }, { search_terms: 'email@example.com' }]) expect(sanitizeAnalyticsEvent('catalog_search', parameters)).toBeNull();
  expect(sanitizeAnalyticsEvent('catalog_search', { query_length: 24, result_count: 0, search_terms: 'neon-tide,abstract' })).toEqual({ query_length: 24, result_count: 0, search_terms: 'neon-tide,abstract' });
});

test('analytics URLs remove queries, fragments and unrecognized routes', () => {
  expect(analyticsContext('/ru/wallpapers/neon-tide-7/', 'ru', 'https://wallpapers.want.foundation', 'https://example.com/private?email=user@example.com#secret')).toEqual({ page_location: 'https://wallpapers.want.foundation/ru/wallpapers/neon-tide-7/', page_referrer: 'https://example.com/', page_title: 'wallpapers', page_type: 'wallpapers', locale: 'ru' });
  for (const path of ['/search/?q=private', '/unknown/private/', '/admin/login/', '/ui-kit/']) expect(analyticsPage(path).path).toBe('/404/');
  expect(analyticsContext('/', 'unknown', 'https://wallpapers.want.foundation', 'javascript:alert(1)').page_referrer).toBe('');
});

test('recognized searches contain only whole public terms within the parameter budget', () => {
  const terms = [{ value: 'blue', title: 'Blue' }, { value: 'neon-tide', title: 'Neon Tide' }];
  expect(recognizedSearchTerms('BLUE user@example.com neon tide', terms, 'en')).toBe('blue,neon-tide');
  expect(recognizedSearchTerms('unblue user@example.com', terms, 'en')).toBeUndefined();
  const long = Array.from({ length: 8 }, (_, index) => ({ value: 'a'.repeat(60) + index, title: 'word' + index }));
  expect(recognizedSearchTerms(long.map(term => term.title).join(' '), long, 'en')).toBe(long[0].value);
});

test('compact metadata and inherited object keys cannot expose arbitrary data', () => {
  expect(analyticsMetadata('neon-tide/abstract')).toEqual({ collection_id: 'neon-tide', category: 'abstract' });
  for (const value of [undefined, 'private@example.com/abstract', 'neon-tide/', '/private', '']) expect(analyticsMetadata(value)).toEqual({});
  expect(sanitizeAnalyticsEvent('catalog_search', { constructor: 'private' })).toBeNull();
  expect(sanitizeAnalyticsEvent('catalog_search', JSON.parse('{"__proto__":"private"}'))).toBeNull();
  expect(recognizedSearchTerms('x'.repeat(501) + ' blue', [{ value: 'blue', title: 'blue' }], 'en')).toBeUndefined();
});
