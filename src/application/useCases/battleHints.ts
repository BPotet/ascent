import type { EnemyKind } from '../../domain/battle/combatants';
import type { PreferenceDependencies } from './checkInHint';

/**
 * Les bulles d'aide du combat (`BattleHint`) : en phase du héros, avant la phase ennemie, et au
 * premier combat avec 2 pouvoirs ou plus (#235, K11).
 */
export type BattleHintKind = 'hero' | 'defense' | 'powers';

export const BATTLE_HINT_SEEN_KEYS: Readonly<Record<BattleHintKind, string>> = {
  hero: 'battle.hint.hero.seen',
  defense: 'battle.hint.defense.seen',
  powers: 'battle.hint.powers.seen',
};

/** Cas d'usage : faut-il montrer cette bulle d'aide ? Oui tant qu'elle n'a pas été vue. */
export async function getBattleHint(
  { keyValueStore }: PreferenceDependencies,
  kind: BattleHintKind,
): Promise<boolean> {
  return (await keyValueStore.get(BATTLE_HINT_SEEN_KEYS[kind])) === null;
}

/** Cas d'usage : la bulle d'aide a été vue ; elle n'apparaît plus aux combats suivants. */
export async function dismissBattleHint(
  { keyValueStore }: PreferenceDependencies,
  kind: BattleHintKind,
): Promise<void> {
  await keyValueStore.set(BATTLE_HINT_SEEN_KEYS[kind], '1');
}

/**
 * La clé de la bulle de première rencontre d'une Élite à signature (#258, D8) : une par Élite, par
 * son nom de code.
 */
export function encounterHintKey(enemy: EnemyKind): string {
  return `battle.hint.encounter.${enemy}.seen`;
}

/** Cas d'usage : faut-il montrer la bulle de première rencontre de `enemy` ? Oui tant qu'elle n'a pas été vue. */
export async function getEncounterHint(
  { keyValueStore }: PreferenceDependencies,
  enemy: EnemyKind,
): Promise<boolean> {
  return (await keyValueStore.get(encounterHintKey(enemy))) === null;
}

/** Cas d'usage : la bulle de première rencontre de `enemy` a été vue ; elle ne revient pas. */
export async function dismissEncounterHint(
  { keyValueStore }: PreferenceDependencies,
  enemy: EnemyKind,
): Promise<void> {
  await keyValueStore.set(encounterHintKey(enemy), '1');
}
