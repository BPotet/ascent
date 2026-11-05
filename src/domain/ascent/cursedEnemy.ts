/**
 * L'ennemi maudit (`CursedEnemy`, #209, ADR 0018) : sous la malédiction, un ennemi de chaque combat
 * ordinaire est maudit, et l'Élite aussi sous la malédiction forte ; jamais le boss. Ce qu'il gagne
 * est la règle du combat (`battle/curse.ts`).
 */
import { FRONT_LINE_SIZE } from '../battle/Battle';
import { ENEMIES, type EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawInt, type Drawn } from './draw';
import type { FateGauge } from './fateGauge';

/** La malédiction (−1) ou la malédiction forte (−2) : un ennemi maudit par combat ordinaire. */
export function cursedOrdinary(gauge: FateGauge): boolean {
  return gauge <= -1;
}

/** La malédiction forte (−2) seulement : l'Élite est maudite. */
export function cursedElite(gauge: FateGauge): boolean {
  return gauge === -2;
}

/**
 * L'indice de l'ennemi maudit d'un groupe, tiré à égalité parmi sa première ligne, jamais un
 * soutien ni un ennemi de la réserve. Un soutien n'est jamais seul et chaque palier n'en tire qu'un :
 * la première ligne a toujours un candidat.
 */
export function drawCursedEnemy(enemies: readonly EnemyKind[], random: RandomState): Drawn<number> {
  const candidates = enemies
    .slice(0, FRONT_LINE_SIZE)
    .flatMap((kind, index) => (ENEMIES[kind].supports ? [] : [index]));
  const drawn = drawInt(0, candidates.length - 1, random);
  return { value: candidates[drawn.value]!, random: drawn.random };
}
