import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

// What a `Pressable` needs to start a press: the responder grant. (`fireEvent.press` calls only
// `onPress`, which never shows the pressed state of the style callback.)
const GRANT = {
  nativeEvent: { touches: [], changedTouches: [], identifier: 1, target: 1 },
  persist: () => undefined,
  currentTarget: 1,
  touchHistory: {
    touchBank: [],
    indexOfSingleActiveTouch: -1,
    mostRecentTimeStamp: 0,
    numberActiveTouches: 0,
  },
};

/**
 * Starts a press on the control with this accessible name and returns the style it has while it is
 * pressed (the control is found again afterwards: its props changed).
 */
export async function styleWhilePressed(label: string | RegExp): Promise<ViewStyle> {
  await fireEvent(screen.getByLabelText(label), 'responderGrant', GRANT);
  return StyleSheet.flatten(screen.getByLabelText(label).props.style) as ViewStyle;
}
