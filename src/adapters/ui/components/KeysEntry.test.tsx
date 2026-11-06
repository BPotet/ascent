import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { KEYS_ENTRY_MS, KeysEntry } from './KeysEntry';

const hidden = { includeHiddenElements: true } as const;
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const reduceMotion = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

async function show(favor = 1, fortune = 2) {
  const onDone = jest.fn();
  await render(
    <KeysEntry
      sources={{ favor, fortune }}
      fortuneRarity={fortune > 0 ? 'rare' : null}
      onDone={onDone}
    />,
  );
  await act(async () => {});
  return { onDone };
}

async function advance(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 40) {
    await act(async () => {
      jest.advanceTimersByTime(40);
    });
  }
}

const growth = () =>
  StyleSheet.flatten(screen.getByTestId('keys-entry-total', hidden).props.style).transform?.[0]
    ?.scale ?? 1;

describe('KeysEntry (#226, F4, F5)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    announce.mockClear();
    reduceMotion.mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the keys received, one line per source, and what they open', async () => {
    await show();

    expect(screen.getByTestId('keys-entry-key', hidden)).toBeOnTheScreen();
    expect(screen.getByText('+3 clés')).toBeOnTheScreen();
    expect(screen.getByText('1 de la faveur')).toBeOnTheScreen();
    expect(screen.getByText('2 de Fortune')).toBeOnTheScreen();
    expect(screen.getByText('◆◆ Rare')).toBeOnTheScreen();
    expect(screen.getByText("Elles ouvrent le coffre scellé d'une Élite.")).toBeOnTheScreen();
    expect(screen.getByText('Touche pour continuer')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(
      "+3 clés : 1 de la faveur, 2 de Fortune. Elles ouvrent le coffre scellé d'une Élite.",
    );
  });

  it('shows the favor alone without Fortune', async () => {
    await show(1, 0);

    expect(screen.getByText('+1 clé')).toBeOnTheScreen();
    expect(screen.queryByText(/de Fortune/u)).toBeNull();
  });

  it('grows « +3 clés » in 3 steps over 320 ms, then goes on after 1 200 ms', async () => {
    const { onDone } = await show();

    expect(KEYS_ENTRY_MS).toBe(1_200);
    const first = growth();
    expect(first).toBeLessThan(1);
    await advance(360);
    expect(growth()).toBe(1);
    expect(onDone).not.toHaveBeenCalled();
    await advance(KEYS_ENTRY_MS - 360);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('goes on at a tap, once', async () => {
    const { onDone } = await show();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    await advance(KEYS_ENTRY_MS);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows « +3 clés » at once with reduced motion', async () => {
    reduceMotion.mockResolvedValue(true);
    await show();

    expect(growth()).toBe(1);
  });
});
