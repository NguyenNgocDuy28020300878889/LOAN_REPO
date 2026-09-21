import type { TFunction } from 'i18next';

export function loanStatusLabel(status: string, t: TFunction) {
  switch (status) {
    case 'DRAFT':
      return t('loan.statusDraft');
    case 'PENDING':
      return t('loan.statusPending');
    case 'ACTIVE':
      return t('loan.statusActive');
    case 'REPAID':
      return t('loan.statusRepaid');
    case 'CLOSED':
      return t('loan.statusClosed');
    case 'DECLINED':
      return t('loan.statusDeclined');
    case 'CANCELLED':
      return t('loan.statusCancelled');
    case 'CONFIRMED':
      return t('loan.statusConfirmed');
    case 'DISPUTED':
      return t('loan.statusDisputed');
    default:
      return status;
  }
}

export function loanEventLabel(eventType: string, t: TFunction) {
  switch (eventType) {
    case 'LOAN_CREATED':
      return t('loan.eventLoanCreated');
    case 'INVITE_CREATED':
      return t('loan.eventInviteCreated');
    case 'INVITE_REVOKED':
      return t('loan.eventInviteRevoked');
    case 'LOAN_ACCEPTED':
      return t('loan.eventLoanAccepted');
    case 'LOAN_DECLINED':
      return t('loan.eventLoanDeclined');
    case 'REPAYMENT_SUBMITTED':
      return t('loan.eventRepaymentSubmitted');
    case 'REPAYMENT_CONFIRMED':
      return t('loan.eventRepaymentConfirmed');
    case 'REPAYMENT_DISPUTED':
      return t('loan.eventRepaymentDisputed');
    case 'REPAYMENT_CANCELLED':
      return t('loan.eventRepaymentCancelled');
    default:
      return eventType;
  }
}
