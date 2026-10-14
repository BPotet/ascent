import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TAB_LABELS, TabBar, type TabKey } from './TabBar';

const hidden = { includeHiddenElements: true } as const;

const metrics = (bottom: number) => ({
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom },
});

async function show(current: TabKey, onSelect = jest.fn(), bottom = 0) {
  await render(
    <SafeAreaProvider initialMetrics={metrics(bottom)}>
      <TabBar tabs={['day', 'week', 'month']} current={current} onSelect={onSelect} />
    </SafeAreaProvider>,
  );
  return onSelect;
}

describe('TabBar', () => {
  it('names the views « Journée », « Semaine » and « Mois »', () => {
    expect(TAB_LABELS).toEqual({ day: 'Journée', week: 'Semaine', month: 'Mois' });
  });

  it('shows one tab per view, in the order given', async () => {
    await show('day');

    expect(screen.getByTestId('tab-bar')).toHaveProp('accessibilityRole', 'tablist');
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Journée',
      'Semaine',
      'Mois',
    ]);
  });

  it('shows only the tabs given', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics(0)}>
        <TabBar tabs={['day', 'week']} current="week" onSelect={jest.fn()} />
      </SafeAreaProvider>,
    );

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: 'Mois' })).toBeNull();
  });

  it('marks the current tab as selected, with a background and not only a color', async () => {
    await show('week');

    expect(screen.getByRole('tab', { name: 'Semaine' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Journée' })).not.toBeSelected();
    expect(screen.getByTestId('tab-icon-week', hidden)).toHaveStyle({
      backgroundColor: 'rgba(124,156,255,0.22)',
    });
    expect(screen.getByTestId('tab-icon-day', hidden)).not.toHaveStyle({
      backgroundColor: 'rgba(124,156,255,0.22)',
    });
  });

  it('asks for the view of the tab touched', async () => {
    const onSelect = await show('day');

    await fireEvent.press(screen.getByRole('tab', { name: 'Semaine' }));

    expect(onSelect).toHaveBeenCalledWith('week');
  });

  it('has tabs of at least 52 pt high, above the home indicator', async () => {
    await show('day', jest.fn(), 34);

    expect(screen.getByRole('tab', { name: 'Journée' })).toHaveStyle({ minHeight: 52 });
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 34 });
  });

  it('keeps a small margin under the tabs on a phone without home indicator', async () => {
    await show('day');

    expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 8 });
  });
});
