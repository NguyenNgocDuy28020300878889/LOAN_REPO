import { describe, expect, it } from 'vitest';
import { currencyExponent, formatMoneyMinor, parseMoneyToMinor } from './format';

describe('currency formatting', () => {
  it('uses ISO minor-unit exponents', () => {
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('VND')).toBe(0);
    expect(currencyExponent('KWD')).toBe(3);
  });
  it('does not display minor units as whole USD', () => {
    expect(formatMoneyMinor(1099, 'USD', 'en-US')).toContain('10.99');
  });
  it('keeps VND as a zero-decimal currency', () => {
    expect(formatMoneyMinor(50000, 'VND', 'en-US')).toContain('50,000');
  });
  it('converts user decimal input to stored minor units without rounding', () => {
    expect(parseMoneyToMinor('10.99', 'USD')).toBe(1099);
    expect(parseMoneyToMinor('50000', 'VND')).toBe(50000);
    expect(parseMoneyToMinor('1.234', 'KWD')).toBe(1234);
    expect(() => parseMoneyToMinor('10.999', 'USD')).toThrow('INVALID_AMOUNT_PRECISION');
    expect(() => parseMoneyToMinor('1,000', 'USD')).toThrow('INVALID_AMOUNT');
  });
});
