import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Text, View } from 'react-native';

import { EmptyState } from '@/components/state-views';
import { FoldBand } from '@/components/fold-band';
import { ResponsiveGrid, fitColumns } from '@/components/responsive-grid';
import { Select } from '@/components/select';
import type { SelectOption } from '@/components/select';
import { renderWithProviders } from '@/test-support/render';

beforeEach(() => {
  // The sheet comes and goes at once: what is asserted is the state.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const OPTIONS: SelectOption[] = [
  { value: 'fathers', label: 'Părinții Bisericii' },
  { value: 'medieval', label: 'Evul Mediu' },
  { value: 'modern', label: 'Teologie modernă' },
];

function Choice({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = jest.requireActual<typeof import('react')>('react').useState(initial);
  return (
    <Select
      testID="shelf"
      label="Raft"
      chooseLabel="Alege: Raft"
      allLabel="Toate"
      value={value}
      options={OPTIONS}
      onChange={setValue}
    />
  );
}

describe('Select', () => {
  it('shows its caption and the choice, and says both in one name', async () => {
    await renderWithProviders(<Choice />);
    const control = screen.getByTestId('shelf');
    expect(control.props.accessibilityRole).toBe('button');
    expect(control.props.accessibilityLabel).toBe('Raft: Toate');
    expect(within(control).getByText('Toate')).toBeTruthy();
    // The caption above the control is decoration for a screen reader: the name already has it.
    expect(screen.getByText('Raft', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Raft')).toBeNull();
  });

  it('says it opens a list and whether it is open', async () => {
    await renderWithProviders(<Choice />);
    const control = screen.getByTestId('shelf');
    expect(control.props['aria-haspopup']).toBe('listbox');
    expect(control.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(control);
    expect(screen.getByTestId('shelf').props.accessibilityState).toMatchObject({ expanded: true });
  });

  it('opens a sheet with "Toate" first and one radio per option, the choice checked', async () => {
    await renderWithProviders(<Choice initial="medieval" />);
    expect(screen.getByTestId('shelf').props.accessibilityLabel).toBe('Raft: Evul Mediu');
    await fireEvent.press(screen.getByTestId('shelf'));
    const sheet = within(await screen.findByTestId('shelf-sheet'));
    const group = sheet.getByLabelText('Raft');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual([
      'Toate',
      'Părinții Bisericii',
      'Evul Mediu',
      'Teologie modernă',
    ]);
    expect(radios.map((radio) => radio.props.accessibilityState.checked)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(sheet.getByText('Alege: Raft')).toBeTruthy();
  });

  it('chooses an option, closes the sheet and shows the choice', async () => {
    await renderWithProviders(<Choice />);
    await fireEvent.press(screen.getByTestId('shelf'));
    await fireEvent.press(await screen.findByTestId('shelf-option-modern'));
    expect(screen.queryByTestId('shelf-sheet')).toBeNull();
    expect(screen.getByTestId('shelf').props.accessibilityLabel).toBe('Raft: Teologie modernă');
  });

  it('returns to "Toate" with the first row', async () => {
    await renderWithProviders(<Choice initial="fathers" />);
    await fireEvent.press(screen.getByTestId('shelf'));
    await fireEvent.press(await screen.findByTestId('shelf-option-all'));
    expect(screen.getByTestId('shelf').props.accessibilityLabel).toBe('Raft: Toate');
  });

  it('closes from the close button of the sheet without choosing', async () => {
    await renderWithProviders(<Choice initial="fathers" />);
    await fireEvent.press(screen.getByTestId('shelf'));
    await fireEvent.press(await screen.findByLabelText('Închide'));
    expect(screen.queryByTestId('shelf-sheet')).toBeNull();
    expect(screen.getByTestId('shelf').props.accessibilityLabel).toBe('Raft: Părinții Bisericii');
  });

  it('closes with Escape on web and Back on Android: both reach the onRequestClose of the Modal', async () => {
    await renderWithProviders(<Choice initial="fathers" />);
    await fireEvent.press(screen.getByTestId('shelf'));
    expect(await screen.findByTestId('shelf-sheet')).toBeTruthy();
    const modal = screen.container.queryAll((instance) => instance.type === 'Modal')[0];
    await act(async () => (modal!.props.onRequestClose as () => void)());
    await waitFor(() => expect(screen.queryByTestId('shelf-sheet')).toBeNull());
    expect(screen.getByTestId('shelf').props.accessibilityLabel).toBe('Raft: Părinții Bisericii');
  });
});

describe('FoldBand', () => {
  function Folded({ defaultOpen }: { defaultOpen?: boolean }) {
    return (
      <FoldBand
        tone="cream"
        label="Crezuri"
        title="Ce mărturisește Biserica"
        testID="fold"
        defaultOpen={defaultOpen}
      >
        <Text>Conținutul benzii</Text>
      </FoldBand>
    );
  }

  it('is open at first, with a button for a header that says what it does', async () => {
    await renderWithProviders(<Folded />);
    const toggle = screen.getByTestId('fold-toggle');
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: true });
    expect(toggle.props.accessibilityLabel).toBe('Ce mărturisește Biserica. Restrânge');
    expect(screen.getByText('Conținutul benzii')).toBeTruthy();
  });

  it('writes the label small and the title as the heading of the band', async () => {
    await renderWithProviders(<Folded />);
    expect(screen.getByText('Crezuri', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Ce mărturisește Biserica' })).toBeTruthy();
  });

  it('folds the body away and unfolds it again', async () => {
    await renderWithProviders(<Folded />);
    await fireEvent.press(screen.getByTestId('fold-toggle'));
    expect(screen.queryByText('Conținutul benzii')).toBeNull();
    expect(screen.getByTestId('fold-toggle').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.getByTestId('fold-toggle').props.accessibilityLabel).toBe(
      'Ce mărturisește Biserica. Extinde',
    );
    await fireEvent.press(screen.getByTestId('fold-toggle'));
    expect(screen.getByText('Conținutul benzii')).toBeTruthy();
  });

  it('can start closed', async () => {
    await renderWithProviders(<Folded defaultOpen={false} />);
    expect(screen.queryByText('Conținutul benzii')).toBeNull();
    expect(screen.getByTestId('fold-toggle').props.accessibilityState).toMatchObject({
      expanded: false,
    });
  });
});

describe('ResponsiveGrid', () => {
  const cells = (grid: ReturnType<typeof screen.getByTestId>) =>
    grid.children as unknown as { props: { style: Record<string, unknown> } }[];

  it('shares the width in equal cells once it is measured, and wraps to further rows', async () => {
    await renderWithProviders(
      <ResponsiveGrid columns={3} gap={20} testID="grid">
        {['a', 'b', 'c', 'd'].map((name) => (
          <Text key={name}>{name}</Text>
        ))}
      </ResponsiveGrid>,
    );
    const grid = screen.getByTestId('grid');
    await fireEvent(grid, 'layout', { nativeEvent: { layout: { width: 1000, height: 100 } } });
    // (1000 - 2 * 20) / 3 = 320
    for (const cell of cells(screen.getByTestId('grid'))) {
      expect(cell.props.style).toEqual({ width: 320 });
    }
    expect(cells(screen.getByTestId('grid'))).toHaveLength(4);
    expect(screen.getByTestId('grid')).toHaveStyle({
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 20,
      rowGap: 20,
    });
  });

  it('shares the width by percentage before it is measured', async () => {
    await renderWithProviders(
      <ResponsiveGrid columns={4} gap={10} testID="grid">
        <Text>a</Text>
        <Text>b</Text>
      </ResponsiveGrid>,
    );
    for (const cell of cells(screen.getByTestId('grid'))) {
      expect(cell.props.style).toMatchObject({ flexGrow: 1, flexBasis: '25%', minWidth: 0 });
    }
  });

  it('takes one column when given none, and leaves a short last row empty', async () => {
    await renderWithProviders(
      <ResponsiveGrid columns={0} gap={8} testID="grid">
        <View />
        <View />
      </ResponsiveGrid>,
    );
    await fireEvent(screen.getByTestId('grid'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 10 } },
    });
    for (const cell of cells(screen.getByTestId('grid'))) {
      expect(cell.props.style).toEqual({ width: 400 });
    }
  });
});

describe('ResponsiveGrid with a minimum cell (auto-fit)', () => {
  const cells = (grid: ReturnType<typeof screen.getByTestId>) =>
    grid.children as unknown as { props: { style: Record<string, unknown> } }[];

  it('uses as many columns as fit with cells of the minimum width, never more than asked or than there are cells', () => {
    // 1082 points of room (a desktop filter panel): four 180 cells and their gaps fit.
    expect(fitColumns(1082, 16, 180, 4, 4)).toBe(4);
    expect(fitColumns(1082, 16, 180, 4, 3)).toBe(3);
    expect(fitColumns(1082, 16, 180, 3, 4)).toBe(2);
    // Room for one, or for none.
    expect(fitColumns(190, 16, 180, 4, 4)).toBe(1);
    expect(fitColumns(100, 16, 180, 4, 4)).toBe(1);
    expect(fitColumns(500, 16, 180, 4, 0)).toBe(1);
  });

  it('balances the rows: four cells in a space for three make two rows of two, five make three and two', () => {
    // 768 points: 646 of room inside the panel, three 180 cells fit.
    expect(fitColumns(646, 16, 180, 4, 4)).toBe(2);
    expect(fitColumns(646, 16, 180, 5, 5)).toBe(3);
    expect(fitColumns(646, 16, 180, 6, 6)).toBe(3);
    // A full row stays a full row.
    expect(fitColumns(646, 16, 180, 3, 3)).toBe(3);
  });

  it('lays four selects out two and two at 768 and four across at 1366, from the measured width', async () => {
    await renderWithProviders(
      <ResponsiveGrid columns={4} minCell={180} gap={16} testID="grid">
        {['a', 'b', 'c', 'd'].map((name) => (
          <Text key={name}>{name}</Text>
        ))}
      </ResponsiveGrid>,
    );
    // Before it is measured the first frame shares the width by the columns asked for.
    for (const cell of cells(screen.getByTestId('grid'))) {
      expect(cell.props.style).toMatchObject({ flexBasis: '25%' });
    }
    await fireEvent(screen.getByTestId('grid'), 'layout', {
      nativeEvent: { layout: { width: 646, height: 100 } },
    });
    // (646 - 16) / 2 = 315: two to a row, none alone on a row of its own.
    for (const cell of cells(screen.getByTestId('grid'))) {
      expect(cell.props.style).toEqual({ width: 315 });
    }
    await fireEvent(screen.getByTestId('grid'), 'layout', {
      nativeEvent: { layout: { width: 1082, height: 100 } },
    });
    // (1082 - 3 * 16) / 4 = 258.5
    for (const cell of cells(screen.getByTestId('grid'))) {
      expect(cell.props.style).toEqual({ width: 258 });
    }
  });
});

describe('EmptyState', () => {
  it('says what is empty in a serif sentence', async () => {
    await renderWithProviders(<EmptyState message="Nicio lucrare." />);
    const message = screen.getByText('Nicio lucrare.');
    expect(message.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryByTestId('empty-state-action')).toBeNull();
  });

  it('offers one action that undoes the filters, when it has one', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState message="Nicio lucrare." actionLabel="Șterge filtrele" onAction={onAction} />,
    );
    await fireEvent.press(screen.getByText('Șterge filtrele'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('shows no action when it has a label and nothing to run', async () => {
    await renderWithProviders(
      <EmptyState message="Nicio lucrare." actionLabel="Șterge filtrele" />,
    );
    expect(screen.queryByText('Șterge filtrele')).toBeNull();
  });
});
