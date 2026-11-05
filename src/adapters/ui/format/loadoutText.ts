import type { StartingBlessing } from '../../../domain/ascent/blessings';
import { loadoutSize, type Loadout } from '../../../domain/ascent/loadout';
import { rarityMarks, rarityName } from './rarityText';

/** Les textes de l'Équipement (`Loadout`, #159), tirés de la maquette #153. */
export const LOADOUT_SUBTITLE = "Tes bénédictions et tes bienfaits, jusqu'à la fin de l'ascension.";

/** Les messages d'état vide de la feuille. */
export const NO_BLESSING_YET =
  "Aucune bénédiction de départ : aucune habitude faite hier ne l'a donnée.";
export const NO_BOON_YET = "Aucun bienfait pour l'instant. Gagne un combat pour en choisir un.";

/** Les messages d'état vide du pied de la tour. */
export const NO_BLESSING = 'Aucune bénédiction de départ';
export const NO_BOON = 'Aucun bienfait';

/** « 1 bienfait », « 3 bénédictions de départ ». */
function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

/**
 * Ce que lit le lecteur d'écran sur le bouton « Équipement » : « Équipement : 3 bénédictions de
 * départ, 5 bienfaits. Ouvre la liste », ou « Équipement : vide. Ouvre la liste » ; en combat,
 * suivi de « . Met le combat en pause ».
 */
export function loadoutButtonLabel(loadout: Loadout, { combat }: { combat: boolean }): string {
  const parts = [
    ...(loadout.blessings.length > 0
      ? [counted(loadout.blessings.length, 'bénédiction de départ', 'bénédictions de départ')]
      : []),
    ...(loadout.boons.length > 0 ? [counted(loadout.boons.length, 'bienfait', 'bienfaits')] : []),
  ];
  const content = loadoutSize(loadout) === 0 ? 'vide' : parts.join(', ');
  return `Équipement : ${content}. Ouvre la liste${combat ? '. Met le combat en pause' : ''}`;
}

/** Le titre de la section du pied de la tour : « Équipement · 3 ». */
export function loadoutTitle(count: number): string {
  return `Équipement · ${count}`;
}

/** La ligne de rareté d'une bénédiction dans la feuille : « ◆◆ Bénédiction · Rare ». */
export function blessingTag({ rarity }: StartingBlessing): string {
  return `${rarityMarks(rarity)} Bénédiction · ${rarityName(rarity, 'feminine')}`;
}
