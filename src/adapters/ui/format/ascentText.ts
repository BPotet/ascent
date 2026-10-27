import { TOP_FLOOR } from '../../../domain/ascent/Ascent';
import type { Exit } from '../../../domain/ascent/exits';

/** Les libellés de l'ascension (prototype #91), tirés du glossaire et de la maquette de #88. */
export const TOWER_TITLE = 'La tour';
export const TIER_LINE = 'Palier 1 · les Catacombes · 6 étages';

export function floorLine(floor: number): string {
  return `Palier 1 · Étage ${floor} sur ${TOP_FLOOR}`;
}

export function goldText(gold: number): string {
  return `${gold} Or`;
}

export function enemiesText(count: number): string {
  return count === 1 ? '1 ennemi' : `${count} ennemis`;
}

/** Le libellé d'une porte : la porte Combat annonce la taille du groupe, pas sa composition. */
export function exitLabel(exit: Exit): string {
  switch (exit.kind) {
    case 'combat':
      return `Combat · ${enemiesText(exit.groupSize ?? 0)}`;
    case 'elite':
      return 'Élite · le Chevalier déchu';
    case 'campfire':
      return 'Feu de camp · soin de 40 % des PV';
    case 'boss':
      return 'Affronter le boss';
  }
}
