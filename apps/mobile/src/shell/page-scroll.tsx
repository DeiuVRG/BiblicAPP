import { ScrollView, StyleSheet, View } from 'react-native';
import type { ScrollViewProps, ViewProps } from 'react-native';
import type { ElementRef, ReactNode, Ref } from 'react';

import { Screen } from '@/components/screen';

import { BrandBar } from './brand-bar';
import { SectionBar } from './section-bar';

interface Props extends Pick<
  ScrollViewProps,
  'onScroll' | 'scrollEventThrottle' | 'onContentSizeChange'
> {
  children: ReactNode;
  /** False inside the reader, which has its own toolbar (docs/ui-spec-v2.md, 4.1). */
  brand?: boolean;
  testID?: string;
  scrollRef?: Ref<ElementRef<typeof ScrollView>>;
}

/**
 * The scaffold of a screen (docs/ui-spec-v2.md, 4.2): one scroll container whose first two children
 * are the brand bar and the section bar, and the section bar is a sticky header
 * (`stickyHeaderIndices`: react-native-web renders it `position: sticky; top: 0`, native has it
 * natively). The brand bar scrolls away with the page; the section bar stays. Everything else the
 * screen draws follows as children of the same container, so a screen's own sticky strip (the work
 * hub's tabs) can be one more sticky child. The children must be real children, not a fragment.
 */
export function PageScroll({
  children,
  brand = true,
  testID = 'screen',
  scrollRef,
  onScroll,
  scrollEventThrottle,
  onContentSizeChange,
}: Props) {
  const common = {
    ref: scrollRef,
    contentContainerStyle: styles.content,
    keyboardShouldPersistTaps: 'handled' as const,
    onScroll,
    scrollEventThrottle,
    onContentSizeChange,
  };
  // Two trees, not a placeholder: react-native-web counts an absent child when it numbers the
  // children and React Native does not, so the index of the section bar would differ.
  return (
    <Screen testID={testID}>
      {brand ? (
        <ScrollView {...common} stickyHeaderIndices={[1]}>
          <BrandBar />
          <SectionBar />
          {children}
        </ScrollView>
      ) : (
        <ScrollView {...common} stickyHeaderIndices={[0]}>
          <SectionBar />
          {children}
        </ScrollView>
      )}
    </Screen>
  );
}

/** The `main` landmark of a screen: it takes the room the content leaves, so a footer sits at the bottom. */
export function Main({ style, ...rest }: ViewProps) {
  return <View role="main" {...rest} style={[styles.main, style]} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  main: { flexGrow: 1 },
});
