import type { AmountFieldProps } from './amount-field';
import { FormattedField } from './formatted-field.web';
import { formatDateEdit } from '@/lib/form-input';

export function DateField(props: AmountFieldProps) {
  return <FormattedField {...props} formatEdit={formatDateEdit} />;
}
