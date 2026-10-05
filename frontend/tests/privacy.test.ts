import { expect, test } from 'bun:test';
import { effectiveCookiePreferences, getCountryGroup, normalizeCountry, parseCookiePreferences } from '../src/lib/privacy-policy';

test('a stored refusal survives preference migration', () => {
  expect(parseCookiePreferences(null, 'essential')).toEqual({ analytics: false, advertising: false });
});

test('old analytics permission never becomes advertising permission', () => {
  expect(parseCookiePreferences(null, 'analytics')).toEqual({ analytics: true, advertising: false });
});

test('stored independent preferences take precedence over legacy choices', () => {
  for (const analytics of [false, true]) for (const advertising of [false, true]) {
    expect(parseCookiePreferences(JSON.stringify({ analytics, advertising }), 'essential')).toEqual({ analytics, advertising });
  }
  for (const value of ['broken', 'null', '{"analytics":"true","advertising":true}', '{"analytics":true}']) {
    expect(parseCookiePreferences(value, 'analytics')).toEqual({ analytics: false, advertising: false });
  }
});

test('new visitors wait for explicit permission in the EEA and unknown countries', () => {
  for (const country of [null, 'DE', 'IS', 'LI', 'NO', 'AX', 'GP', 'GF', 'MQ', 'RE', 'YT', 'MF']) {
    expect(effectiveCookiePreferences(null, country)).toEqual({ analytics: false, advertising: false });
  }
  for (const country of ['RU', 'KZ', 'BY', 'GE', 'BR', 'GB', 'CH']) {
    expect(effectiveCookiePreferences(null, country)).toEqual({ analytics: true, advertising: true });
  }
  expect(effectiveCookiePreferences({ analytics: false, advertising: true }, 'DE')).toEqual({ analytics: false, advertising: true });
});

test('country results are normalized and validated independently of feature availability', () => {
  expect(normalizeCountry({ success: true, country_code: ' ru ' })).toBe('RU');
  for (const response of [null, {}, { success: false, country_code: 'US' }, { success: true, country_code: 42 }, { success: true, country_code: 'ZZ' }, { success: true, country_code: 'EU' }]) {
    expect(normalizeCountry(response)).toBeNull();
  }
  expect(['RU', 'KZ', 'BY', 'DE', 'GE', null].map(getCountryGroup)).toEqual(['ru', 'kz', 'by', 'eea', 'other', 'unknown']);
});
