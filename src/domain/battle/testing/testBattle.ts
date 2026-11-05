/**
 * Aide de test : le combat de test, la Sentinelle (ou l'Errante) contre la Goule, le Spectre et le
 * Nécromancien, en phase du héros (C1). Avec l'Initiative, le premier de l'ordre ouvre le combat.
 * Il sert aux tests qui éprouvent les règles du combat, hors de l'ascension.
 */
import { startBattle, type BattleStartOptions, type BattleUpdate } from '../Battle';
import type { EnemyKind } from '../combatants';

/** Les ennemis du combat de test, de gauche à droite : la Goule, le Spectre et le Nécromancien. */
export const TEST_BATTLE_ENEMIES: readonly EnemyKind[] = ['ghoul', 'specter', 'necromancer'];

export function startTestBattle(options: BattleStartOptions): BattleUpdate {
  return startBattle({ ...options, enemies: TEST_BATTLE_ENEMIES });
}
