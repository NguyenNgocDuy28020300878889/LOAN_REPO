import { parseMoneyToMinor } from './format';

/** Vietnamese input convention: dots group thousands; a comma separates decimals. */
export function formatAmountInput(value: string) {
  if (!/^[\d.]*([,]\d*)?$/.test(value)) return value;
  const [integer, fraction] = value.split(',');
  const digits = integer.replace(/\./g, '').replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return grouped + (fraction === undefined ? '' : `,${fraction}`);
}

/** Keep the caret next to the same digit when grouping separators move. */
export function formatAmountEdit(value: string, start: number, end = start) {
  const text = formatAmountInput(value);
  const position = (offset: number) => {
    if (offset === value.length) return text.length;
    const count = formatAmountInput(value.slice(0, offset)).replace(/\./g, '').length;
    if (!count) return 0;
    let seen = 0;
    for (let index = 0; index < text.length; index++) {
      if (text[index] !== '.') seen++;
      if (seen === count) return index + 1;
    }
    return text.length;
  };
  return { text, start: position(start), end: position(end) };
}

export function parseAmountInput(value: string, currency: string) {
  const trimmed = value.trim();
  if (!/^(\d+|\d{1,3}(\.\d{3})+)(,\d+)?$/.test(trimmed)) throw new Error('INVALID_AMOUNT');
  return parseMoneyToMinor(trimmed.replace(/\./g, '').replace(',', '.'), currency);
}

export function isoToDateInput(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isoToDateInput(value);
  if (!/^[\d/]*$/.test(value)) return value;
  const digits = value.replace(/\//g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

export function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match || Number(match[3]) < 1) throw new Error('INVALID_DATE');
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso)
    throw new Error('INVALID_DATE');
  return iso;
}

export function formatDateEdit(value: string, start: number, end = start) {
  const text = formatDateInput(value);
  const position = (offset: number) => {
    if (offset === value.length) return text.length;
    const count = value.slice(0, offset).replace(/\//g, '').length;
    if (!count) return 0;
    let seen = 0;
    for (let index = 0; index < text.length; index++) {
      if (text[index] !== '/') seen++;
      if (seen === count) return index + 1;
    }
    return text.length;
  };
  return { text, start: position(start), end: position(end) };
}
