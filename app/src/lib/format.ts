const zeroDecimalCurrencies = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
const threeDecimalCurrencies = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function currencyExponent(currency: string) {
  const normalized = currency.toUpperCase();
  if (zeroDecimalCurrencies.has(normalized)) return 0;
  if (threeDecimalCurrencies.has(normalized)) return 3;
  return 2;
}

export function formatMoneyMinor(amountMinor: number, currency: string, locale = 'en') {
  const exponent = currencyExponent(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountMinor / 10 ** exponent);
}

/** Converts a user-entered decimal amount to the integer minor unit kept by the database. */
export function parseMoneyToMinor(value: string, currency: string) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = normalized.split('.');
  const exponent = currencyExponent(currency);
  if (fraction.length > exponent) throw new Error('INVALID_AMOUNT_PRECISION');
  const minor =
    Number(whole) * 10 ** exponent +
    Number((fraction + '0'.repeat(exponent)).slice(0, exponent) || '0');
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error('INVALID_AMOUNT');
  return minor;
}

export function formatDate(value: string, locale = 'en') {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00:00`),
  );
}
