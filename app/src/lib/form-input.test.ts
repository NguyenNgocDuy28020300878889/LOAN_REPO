import { describe, expect, it } from 'vitest';
import {
  formatAmountInput,
  formatAmountEdit,
  parseAmountInput,
  formatDateInput,
  parseDateInput,
} from './form-input';

describe('money entry with dot grouping', () => {
  it('maps the caret through added and moved separators', () => {
    expect(formatAmountEdit('1000', 4)).toEqual({ text: '1.000', start: 5, end: 5 });
    expect(formatAmountEdit('12.3945.678', 5)).toEqual({ text: '123.945.678', start: 5, end: 5 });
    expect(formatAmountEdit('', 0)).toEqual({ text: '', start: 0, end: 0 });
    expect(formatAmountEdit('1.234,56', 8)).toEqual({ text: '1.234,56', start: 8, end: 8 });
  });
  it('groups typing, pasting and edits without changing the amount sent to the API', () => {
    expect(formatAmountInput('1000000')).toBe('1.000.000');
    expect(formatAmountInput('1.000.00')).toBe('100.000');
    expect(formatAmountInput('')).toBe('');
    expect(parseAmountInput(formatAmountInput('123456'), 'VND')).toBe(123456);
    expect(parseAmountInput('1.234,50', 'USD')).toBe(123450);
    expect(parseAmountInput('1.234,567', 'KWD')).toBe(1234567);
  });
  it('rejects negative, invalid, zero, excessive precision and unsafe integer amounts', () => {
    for (const value of [
      '-1.000',
      '1e6',
      'abc',
      '0',
      '1..000',
      '1.00',
      '1.000,01',
      '9007199254740992',
    ]) {
      expect(() => parseAmountInput(value, 'VND')).toThrow();
    }
    expect(formatAmountInput('-1000')).toBe('-1000');
    expect(() => parseAmountInput('1,001', 'USD')).toThrow();
  });
});

describe('day/month/year entry', () => {
  it('formats digits and ISO paste and sends an unambiguous ISO date', () => {
    expect(formatDateInput('16092026')).toBe('16/09/2026');
    expect(formatDateInput('2026-09-16')).toBe('16/09/2026');
    expect(formatDateInput('160')).toBe('16/0');
    expect(formatDateInput('')).toBe('');
    expect(parseDateInput('04/05/2026')).toBe('2026-05-04');
    expect(parseDateInput('29/02/2028')).toBe('2028-02-29');
  });
  it('rejects impossible dates, incomplete dates and ISO entered without normalization', () => {
    for (const value of [
      '29/02/2026',
      '31/04/2026',
      '00/01/2026',
      '01/13/2026',
      '1/2/2026',
      '01/01/0000',
      '2026-09-16',
    ]) {
      expect(() => parseDateInput(value)).toThrow();
    }
  });
});
