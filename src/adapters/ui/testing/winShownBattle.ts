// Réservé aux tests des écrans de l'ascension : le combat affiché, mené jusqu'à la victoire sur
// l'horloge de combat manuelle.
import { act } from '@testing-library/react-native';

import type { ManualBattleClock } from '../../../application/testing/ManualBattleClock';
import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { BattleSession } from '../../../application/useCases/BattleSession';

/** Suit les sessions de combat que l'écran ouvre : à appeler avant de monter l'écran. */
export function spyBattles(session: AscentSession): jest.SpyInstance<BattleSession, []> {
  return jest.spyOn(session, 'battleSession');
}

/**
 * Le combat affiché, mené jusqu'à la victoire : le héros attaque à son tour, sur la dernière
 * session de combat que l'écran a ouverte (`battles`).
 */
export async function winShownBattle(
  battles: jest.SpyInstance<BattleSession, []>,
  clock: ManualBattleClock,
): Promise<void> {
  const battle = battles.mock.results.at(-1)!.value as BattleSession;
  for (let guard = 0; guard < 400; guard += 1) {
    const current = battle.current()!.battle;
    if (current.phase.kind === 'over') break;
    await act(async () => {
      if (current.phase.kind === 'hero') {
        const at = clock.now() + 50;
        clock.advanceTo(at);
        battle.heroAction({ kind: 'attack' }, at - 20, at);
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
      for (let index = 0; index < 10; index += 1) await Promise.resolve();
    });
  }
  expect(battle.current()!.battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
}
