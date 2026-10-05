export type CookiePreferences = { analytics: boolean; advertising: boolean };
export type CountryGroup = 'ru' | 'kz' | 'by' | 'eea' | 'other' | 'unknown';
const eea = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO AX GP GF MQ RE YT MF'.split(' '));
const countries = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));

export function normalizeCountry(response: unknown): string | null {
  if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true
    || !('country_code' in response) || typeof response.country_code !== 'string') return null;
  const code = response.country_code.trim().toUpperCase();
  return countries.has(code) ? code : null;
}

export function getCountryGroup(country: string | null): CountryGroup {
  if (!country) return 'unknown';
  if (country === 'RU') return 'ru';
  if (country === 'KZ') return 'kz';
  if (country === 'BY') return 'by';
  return eea.has(country) ? 'eea' : 'other';
}

export function effectiveCookiePreferences(preferences: CookiePreferences | null, country: string | null): CookiePreferences {
  const group = getCountryGroup(country);
  const enabled = group !== 'unknown' && group !== 'eea';
  return preferences ?? { analytics: enabled, advertising: enabled };
}

export function parseCookiePreferences(value: string | null, legacy: string | null): CookiePreferences | null {
  if (value !== null) {
    try {
      const preferences: unknown = JSON.parse(value);
      if (preferences && typeof preferences === 'object'
        && 'analytics' in preferences && typeof preferences.analytics === 'boolean'
        && 'advertising' in preferences && typeof preferences.advertising === 'boolean') {
        return { analytics: preferences.analytics, advertising: preferences.advertising };
      }
    } catch { /* Invalid stored preferences never grant permission. */ }
    return { analytics: false, advertising: false };
  }
  if (legacy === null) return null;
  return { analytics: legacy === 'analytics', advertising: false };
}
