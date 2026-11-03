// L'écran de combat contre la Reine des phalènes (#172, maquette 170, I1 à I5) : les atlas des
// Phalénides préparés avant le combat, l'annonce, la poussière passée à la scène, les colonnes à la
// disposition du boss qui invoque, et la chute des Phalénides avec la Reine.
import { screen, within } from '@testing-library/react-native';

import type { BattleFactory } from '../../../application/useCases/BattleSession';
import { TIERS } from '../../../domain/ascent/tiers';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { SceneSummon } from '../battle/scene/summonDust';
import { preparedKinds } from '../battle/testing/fakeBattleCanvas';
import { renderBattle, type BattleScreenTest } from '../testing/battleScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hiddenToo = { includeHiddenElements: true } as const;

/** La Reine seule, à `hp` PV ; les Phalénides ont les valeurs du palier 2. */
function queenAt(
  hp: number,
  change: (battle: Battle) => Battle = (battle) => battle,
): BattleFactory {
  return (options) => {
    const update = startBattle({
      ...options,
      initiative: true,
      enemies: ['mothQueen'],
      summonMultiplier: TIERS[2].multiplier,
    });
    const battle = update.battle;
    return {
      ...update,
      battle: change({ ...battle, enemies: [{ ...battle.enemies[0]!, hp, guard: 60 }] }),
    };
  };
}

function sceneSummon(): SceneSummon {
  return (screen.getByTestId('battle-scene', hiddenToo).props as { summon: SceneSummon }).summon;
}

function types(test: BattleScreenTest): string[] {
  return test.snapshots.flatMap((snapshot) => snapshot.events.map((event) => event.type));
}

/** Le héros attaque à son tour jusqu'à l'annonce de l'Invocation. */
async function toAnnouncement(test: BattleScreenTest): Promise<void> {
  await test.runUntil(() => test.battle().phase.kind === 'hero');
  await test.attack();
  await test.runUntil(() => types(test).includes('summonCalled'));
}

describe('BattleScreen: the Summon of the Moth queen (#172)', () => {
  it('prepares the atlas of the Mothkin with the Queen, before the battle shows', async () => {
    preparedKinds.length = 0;

    await renderBattle({ seed: 1, createBattle: queenAt(400) });

    expect(preparedKinds).toContainEqual(['mothQueen', 'mothkin']);
  });

  it('shows the Queen alone in her single column, without dust', async () => {
    await renderBattle({ seed: 1, createBattle: queenAt(400) });

    expect(sceneSummon()).toEqual({ pending: [], calledAt: null, entered: {}, fell: {} });
    expect(screen.getAllByTestId(/^enemy-[a-zA-Z]+$/u, hiddenToo)).toHaveLength(1);
    expect(screen.queryByTestId('summon-banner', hiddenToo)).toBeNull();
  });

  it('shows the banner and gives the scene the dust of the two Mothkin at the announcement', async () => {
    const test = await renderBattle({ seed: 1, createBattle: queenAt(201) });

    await toAnnouncement(test);

    expect(screen.getByText('Elle appelle les Phalénides', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('La Reine des phalènes change de phase', hiddenToo)).toBeOnTheScreen();
    const summon = sceneSummon();
    expect(summon.pending).toEqual([1, 2]);
    expect(summon.calledAt).toEqual(expect.any(Number));
    // Une colonne par ennemi, aucune pour la poussière.
    expect(screen.getAllByTestId(/^enemy-[a-zA-Z]+$/u, hiddenToo)).toHaveLength(1);
  });

  it('puts the dust, the banner and the summoned columns in the shaking scene, above the veil (#188)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: queenAt(201) });
    await toAnnouncement(test);

    const shaking = within(screen.getByTestId('battle-scene-shake', hiddenToo));
    expect(shaking.getByTestId('summon-banner', hiddenToo)).toBeOnTheScreen();
    expect(
      (shaking.getByTestId('battle-scene', hiddenToo).props as { summon: SceneSummon }).summon
        .pending,
    ).toEqual([1, 2]);
    await test.runUntil(() => types(test).includes('summonEntered'));
    expect(shaking.getAllByTestId('enemy-mothkin', hiddenToo)).toHaveLength(2);
  });

  it('lays the dust from the state in a resumed battle, without the banner', async () => {
    await renderBattle({
      seed: 1,
      createBattle: queenAt(190, (battle) => ({
        ...battle,
        enemies: [{ ...battle.enemies[0]!, phase2: true }],
        summon: { summoner: 0, kind: 'mothkin', slots: [1, 2] },
      })),
    });

    expect(sceneSummon()).toMatchObject({ pending: [1, 2], calledAt: null });
    expect(screen.queryByTestId('summon-banner', hiddenToo)).toBeNull();
  });

  it('brings the two Mothkin out of the dust, tagged « Invoquée », at the next round', async () => {
    const test = await renderBattle({ seed: 1, createBattle: queenAt(201) });
    await toAnnouncement(test);

    await test.runUntil(() => types(test).includes('summonEntered'));

    expect(screen.getAllByTestId('enemy-mothkin', hiddenToo)).toHaveLength(2);
    expect(screen.getAllByText('Invoquée')).toHaveLength(2);
    expect(sceneSummon()).toMatchObject({ pending: [] });
    expect(Object.keys(sceneSummon().entered)).toEqual(['1', '2']);
  });

  it('drops the Mothkin back into dust when the Queen falls', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: (options) => {
        const update = startBattle({
          ...options,
          initiative: true,
          enemies: ['mothQueen', 'mothkin', 'mothkin'],
        });
        const [queen, ...mothkin] = update.battle.enemies;
        const stunned = { actionLost: false, heroAction: 999 };
        return {
          ...update,
          battle: {
            ...update.battle,
            enemies: [
              { ...queen!, hp: 1, guard: 0, phase2: true, stun: stunned },
              ...mothkin.map((enemy) => ({ ...enemy, summoned: true as const, stun: stunned })),
            ],
          },
        };
      },
    });
    await test.runUntil(() => test.battle().phase.kind === 'hero');
    await test.attack();

    await test.runUntil(() => types(test).includes('summonedFell'));

    expect(Object.keys(sceneSummon().fell)).toEqual(['1', '2']);
  });
});
