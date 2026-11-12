/**
 * L'ennemi maudit (`CursedEnemy`, #209, ADR 0018) : sous la malédiction, un ennemi de chaque combat
 * ordinaire est maudit, et l'Élite aussi sous la malédiction forte ; jamais le boss. Depuis #257,
 * un ennemi d'escorte de l'Élite escortée est maudit sous la malédiction. Ce qu'il gagne est la
 * règle du combat (`battle/curse.ts`).
 */
import { FRONT_LINE_SIZE } from '../battle/Battle';
import { ENEMIES, type EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import { drawInt, type Drawn } from './draw';
import type { FateGauge } from './fateGauge';
import { TIERS, type Tier } from './tiers';

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
 * la première ligne a toujours un candidat. Le Porte-cierge (#268), jamais seul sans être un
 * soutien, peut être maudit.
 */
export function drawCursedEnemy(enemies: readonly EnemyKind[], random: RandomState): Drawn<number> {
  const candidates = enemies
    .slice(0, FRONT_LINE_SIZE)
    .flatMap((kind, index) => (ENEMIES[kind].supports ? [] : [index]));
  const drawn = drawInt(0, candidates.length - 1, random);
  return { value: candidates[drawn.value]!, random: drawn.random };
}

/**
 * Qui est maudit dans le combat d'Élite (#257, EE8), au plus un ennemi : l'Élite sous la
 * malédiction forte (−2), un ennemi d'escorte sous la malédiction (−1) quand l'Élite est escortée
 * (paliers 2 et 3), sinon personne (le palier 1 à −1, comme avant #257).
 */
export function eliteCurse(tier: Tier, gauge: FateGauge): 'elite' | 'escort' | null {
  if (cursedElite(gauge)) return 'elite';
  return cursedOrdinary(gauge) && TIERS[tier].escortSize > 0 ? 'escort' : null;
}

/**
 * L'indice de l'ennemi d'escorte maudit (#257, EE8), tiré à égalité parmi l'escorte de `size`
 * ennemis, de 1 à `size` : jamais l'Élite, à l'indice 0. Le tirage est fait même avec un seul
 * candidat.
 */
export function drawCursedEscort(size: number, random: RandomState): Drawn<number> {
  return drawInt(1, size, random);
}
