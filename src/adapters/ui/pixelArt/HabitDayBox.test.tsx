import { render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import { artPalette } from './artPalette';
import { HabitDayBox } from './HabitDayBox';

const hidden = { includeHiddenElements: true };
const { roles } = artPalette;
const marks = ['check-mark', 'cross-mark', 'dot-mark', 'dash-mark'];
const shownMarks = () => marks.filter((mark) => screen.queryByTestId(mark, hidden) !== null);

describe('HabitDayBox', () => {
  beforeEach(() =>
    jest.spyOn(PixelRatio, 'roundToNearestPixel').mockImplementation((size) => size),
  );
  afterEach(() => jest.restoreAllMocks());

  it.each<[CheckInStatus, string[], object]>([
    ['pending', [], { borderColor: roles.gold, backgroundColor: roles.night }],
    ['done', ['check-mark'], { borderColor: roles.done, backgroundColor: roles.doneBg }],
    ['missed', ['cross-mark'], { borderColor: roles.missedLine, backgroundColor: roles.missedBg }],
    ['upcoming', ['dot-mark'], { borderColor: roles.raised }],
    ['notStarted', ['dash-mark'], { borderColor: 'transparent' }],
  ])(
    'draws the « %s » box with its mark, never with its color alone',
    async (status, shown, style) => {
      await render(<HabitDayBox status={status} testID="box" />);

      expect(screen.getByTestId('box', hidden)).toHaveStyle({ width: 44, height: 44, ...style });
      expect(shownMarks()).toEqual(shown);
    },
  );

  it('is 40 dp in the week view', async () => {
    await render(<HabitDayBox status="done" size={40} testID="box" />);

    expect(screen.getByTestId('box', hidden)).toHaveStyle({ width: 40, height: 40 });
  });

  it('lifts its mark by one art pixel for the bounce, without any scale', async () => {
    await render(<HabitDayBox status="done" lifted />);

    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: -2 }],
    });
  });

  it('keeps its mark in place otherwise', async () => {
    await render(<HabitDayBox status="done" />);

    expect(screen.getByTestId('check-mark', hidden)).toHaveStyle({
      transform: [{ translateY: 0 }],
    });
  });

  it('is decorative: the row reads the status in words', async () => {
    await render(<HabitDayBox status="done" testID="box" />);

    expect(screen.getByTestId('box', hidden)).toHaveProp('accessibilityElementsHidden', true);
  });

  it.each<[CheckInStatus, string | null]>([
    ['done', 'check-mark'],
    ['missed', 'cross-mark'],
    ['upcoming', 'dot-mark'],
    ['notStarted', 'dash-mark'],
    ['pending', null],
  ])(
    'is 24 dp in the legend of the week view, with the small « %s » mark',
    async (status, mark) => {
      await render(<HabitDayBox status={status} size={24} testID="box" />);

      expect(screen.getByTestId('box', hidden)).toHaveStyle({ width: 24, height: 24 });
      expect(shownMarks()).toEqual(mark === null ? [] : [mark]);
      if (mark !== null) {
        expect(screen.getByTestId(mark, hidden)).toHaveStyle({ width: 16, height: 16 });
      }
    },
  );
});
