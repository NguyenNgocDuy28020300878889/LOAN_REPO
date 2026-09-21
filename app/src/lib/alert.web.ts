import type { AlertButton } from 'react-native';

// React Native Web's Alert is a no-op. Browser dialogs preserve the explicit
// confirmation boundary used by the native screens, including cancellation.
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = buttons?.filter((button) => button.style !== 'cancel') ?? [];
    const cancel = buttons?.find((button) => button.style === 'cancel');
    if (actions.length > 1) throw new Error('Multiple browser alert actions are unsupported');
    if (cancel) {
      if (window.confirm(text)) actions[0]?.onPress?.();
      else cancel.onPress?.();
    } else {
      window.alert(text);
      actions[0]?.onPress?.();
    }
  },
};
