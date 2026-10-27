import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { artPalette } from '../pixelArt/artPalette';
import { textFont } from '../pixelArt/pixelTypography';
import { TAB_LABELS, TabBar, type TabKey } from './TabBar';

const { roles } = artPalette;

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
  it('names the views « Journée », « Semaine », « Mois » and « Tour »', () => {
    expect(TAB_LABELS).toEqual({ day: 'Journée', week: 'Semaine', month: 'Mois', tower: 'Tour' });
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

  it('marks the current tab with a background, a gold line and a bold label, not only a color', async () => {
    await show('week');

    expect(screen.getByRole('tab', { name: 'Semaine' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Journée' })).not.toBeSelected();
    expect(screen.getByRole('tab', { name: 'Semaine' })).toHaveStyle({
      backgroundColor: roles.surface,
    });
    expect(screen.getByRole('tab', { name: 'Journée' })).not.toHaveStyle({
      backgroundColor: roles.surface,
    });
    expect(screen.getByTestId('tab-line-week', hidden)).toHaveStyle({
      height: 4,
      backgroundColor: roles.gold,
    });
    expect(screen.queryByTestId('tab-line-day', hidden)).toBeNull();
    expect(screen.getByText('Semaine')).toHaveStyle({
      fontFamily: textFont.bold,
      color: roles.gold,
    });
    expect(screen.getByText('Journée')).toHaveStyle({
      fontFamily: textFont.semiBold,
      color: roles.parchment,
    });
  });

  it('draws the icon of each tab in pixels, on 24 dp', async () => {
    await show('day');

    (['day', 'week', 'month'] as const).forEach((tab) =>
      expect(screen.getByTestId(`tab-icon-${tab}`, hidden)).toHaveStyle({ width: 24, height: 24 }),
    );
  });

  it('asks for the view of the tab touched', async () => {
    const onSelect = await show('day');

    await fireEvent.press(screen.getByRole('tab', { name: 'Semaine' }));

    expect(onSelect).toHaveBeenCalledWith('week');
  });

  it('has tabs of 56 dp high, above the home indicator', async () => {
    await show('day', jest.fn(), 34);

    expect(screen.getByRole('tab', { name: 'Journée' })).toHaveStyle({ minHeight: 56 });
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ paddingBottom: 34 });
  });

  it('keeps a small margin under the tabs on a phone without home indicator', async () => {
    await show('day');

    expect(screen.getByTestId('tab-bar')).toHaveStyle({
      paddingBottom: 8,
      backgroundColor: roles.night,
    });
  });
});
