import { Circle, Path, Svg } from 'react-native-svg';

import { useTheme } from '@/theme/theme-context';

/**
 * The mark of the brand bar: an open book in a terracotta disc. It is the only picture of the
 * chrome; it carries no meaning of its own (the wordmark next to it names the app), so it is hidden
 * from assistive technology.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg
      testID="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Circle cx={14} cy={14} r={14} fill={colors.accent} />
      <Path d="M7.5 9.2c2.3-.9 4.6-.6 6.5.9v9.4c-1.9-1.4-4.2-1.7-6.5-.8z" fill={colors.onAccent} />
      <Path d="M20.5 9.2c-2.3-.9-4.6-.6-6.5.9v9.4c1.9-1.4 4.2-1.7 6.5-.8z" fill={colors.onAccent} />
    </Svg>
  );
}
