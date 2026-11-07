// Le retour visuel du déblocage dans l'arbre (#235, maquette 232 : D1 et la chronologie du
// déblocage) : le nœud s'allume de l'ombre à la couleur en 3 pas sur 600 ms, un anneau d'or
// s'ouvre derrière lui en 6 pas sur 900 ms. En mouvement réduit, le nœud s'allume d'un coup et
// l'anneau apparaît en fondu, sans grandir.
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { PowerTreeNode, unlockLight, unlockRing } from './PowerTreeNode';

const hiddenToo = { includeHiddenElements: true } as const;

describe('the light of an unlocked node (D1)', () => {
  it('lights the node from the shadow in 3 steps of 200 ms', () => {
    expect([0, 1, 2, 3].map((frame) => unlockLight(frame, false))).toEqual([0, 1 / 3, 2 / 3, 1]);
  });

  it('lights it at once with reduced motion', () => {
    expect(unlockLight(0, true)).toBe(1);
  });

  it('opens the golden ring in 6 steps: bright at 40 %, then 35 %, from 40 % of its size', () => {
    expect(unlockRing(0, false)).toEqual({ opacity: 0, scale: 0.4 });
    expect(unlockRing(6, false)).toEqual({ opacity: 0.35, scale: 1 });
    const peak = unlockRing(3, false);
    expect(peak.opacity).toBeGreaterThan(0.75);
    expect(peak.scale).toBeCloseTo(0.7, 5);
    expect(unlockRing(2, false).opacity).toBeCloseTo(5 / 6, 5);
  });

  it('fades the ring in without growing it with reduced motion', () => {
    expect(unlockRing(0, true)).toEqual({ opacity: 0, scale: 1 });
    expect(unlockRing(3, true)).toEqual({ opacity: 0.5, scale: 1 });
    expect(unlockRing(6, true)).toEqual({ opacity: 1, scale: 1 });
  });
});

describe('PowerTreeNode just unlocked (D1)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const ring = () =>
    StyleSheet.flatten(screen.getByTestId('power-node-ring-retaliation', hiddenToo).props.style);
  const saturation = () => screen.getByTestId('power-icon-retaliation', hiddenToo).props.saturation;

  /** `ms` ms, pas à pas : chaque image programme la suivante. */
  async function wait(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      await act(async () => jest.advanceTimersByTime(50));
    }
  }

  describe('with motion', () => {
    beforeEach(() => withMotion());

    it('lights the icon in 600 ms and opens the ring in 900 ms', async () => {
      await render(
        <PowerTreeNode code="retaliation" state={{ kind: 'unlocked' }} fresh onPress={jest.fn()} />,
      );
      await act(async () => undefined);

      expect(saturation()).toBe(0);
      expect(ring().opacity).toBe(0);
      await wait(200);
      expect(saturation()).toBeCloseTo(1 / 3, 5);
      await wait(400);
      expect(saturation()).toBe(1);
      await wait(300);
      expect(ring()).toMatchObject({ opacity: 0.35 });
    });
  });

  describe('with reduced motion', () => {
    reduceMotionInEachTest();

    it('lights the icon at once and fades the ring in', async () => {
      await render(
        <PowerTreeNode code="retaliation" state={{ kind: 'unlocked' }} fresh onPress={jest.fn()} />,
      );
      await act(async () => undefined);

      expect(saturation()).toBe(1);
      await wait(900);
      expect(ring()).toMatchObject({ opacity: 1, transform: [{ scale: 1 }] });
    });
  });

  it('has no ring when it is not just unlocked', async () => {
    await render(
      <PowerTreeNode code="retaliation" state={{ kind: 'unlocked' }} onPress={jest.fn()} />,
    );

    expect(screen.queryByTestId('power-node-ring-retaliation', hiddenToo)).toBeNull();
    expect(saturation()).toBe(1);
  });
});

describe('PowerTreeNode under an Oath (#237, S7)', () => {
  it('carries the blue link of the Oath in its top left corner, and reads its habit', async () => {
    await render(
      <PowerTreeNode
        code="retaliation"
        state={{ kind: 'unlocked' }}
        sworn="Courir 20 minutes"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId('power-node-oath-retaliation', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('power-node-retaliation').props.accessibilityLabel).toMatch(
      /, Serment : Courir 20 minutes$/u,
    );
  });

  it('has no link without an Oath', async () => {
    await render(
      <PowerTreeNode code="retaliation" state={{ kind: 'unlocked' }} onPress={jest.fn()} />,
    );

    expect(screen.queryByTestId('power-node-oath-retaliation', hiddenToo)).not.toBeOnTheScreen();
  });
});
