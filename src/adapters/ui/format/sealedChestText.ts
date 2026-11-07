/**
 * Les textes du coffre scellé (`SealedChest`), des clés (`Key`) et de l'entrée dans la tour (#226),
 * repris de la maquette 208 (S2, S3, S7, S8, F4, F5).
 */
import type { Rarity } from '../../../domain/ascent/rarity';
import { rarityLine } from './rarityText';

/** « 1 clé », « 2 clés ». */
export function keysText(keys: number): string {
  return `${keys} clé${keys > 1 ? 's' : ''}`;
}

export const SEALED_CHEST_TITLE = 'Coffre scellé';
/** La ligne au-dessus du titre (S2, S7). */
export const SEALED_CHEST_SOURCE = "Après l'Élite";
export const SEALED_CHEST_CONTENT =
  "Il s'ouvre avec une clé. Dedans : un objet Rare, parfois Épique.";
export const LEAVE_FOR_GOOD = 'Laissé fermé, il ne revient pas.';
export const OPENS_WITH_A_KEY = "Il s'ouvre avec une clé.";
export const OPEN_WITH_A_KEY = 'Ouvrir · 1 clé';
export const NO_KEY = 'Aucune clé';
export const NO_KEY_LABEL = 'Aucune clé : il faut une clé pour ouvrir ce coffre';
export const NOTHING_LOST = "Pas de clé : rien n'est perdu.";
export const SEALED_CHEST_OPENING = "Le coffre s'ouvre…";
/** Au-dessus de l'objet révélé (S4, S5). */
export const FROM_SEALED_CHEST = 'Du coffre scellé';

/** Ce que lit le lecteur d'écran sur « Ouvrir · 1 clé » : « … il t'en reste 2 ». */
export function openLabel(keys: number): string {
  return `Ouvrir avec une clé, il t'en reste ${keys}`;
}

/** L'annonce polie de l'ouverture, avec les clés qui restent (S3). */
export function sealedOpenedAnnouncement(keys: number): string {
  const left = keys > 0 ? `Il te reste ${keysText(keys)}.` : "Tu n'as plus de clé.";
  return `Coffre scellé ouvert. ${left}`;
}

/** Le bandeau de l'offre de bienfaits après « Laisser » (S8). */
export function sealedLeftBand(keys: number): string {
  return `Coffre scellé laissé fermé. Tu gardes ${keys > 1 ? `tes ${keysText(keys)}` : 'ta clé'}.`;
}

/** L'annonce polie après « Laisser » (S8). */
export function sealedLeftAnnouncement(keys: number): string {
  return `Coffre scellé laissé. Tu gardes ${keysText(keys)}.`;
}

/** Les clés reçues au lancement de l'ascension, par source (#226, F4). */
export interface KeysEntrySources {
  readonly favor: number;
  readonly fortune: number;
}

/** Une ligne de l'entrée dans la tour : « 2 de Fortune · ◆◆ Rare ». */
export interface KeysEntryLine {
  readonly count: string;
  readonly source: string;
  readonly rarity?: string;
}

/** Le titre de l'entrée : « +3 clés ». */
export function keysEntryTitle(keys: number): string {
  return `+${keysText(keys)}`;
}

/** Les lignes de l'entrée : la faveur, puis Fortune avec sa rareté (F4, F5). */
export function keysEntryLines(
  { favor, fortune }: KeysEntrySources,
  fortuneRarity: Rarity | null,
): KeysEntryLine[] {
  return [
    ...(favor > 0 ? [{ count: String(favor), source: 'de la faveur' }] : []),
    ...(fortune > 0
      ? [
          {
            count: String(fortune),
            source: 'de Fortune',
            ...(fortuneRarity !== null && { rarity: rarityLine(fortuneRarity, 'feminine') }),
          },
        ]
      : []),
  ];
}

/** « Elles ouvrent le coffre scellé d'une Élite. », au singulier pour une seule clé. */
export function keysEntryUse(keys: number): string {
  return keys > 1
    ? "Elles ouvrent le coffre scellé d'une Élite."
    : "Elle ouvre le coffre scellé d'une Élite.";
}

/** L'annonce polie de l'entrée : « +3 clés : 1 de la faveur, 2 de Fortune. Elles ouvrent … ». */
export function keysEntryAnnouncement(sources: KeysEntrySources): string {
  const total = sources.favor + sources.fortune;
  const lines = keysEntryLines(sources, null).map(({ count, source }) => `${count} ${source}`);
  return `${keysEntryTitle(total)} : ${lines.join(', ')}. ${keysEntryUse(total)}`;
}
