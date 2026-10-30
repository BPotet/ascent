import type { Rarity } from '../../../domain/ascent/rarity';

/** Le genre du mot qui porte la rareté : un bienfait ou un objet (masculin), une bénédiction. */
export type RarityGender = 'masculine' | 'feminine';

const RARITY_NAMES: Readonly<Record<RarityGender, Readonly<Record<Rarity, string>>>> = {
  masculine: { common: 'Commun', rare: 'Rare', epic: 'Épique' },
  feminine: { common: 'Commune', rare: 'Rare', epic: 'Épique' },
};

/** Les losanges de la rareté : 1, 2 ou 3. */
const RARITY_MARKS: Readonly<Record<Rarity, string>> = { common: '◆', rare: '◆◆', epic: '◆◆◆' };

/** Le nom de la rareté (`Rarity`), au masculin par défaut : « Commun », « Commune ». */
export function rarityName(rarity: Rarity, gender: RarityGender = 'masculine'): string {
  return RARITY_NAMES[gender][rarity];
}

/** Les losanges de la rareté, à la place d'un mot : « ◆◆ ». */
export function rarityMarks(rarity: Rarity): string {
  return RARITY_MARKS[rarity];
}

/** La rareté en losanges et en mot : « ◆◆ Rare », « ◆ Commune ». */
export function rarityLine(rarity: Rarity, gender: RarityGender = 'masculine'): string {
  return `${rarityMarks(rarity)} ${rarityName(rarity, gender)}`;
}

/**
 * Les textes d'une pastille d'équipement (`LoadoutChip`) : le nom, la rareté en losanges et en mot,
 * et le libellé lu (« Givre persistant, Rare »).
 */
export interface LoadoutChipText {
  readonly name: string;
  readonly rarity: Rarity;
  readonly rarityLine: string;
  readonly label: string;
}

/** Les textes de la pastille d'équipement de `name`, de rareté `rarity`. */
export function loadoutChipText(
  name: string,
  rarity: Rarity,
  gender: RarityGender = 'masculine',
): LoadoutChipText {
  return {
    name,
    rarity,
    rarityLine: rarityLine(rarity, gender),
    label: `${name}, ${rarityName(rarity, gender)}`,
  };
}
