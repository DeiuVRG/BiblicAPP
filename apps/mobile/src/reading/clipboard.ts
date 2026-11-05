import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

/**
 * Puts text on the clipboard: `expo-clipboard` on iOS and Android and `navigator.clipboard` on the web
 * (which is what the module does there). When that does not work (a page without the right to the
 * clipboard, a platform without it) the system Share sheet takes the text, the P1 fallback of
 * docs/ui-spec-v2.md, 8.8. Resolves to whether the text went anywhere; never throws.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (await Clipboard.setStringAsync(text)) return true;
  } catch {
    // Fall through to the share sheet.
  }
  try {
    const result = await Share.share({ message: text });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
