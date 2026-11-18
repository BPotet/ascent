/**
 * Aides des scénarios des Objets du carnet (#284) : une ascension sauvegardée pendant un combat
 * d'étage dont chaque ennemi est à 1 PV, gagné en quelques coups, et les graines dont l'objet
 * garanti d'une Élite, ou l'objet de son coffre scellé, est celui qu'on cherche.
 */
import {
  endFloorBattle,
  leaveItem,
  openSealedChest,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../src/domain/ascent/Ascent';
import type { ItemKind } from '../../src/domain/ascent/items';
import type { AscentSession } from '../../src/application/useCases/AscentSession';
import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import { withEnemyAt } from '../../src/domain/battle/testing/withEnemyAt';

export const ELITE: Encounter = { kind: 'elite', enemies: ['twins'], battleSeed: 1 };

/** L'ascension de graine `seed` à l'étage 3, devant l'Élite, avec `keys` clés. */
export const beforeElite = (seed: number, keys = 1): Ascent => ({
  ...startAscent(seed, { gauge: 1 }),
  floor: 3,
  encounter: ELITE,
  keys,
});

/** L'Élite gagnée : son objet garanti en attente, son coffre scellé derrière. */
export const afterElite = (seed: number, keys = 1): Ascent =>
  endFloorBattle(beforeElite(seed, keys), { outcome: 'victory', heroHp: 1 });

/** La première graine dont l'objet garanti de l'Élite est `item`. */
export function seedForEliteItem(item: ItemKind): number {
  for (let seed = 1; seed < 2_000; seed += 1) {
    if (afterElite(seed).foundItem === item) return seed;
  }
  throw new Error(`No seed gives ${item}`);
}

/** La première graine dont le coffre scellé, ouvert après l'Élite, révèle `item`. */
export function seedForChestItem(item: ItemKind, after = 0): number {
  for (let seed = after + 1; seed < 2_000; seed += 1) {
    if (openSealedChest(leaveItem(afterElite(seed))).foundItem === item) return seed;
  }
  throw new Error(`No seed gives ${item} in the sealed chest`);
}

/** L'ascension `ascent` et son combat sauvegardés, chaque ennemi à 1 PV, en JSON. */
export function savedFight(ascent: Ascent): string {
  const started = startBattle({
    seed: ascent.encounter!.battleSeed,
    defenseHint: false,
    at: 500,
    initiative: true,
    enemies: ascent.encounter!.enemies,
  }).battle;
  const battle = started.enemies.reduce(
    (weak: Battle, _, index) => withEnemyAt(weak, index, { hp: 1 }),
    started,
  );
  return JSON.stringify({ version: 1, ascent, battle });
}

async function settle(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

/** Gagne le combat d'étage en cours : le héros attaque à son tour, sinon le temps avance. */
export async function winFloorBattle(
  session: AscentSession,
  clock: ManualBattleClock,
): Promise<void> {
  const battleSession = session.battleSession();
  await battleSession.start();
  for (let guard = 0; guard < 600; guard += 1) {
    const { battle } = battleSession.current()!;
    if (battle.phase.kind === 'over') break;
    const { phase } = battle;
    if (phase.kind === 'hero') {
      const at = clock.now() + 50;
      clock.advanceTo(at);
      battleSession.heroAction({ kind: 'attack' }, at - 20, at);
    } else if (phase.kind === 'heroStrike' && phase.press === null) {
      clock.advanceTo(phase.impactAt);
      battleSession.pressStrike(phase.impactAt);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await settle();
  }
  // Les attentes de la fin du combat (fumée, chute des invoqués) passent.
  clock.advanceTo(clock.now() + 5_000);
  await settle();
  if (session.current()!.encounter !== null) throw new Error('The battle was not won');
}
