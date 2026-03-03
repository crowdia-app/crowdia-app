import { Alert, Platform } from 'react-native';

type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/**
 * Cross-platform alert. Uses Alert.alert on native, window.confirm/alert on web.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  // Web fallback
  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Two buttons: treat as confirm/cancel
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[1];

  if (window.confirm(text)) {
    actionBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
