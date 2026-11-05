// #173 : le feedback de jeu du pouvoir instantané hors de la scène Skia (maquette E2) : le mot de
// scène « Pas de l'ombre » 600 ms, et les losanges d'Élan vidés un à un (150 ms chacun).
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { battleColors } from '../theme/battleColors';
import { FeedbackLabel } from './BattleEffects';
import { HeroBar } from './HeroBar';

const hiddenToo = { includeHiddenElements: true } as const;

function opacity(element: Parameters<typeof getAnimatedStyle>[0]): number {
  return Number(getAnimatedStyle(element).opacity ?? 1);
}

/** L'opacité du plein de chaque losange, de gauche à droite. */
function fills(): number[] {
  return screen.getAllByTestId('battle-momentum-fill', hiddenToo).map(opacity);
}

async function wait(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

describe("the word « Pas de l'ombre » on the scene", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is written in light violet, then fades out within 600 ms', async () => {
    await render(<FeedbackLabel texts={[{ tone: 'shadowStep', title: "Pas de l'ombre" }]} />);

    expect(StyleSheet.flatten(screen.getByText("Pas de l'ombre").props.style).color).toBe(
      battleColors.onShadowStep,
    );
    await wait(300);
    expect(opacity(screen.getByTestId('battle-feedback'))).toBe(1);
    await wait(320);
    expect(opacity(screen.getByTestId('battle-feedback'))).toBe(0);
  });

  it('leaves the other words 700 ms', async () => {
    await render(<FeedbackLabel texts={[{ tone: 'perfect', title: 'Parfait' }]} />);

    await wait(620);
    expect(opacity(screen.getByTestId('battle-feedback'))).toBeGreaterThan(0);
  });
});

describe('the momentum diamonds, emptied one by one', () => {
  const wanderer = { hp: 41, maxHp: 55, bulwark: false } as const;

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('empties the 3 spent diamonds one after the other, 150 ms each', async () => {
    await render(<HeroBar hero={{ ...wanderer, momentum: 3 }} kind="wanderer" />);
    expect(fills()).toEqual([1, 1, 1, 0, 0]);

    await screen.rerender(<HeroBar hero={{ ...wanderer, momentum: 0 }} kind="wanderer" />);
    await wait(160);
    const early = fills();
    expect(early[0]).toBe(0);
    expect(early[2]).toBe(1);
    await wait(300);
    expect(fills()).toEqual([0, 0, 0, 0, 0]);
  });

  it('empties them together with reduced motion', async () => {
    await render(<HeroBar hero={{ ...wanderer, momentum: 3 }} kind="wanderer" reducedMotion />);

    await screen.rerender(
      <HeroBar hero={{ ...wanderer, momentum: 0 }} kind="wanderer" reducedMotion />,
    );
    await wait(160);
    expect(fills()).toEqual([0, 0, 0, 0, 0]);
  });

  it('fills a gained diamond at once', async () => {
    await render(<HeroBar hero={{ ...wanderer, momentum: 0 }} kind="wanderer" />);

    await screen.rerender(<HeroBar hero={{ ...wanderer, momentum: 1 }} kind="wanderer" />);
    // Une image : le plein est déjà là.
    await wait(16);
    expect(fills()).toEqual([1, 0, 0, 0, 0]);
  });
});
