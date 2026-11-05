import { act, render, screen, within } from '@testing-library/react-native';

import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { GaugeDial, GaugeEffectList } from './GaugeDial';

const hidden = { includeHiddenElements: true } as const;

const notches = () => screen.getAllByTestId(/^gauge-notch/u, hidden);
const lit = () => screen.getByTestId('gauge-notch-on', hidden);
const cursorLeft = () =>
  (screen.getByTestId('gauge-cursor', hidden).props.style as { left: string }[])
    .flat()
    .find((style) => style?.left !== undefined)?.left;

describe('GaugeDial (#41)', () => {
  reduceMotionInEachTest();

  it('shows the word, the value and five notches, the notch of the day lit under the cursor', async () => {
    await render(<GaugeDial gauge={2} />);

    expect(screen.getByText('Faveur pleine')).toBeOnTheScreen();
    expect(screen.getByText('+2')).toBeOnTheScreen();
    expect(notches()).toHaveLength(5);
    expect(within(lit()).getAllByTestId('gauge-glyph-plus8', hidden)).toHaveLength(2);
    expect(cursorLeft()).toBe('90%');
    expect(screen.getByText('Malédiction', hidden)).toBeTruthy();
    expect(screen.getByText('Faveur', hidden)).toBeTruthy();
  });

  it('puts a skull per step of a curse, and « = » at Neutral', async () => {
    const { rerender } = await render(<GaugeDial gauge={-2} />);
    expect(within(lit()).getAllByTestId('gauge-glyph-skull', hidden)).toHaveLength(2);
    expect(cursorLeft()).toBe('10%');

    await rerender(<GaugeDial gauge={-1} />);
    expect(within(lit()).getAllByTestId('gauge-glyph-skull', hidden)).toHaveLength(1);

    await rerender(<GaugeDial gauge={0} />);
    expect(within(lit()).getAllByTestId('gauge-glyph-eq', hidden)).toHaveLength(1);
  });

  it('is hatched, without cursor nor value, when there is no count yet', async () => {
    await render(<GaugeDial gauge={0} notYet />);

    expect(screen.getByText('Neutre')).toBeOnTheScreen();
    expect(screen.getByText('Pas encore')).toBeOnTheScreen();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByTestId('gauge-cursor', hidden)).toBeNull();
    expect(screen.queryByTestId('gauge-notch-on', hidden)).toBeNull();
    expect(screen.getAllByTestId('gauge-notch-hatched', hidden)).toHaveLength(5);
  });

  it('shows the « Scellée » pill', async () => {
    await render(<GaugeDial gauge={-1} sealed />);

    expect(screen.getByText('Scellée')).toBeOnTheScreen();
  });

  it('slides the cursor to its new notch in 5 steps of 100 ms', async () => {
    withMotion();
    jest.useFakeTimers();
    try {
      const { rerender } = await render(<GaugeDial gauge={-1} />);
      expect(cursorLeft()).toBe('30%');

      await rerender(<GaugeDial gauge={0} />);
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      expect(cursorLeft()).toBe('38%');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(cursorLeft()).toBe('50%');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('GaugeEffectList (#41)', () => {
  it('lists each effect with its glyph and its text', async () => {
    await render(
      <GaugeEffectList
        effects={[
          { glyph: 'bless', tone: 'gold', text: '3 bénédictions de départ' },
          { glyph: 'fatigue', tone: 'curse', text: 'Fatigue : PV max −10 %' },
        ]}
      />,
    );

    expect(screen.getByText('3 bénédictions de départ')).toBeOnTheScreen();
    expect(screen.getByText('Fatigue : PV max −10 %')).toBeOnTheScreen();
    expect(screen.getByTestId('gauge-glyph-fatigue', hidden)).toBeTruthy();
  });
});
