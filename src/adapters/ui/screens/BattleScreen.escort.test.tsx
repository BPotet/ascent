// L'écran de combat contre une Élite escortée (#257, maquette 245, E2, E3, E5, E9) : la couronne,
// la mise en page de l'Élite qui mène, la cible changée d'un toucher, et « L'escorte reste » quand
// l'Élite tombe devant son escorte.
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { BattleFactory } from '../../../application/useCases/BattleSession';
import { TIERS } from '../../../domain/ascent/tiers';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import { renderBattle } from '../testing/battleScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hiddenToo = { includeHiddenElements: true } as const;

/** Le Premier Pèlerin escorté du Veilleur d'airain et du Novice des cloches, au palier 3. */
function escorted(change: (battle: Battle) => Battle = (battle) => battle): BattleFactory {
  return (options) => {
    const update = startBattle({
      ...options,
      initiative: true,
      enemies: ['firstPilgrim', 'bronzeWarden', 'bellNovice'],
      tierMultiplier: TIERS[3].eliteMultiplier,
      escortMultiplier: TIERS[3].multiplier,
    });
    return { ...update, battle: change(update.battle) };
  };
}

describe('BattleScreen: an escorted Elite (#257)', () => {
  it('crowns the Elite, the default target, and lays its escort in the lead layout (E2)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: escorted() });
    await test.runUntil(() => test.battle().phase.kind === 'hero');

    expect(test.battle().target).toBe(0);
    expect(screen.getByTestId('enemy-firstPilgrim-crown', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryByTestId('enemy-bronzeWarden-crown', hiddenToo)).toBeNull();
    expect(screen.getByLabelText(/^Premier Pèlerin, Élite, cible, /u, hiddenToo)).toBeOnTheScreen();
    // L'Élite sur 1,25 colonne, plus haute que son escorte.
    const column = (kind: string) =>
      StyleSheet.flatten(screen.getByTestId(`enemy-${kind}`, hiddenToo).props.style) as {
        width: number;
        top: number;
      };
    expect(column('firstPilgrim').width).toBe(Math.floor(column('bronzeWarden').width * 1.25));
    expect(column('bellNovice').width).toBe(column('bronzeWarden').width);
    expect(column('firstPilgrim').top).toBeLessThan(column('bronzeWarden').top);
  });

  it('aims at an escort enemy with a touch on its column (E3)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: escorted() });
    await test.runUntil(() => test.battle().phase.kind === 'hero');

    await test.touchEnemy(2);

    expect(test.battle().target).toBe(2);
    expect(screen.getByLabelText(/^Novice des cloches, cible, /u, hiddenToo)).toBeOnTheScreen();
  });

  it("says « L'escorte reste » when the Elite falls first, the target on the escort (E9)", async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: escorted((battle) => ({
        ...battle,
        enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 1 } : enemy)),
      })),
    });
    await test.runUntil(() => test.battle().phase.kind === 'hero');

    await test.attack();
    await test.runUntil(() => test.battle().enemies[0]!.hp === 0);

    expect(test.battle().phase.kind).not.toBe('over');
    expect(test.battle().target).toBe(1);
    expect(screen.getByText("L'escorte reste", hiddenToo)).toBeOnTheScreen();
  });
});
