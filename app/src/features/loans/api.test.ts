import { describe, expect, it } from 'vitest';

import { createLoanInputSchema } from './validation';

describe('createLoanInputSchema', () => {
  const validInput = {
    creatorRole: 'LENDER' as const,
    principalMinor: 50000,
    currency: 'USD',
    loanDate: '2026-08-22',
    dueDate: '2026-09-22',
    idempotencyKey: 'a9798bfe-9417-46eb-ad47-935e2aa06440',
  };

  it('accepts a valid create-loan input', () => {
    expect(createLoanInputSchema.parse(validInput)).toMatchObject(validInput);
  });

  it('rejects a due date before the loan date', () => {
    expect(() => createLoanInputSchema.parse({ ...validInput, dueDate: '2026-08-21' })).toThrow(
      'INVALID_DUE_DATE',
    );
  });

  it('accepts a valid recipient email or empty recipient email', () => {
    expect(
      createLoanInputSchema.parse({ ...validInput, recipientEmail: 'borrower@example.com' }),
    ).toMatchObject({ ...validInput, recipientEmail: 'borrower@example.com' });

    expect(createLoanInputSchema.parse({ ...validInput, recipientEmail: '' })).toMatchObject({
      ...validInput,
      recipientEmail: '',
    });
  });

  it('rejects an invalid recipient email', () => {
    expect(() =>
      createLoanInputSchema.parse({ ...validInput, recipientEmail: 'not-an-email' }),
    ).toThrow();
  });
});
