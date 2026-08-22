import { z } from 'zod';

const loanRoleSchema = z.enum(['LENDER', 'BORROWER']);

export const createLoanInputSchema = z
  .object({
    creatorRole: loanRoleSchema,
    principalMinor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    loanDate: z.string().date(),
    dueDate: z.string().date(),
    purpose: z.string().max(280).optional(),
    note: z.string().max(2000).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .refine((input) => input.dueDate >= input.loanDate, { message: 'INVALID_DUE_DATE' });

export type CreateLoanInput = z.infer<typeof createLoanInputSchema>;
