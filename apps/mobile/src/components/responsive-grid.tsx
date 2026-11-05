import { Children, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

interface Props {
  /** How many cells share a row (with `minCell`: the most, and what the first frame draws). */
  columns: number;
  /** Space between the cells, across and down. */
  gap: number;
  /**
   * `auto-fit, minmax(minCell, 1fr)`: as many columns as fit with cells of at least this width, never
   * more than `columns` or than there are cells, and the rows are balanced (four cells in a space
   * for three make two rows of two, not three and one).
   */
  minCell?: number;
  children: ReactNode;
  testID?: string;
}

/**
 * How many columns `cells` cells use in a container of this width: as many as fit with cells of
 * at least `minCell`, at most `most`, and spread evenly over the rows they need.
 */
export function fitColumns(
  width: number,
  gap: number,
  minCell: number,
  most: number,
  cells: number,
): number {
  const fits = Math.floor((width + gap) / (minCell + gap));
  const columns = Math.max(1, Math.min(fits, most, Math.max(1, cells)));
  const rows = Math.ceil(Math.max(1, cells) / columns);
  return Math.ceil(Math.max(1, cells) / rows);
}

/**
 * Cells of equal width in rows (the card grids of the landing): `columns` of them share the width
 * of the container, measured when it is laid out, and wrap to further rows. A grid with fewer
 * children than columns leaves the rest of the row empty, as `auto-fill` does.
 */
export function ResponsiveGrid({ columns, gap, minCell, children, testID }: Props) {
  const [width, setWidth] = useState<number | null>(null);
  const cells = Children.toArray(children);
  const count =
    minCell !== undefined && width !== null
      ? fitColumns(width, gap, minCell, Math.max(1, columns), cells.length)
      : Math.max(1, columns);
  const cell = width === null ? undefined : Math.floor((width - gap * (count - 1)) / count);
  return (
    <View
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.grid, { columnGap: gap, rowGap: gap }]}
    >
      {cells.map((child, index) => (
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
