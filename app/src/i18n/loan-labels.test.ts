import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';

import { loanEventLabel, loanStatusLabel } from './loan-labels';

const t = ((key: string) => `translated:${key}`) as unknown as TFunction;

describe('loan labels', () => {
  it('translates known loan and repayment statuses', () => {
    expect(loanStatusLabel('ACTIVE', t)).toBe('translated:loan.statusActive');
    expect(loanStatusLabel('CONFIRMED', t)).toBe('translated:loan.statusConfirmed');
  });

  it('translates timeline events without changing unknown audit values', () => {
    expect(loanEventLabel('REPAYMENT_DISPUTED', t)).toBe('translated:loan.eventRepaymentDisputed');
    expect(loanEventLabel('FUTURE_EVENT', t)).toBe('FUTURE_EVENT');
  });
});
