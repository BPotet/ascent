// L'écran de combat et la seconde chance (#206, maquette 205, S1 à S4) : la pastille sous les PV,
// le relèvement passé à la scène, le bandeau d'or et le « +40 », les touches verrouillées, l'annonce
// au lecteur d'écran, et la chute quand elle a déjà servi.
import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { BattleFactory } from '../../../application/useCases/BattleSession';
import { startBattle } from '../../../domain/battle/Battle';
import type { HeroState } from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { SceneSecondChance } from '../battle/scene/secondChanceRise';
import { renderBattle, type BattleScreenTest } from '../testing/battleScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hiddenToo = { includeHiddenElements: true } as const;
const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

/** La Sentinelle à 1 PV sur 80 contre des Goules, avec sa seconde chance `secondChance`. */
function falling(
  secondChance: HeroState['secondChance'] = 'ready',
  enemies: readonly EnemyKind[] = ['ghoul'],
): BattleFactory {
  return (options) => {
    const update = startBattle({
      ...options,
      heroHp: 1,
      heroMaxHp: 80,
      enemies,
      secondChance: true,
    });
    return {
      ...update,
      battle: { ...update.battle, hero: { ...update.battle.hero, secondChance } },
    };
  };
}

function sceneRise(): SceneSecondChance | null {
  return (
    screen.getByTestId('battle-scene', hiddenToo).props as {
      secondChance: SceneSecondChance | null;
    }
  ).secondChance;
}

async function toRise(test: BattleScreenTest): Promise<void> {
  await test.attack();
  await test.runUntil(() => test.battle().hero.secondChance === 'used');
}

describe('BattleScreen: the second chance (#206)', () => {
  it('shows the green chip under the HP while it is ready (S1)', async () => {
    await renderBattle({ seed: 1, createBattle: falling() });

    expect(screen.getByTestId('battle-second-chance-chip', hiddenToo)).toBeOnTheScreen();
    expect(
      screen.getByLabelText('La Sentinelle, PV 1 sur 80, Élan 1 sur 5, seconde chance prête'),
    ).toBeOnTheScreen();
    expect(sceneRise()).toBeNull();
    expect(screen.queryByTestId('second-chance-banner', hiddenToo)).toBeNull();
  });

  it('raises the hero: the scene, the banner, the « +40 » in gold and the locked buttons (S2, S3)', async () => {
    announce.mockClear();
    const test = await renderBattle({ seed: 1, createBattle: falling() });

    await toRise(test);

    const rise = test.snapshots
      .flatMap((snapshot) => snapshot.events)
      .find((event) => event.type === 'secondChanceUsed')!;
    expect(sceneRise()).toEqual({ at: rise.at, until: rise.at + 2_000 });
    expect(screen.getByTestId('second-chance-banner', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('La Sentinelle se relève avec 40 PV.', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('battle-rise-float', hiddenToo)).toHaveTextContent('+40');
    expect(screen.getByTestId('battle-hero-rise', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Parade/u })).toBeDisabled();
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Seconde chance : la Sentinelle se relève avec 40 PV\./u),
    );
    expect(
      screen.getByLabelText(/^La Sentinelle, PV 40 sur 80, .*, seconde chance utilisée$/u),
    ).toBeOnTheScreen();
  });

  it('frees the buttons at the end of the rise, when the next Ghoul steps in', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: falling('ready', ['ghoul', 'ghoul']),
    });
    await toRise(test);
    const { until } = sceneRise()!;

    await test.advanceTo(until);

    expect(screen.getByRole('button', { name: /Parade/u })).not.toBeDisabled();
  });

  it('says the second chance has already served at the fall, under the defeat (S4)', async () => {
    announce.mockClear();
    const test = await renderBattle({ seed: 1, createBattle: falling('used') });

    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'over');

    expect(screen.getByText('Ta seconde chance a déjà servi.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Combat perdu. Ta seconde chance a déjà servi.');
  });

  it('says nothing of it at a fall without a second chance', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: (options) =>
        startBattle({ ...options, heroHp: 1, heroMaxHp: 80, enemies: ['ghoul'] }),
    });

    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'over');

    expect(screen.queryByText('Ta seconde chance a déjà servi.')).toBeNull();
    expect(screen.queryByTestId('battle-second-chance-chip', hiddenToo)).toBeNull();
  });
});
