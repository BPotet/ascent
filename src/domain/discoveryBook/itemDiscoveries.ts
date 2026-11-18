import type { Ascent } from '../ascent/Ascent';
import type { ItemKind } from '../ascent/items';

/**
 * L'objet découvert par une transition de l'ascension (`foundItemDiscovery`, #284, D1, O2) :
 * l'objet trouvé d'après s'il diffère de celui d'avant. C'est l'instant où il est montré sur
 * « Objet trouvé » (l'écran s'affiche dès qu'un objet trouvé attend). Seuls la fin d'un combat
 * (butin d'un combat ordinaire, objet garanti d'une Élite) et l'ouverture du Coffre scellé posent
 * un objet trouvé : le boss, le Feu de camp, la porte Élite, un Coffre scellé laissé ou fermé et
 * l'achat d'un Déblocage ne découvrent rien (O3). Équiper ou laisser le remet à `null` après coup.
 */
export function foundItemDiscovery(before: Ascent | null, after: Ascent): ItemKind | null {
  const item = after.foundItem;
  return item !== null && item !== before?.foundItem ? item : null;
}

/**
 * Les objets découverts à la reprise d'une ascension (`resumeItemDiscoveries`, O4) : l'objet trouvé
 * en attente, puis les objets portés (arme, armure, accessoire), sans l'équipement de base ni
 * doublon.
 */
export function resumeItemDiscoveries(ascent: Ascent): ItemKind[] {
  const { weapon, armor, accessory } = ascent.equipment;
  const items = [ascent.foundItem, weapon, armor, accessory].filter(
    (item): item is ItemKind => item !== null,
  );
  return [...new Set(items)];
}
