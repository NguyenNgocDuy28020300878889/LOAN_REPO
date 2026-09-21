const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function notificationLoanId(data: unknown, userId: string): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  return value.userId === userId && typeof value.loanId === 'string' && uuid.test(value.loanId)
    ? value.loanId
    : null;
}
