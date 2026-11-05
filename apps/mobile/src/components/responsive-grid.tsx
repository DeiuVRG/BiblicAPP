import { Children, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

interface Props {
  /** How many cells share a row. */
  columns: number;
  /** Space between the cells, across and down. */
  gap: number;
  children: ReactNode;
  testID?: string;
}

/**
 * Cells of equal width in rows (the card grids of the landing): `columns` of them share the width
 * of the container, measured when it is laid out, and wrap to further rows. A grid with fewer
 * children than columns leaves the rest of the row empty, as `auto-fill` does.
 */
export function ResponsiveGrid({ columns, gap, children, testID }: Props) {
  const [width, setWidth] = useState<number | null>(null);
  const count = Math.max(1, columns);
  const cell = width === null ? undefined : Math.floor((width - gap * (count - 1)) / count);
  return (
    <View
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.grid, { columnGap: gap, rowGap: gap }]}
    >
      {Children.toArray(children).map((child, index) => (
        <View
          key={index}
          style={
            cell === undefined
              ? { flexGrow: 1, flexBasis: `${100 / count}%`, minWidth: 0 }
              : { width: cell }
          }
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap' } });
