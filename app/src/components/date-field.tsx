import type { AmountFieldProps } from './amount-field';
import { Field } from './loan-ui';
import { formatDateInput } from '@/lib/form-input';

export function DateField({ onChangeText, ...props }: AmountFieldProps) {
  return <Field {...props} onChangeText={(value) => onChangeText(formatDateInput(value))} />;
}
