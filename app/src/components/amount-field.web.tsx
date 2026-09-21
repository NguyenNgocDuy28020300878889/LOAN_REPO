import type { AmountFieldProps } from './amount-field';
import { FormattedField } from './formatted-field.web';
import { formatAmountEdit } from '@/lib/form-input';

export function AmountField(props: AmountFieldProps) {
  return <FormattedField {...props} formatEdit={formatAmountEdit} />;
}
