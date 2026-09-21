import type { ComponentProps } from 'react';
import { Field } from './loan-ui';
import { formatAmountInput } from '@/lib/form-input';

export type AmountFieldProps = Omit<ComponentProps<typeof Field>, 'onChange' | 'onChangeText'> & {
  onChangeText: (value: string) => void;
};

export function AmountField({ onChangeText, ...props }: AmountFieldProps) {
  return <Field {...props} onChangeText={(value) => onChangeText(formatAmountInput(value))} />;
}
