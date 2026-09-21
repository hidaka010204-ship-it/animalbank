import { Alert, Platform } from 'react-native';

type ButtonDef = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export function showAlert(
  title: string,
  message?: string,
  buttons?: ButtonDef[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const actionBtns = buttons.filter(b => b.style !== 'cancel');

  if (actionBtns.length === 1) {
    const confirmed = window.confirm(text);
    if (confirmed) {
      actionBtns[0].onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
    return;
  }

  // Multiple choices: numbered prompt
  const opts = actionBtns.map((b, i) => `${i + 1}: ${b.text}`).join('\n');
  const cancelLine = cancelBtn ? `\n${actionBtns.length + 1}: ${cancelBtn.text}` : '';
  const input = window.prompt(`${text}\n\n${opts}${cancelLine}`);
  if (input === null) {
    cancelBtn?.onPress?.();
    return;
  }
  const idx = parseInt(input, 10) - 1;
  if (!isNaN(idx) && idx >= 0 && idx < actionBtns.length) {
    actionBtns[idx].onPress?.();
  } else if (cancelBtn && !isNaN(idx) && idx === actionBtns.length) {
    cancelBtn.onPress?.();
  }
}
