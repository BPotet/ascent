import { renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { MONTH_CHROME, useWeekColumnWidth, WEEK_CARD_CHROME, weekColumnWidth } from './cellSize';

function screenOf(width: number): void {
  Dimensions.set({
    window: { ...Dimensions.get('window'), width },
    screen: { ...Dimensions.get('screen'), width },
  });
}

describe('weekColumnWidth', () => {
  it.each([
    [400, 48],
    [336, 48],
    [320, 320 / 7],
    [280, 40],
  ])('gives a column of %s dp for 7 columns in %s dp at most 48', (innerWidth, column) => {
    expect(weekColumnWidth(innerWidth)).toBeCloseTo(column, 5);
  });

  it('is about 45.7 dp for 320 dp', () => {
    expect(weekColumnWidth(320)).toBeCloseTo(45.71, 2);
  });
});

describe('useWeekColumnWidth', () => {
  it.each([
    [390, 48],
    [376, 48],
    [360, 320 / 7],
    [320, 40],
  ])('gives the columns of a card of the Week view on a %s dp screen', async (width, column) => {
    screenOf(width);

    const { result } = await renderHook(() => useWeekColumnWidth(WEEK_CARD_CHROME));

    expect(result.current).toBeCloseTo(column, 5);
  });

  it('gives 48 dp columns to the Month view on the 390 dp screen of the mockup', async () => {
    screenOf(390);

    const { result } = await renderHook(() => useWeekColumnWidth(MONTH_CHROME));

    expect(result.current).toBe(48);
  });
});
