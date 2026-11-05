// L'étiquette de la Brûlure sous les PV du héros et son chiffre (#171, maquette 170, B1 à B7).
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { battleColors } from '../theme/battleColors';
import { DamageFloat } from './BattleEffects';
import { HeroBar } from './HeroBar';

const sentinel = { hp: 56, maxHp: 80, momentum: 2, bulwark: false };
const hiddenToo = { includeHiddenElements: true };

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

describe('the Burn chip (#171)', () => {
  it('shows a flame and « Brûlure ×3 » in ember orange under the HP', async () => {
    await render(<HeroBar hero={{ ...sentinel, burn: 3 }} />);

    expect(screen.getByText('Brûlure ×3', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-burn-flame', hiddenToo)).toBeTruthy();
    expect(style('battle-burn-chip')).toMatchObject({
      backgroundColor: battleColors.burnBg,
      borderColor: battleColors.burn,
      borderWidth: 1,
    });
    expect(battleColors).toMatchObject({ burn: '#D9733A', burnBg: '#3A2014', onBurn: '#FFC9A3' });
  });

  it('ends the label of the hero bar with the stacks, singular for one', async () => {
    await render(<HeroBar hero={{ ...sentinel, burn: 1 }} />);

    expect(
      screen.getByLabelText('La Sentinelle, PV 56 sur 80, Élan 2 sur 5, Brûlure, 1 charge'),
    ).toBeOnTheScreen();
  });

  it('sits right of the Bleed chip, on the same line, read after it', async () => {
    await render(<HeroBar hero={{ ...sentinel, bleed: { damage: 2, rounds: 3 }, burn: 5 }} />);

    const row = screen.getByTestId('battle-hero-ailments', hiddenToo);
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row' });
    expect(
      (row.children as unknown as { props: { testID?: string } }[]).map(
        ({ props }) => props.testID,
      ),
    ).toEqual(['battle-bleed-chip', 'battle-burn-chip']);
    expect(
      screen.getByLabelText(
        'La Sentinelle, PV 56 sur 80, Élan 2 sur 5, Saignement ×3, Brûlure, 5 charges',
      ),
    ).toBeOnTheScreen();
  });

  it('shows no Burn chip when the hero does not burn', async () => {
    await render(<HeroBar hero={sentinel} />);

    expect(screen.queryByText(/Brûlure/, hiddenToo)).toBeNull();
  });

  it.each([
    ['new', battleColors.burnRing],
    ['down', battleColors.burnSmoke],
  ] as const)(
    'rings the chip for 400 ms when a flame is lit or put out (%s)',
    async (kind, color) => {
      jest.useFakeTimers();
      await render(<HeroBar hero={{ ...sentinel, burn: 5 }} burnRing={{ kind, key: 1 }} />);

      expect(style('battle-burn-chip')).toMatchObject({ borderColor: color, borderWidth: 2 });
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(style('battle-burn-chip')).toMatchObject({
        borderColor: battleColors.burn,
        borderWidth: 1,
      });
      jest.useRealTimers();
    },
  );

  it('rings the chip again on the next burning blow, at 5 stacks too', async () => {
    jest.useFakeTimers();
    const hero = { ...sentinel, burn: 5 };
    await render(<HeroBar hero={hero} burnRing={{ kind: 'new', key: 1 }} />);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await screen.rerender(<HeroBar hero={hero} burnRing={{ kind: 'new', key: 2 }} />);

    expect(style('battle-burn-chip')).toMatchObject({ borderWidth: 2 });
    jest.useRealTimers();
  });
});

describe('the number of the Burn (#171)', () => {
  it('flies « −3 » in light ember orange, after a flame', async () => {
    await render(<DamageFloat float={{ at: 'hero', text: '−3', big: false, kind: 'burn' }} />);

    expect(screen.getByTestId('battle-burn-flame', hiddenToo)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('−3').props.style)).toMatchObject({
      color: battleColors.burnNumber,
    });
    expect(battleColors.burnNumber).toBe('#FF9F5A');
  });
});
