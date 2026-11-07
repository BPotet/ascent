import type { StartingBlessing } from '../../../domain/ascent/blessings';
import {
  loadoutSize,
  type Loadout,
  type LoadoutFavor,
  type LoadoutReserves,
} from '../../../domain/ascent/loadout';
import type { KindledPower } from '../../../domain/ascent/kindled';
import { POWERS, kindledCost, type PowerKind } from '../../../domain/battle/powers';
import type { HabitId } from '../../../domain/habit/Habit';
import type { IconName } from '../pixelArt/sprites/icons';
import { kindledLabel } from './oathText';
import { POWER_EFFECTS, TREE_POWER_NAMES, powerType, powerTypeLine } from './powerText';
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

/** La section de la faveur de l'ascension (#42, E1), en tête de la feuille. */
export const FAVOR_TITLE = "Faveur de l'ascension";

/** L'en-tête lu de la section : « Faveur de l'ascension, plus 2 ». */
export function favorHeadingLabel({ gauge }: LoadoutFavor): string {
  return `${FAVOR_TITLE}, plus ${gauge}`;
}

/**
 * Une ligne d'état de la feuille, des Réserves (#226) ou de la faveur (#42) : son glyphe, ce
 * qu'elle fait, son état, grise quand elle a servi (ou qu'il n'en reste pas), et sa teinte.
 */
export interface StateRowText {
  readonly key: 'gold' | 'keys' | 'rerolls' | 'secondChance';
  readonly glyph: IconName;
  readonly name: string;
  readonly effect: string;
  readonly state: string;
  readonly used: boolean;
  readonly tone: 'favor' | 'gold';
  readonly label: string;
}

function favorRow(row: Omit<StateRowText, 'label' | 'tone'>): StateRowText {
  return { ...row, tone: 'favor', label: `${row.name}, ${row.state}. ${row.effect}` };
}

/** La section des pouvoirs équipés (#235, E1), après les Réserves. */
export const POWERS_TITLE = 'Pouvoirs';

/** Un pouvoir attisé dans l'Équipement (#237, S10) : son prix normal, barré, et son Serment tenu. */
export interface KindledRowText {
  readonly baseCost: number;
  /** « 1 Élan · Instantané ». */
  readonly line: string;
  /** « Serment : « Courir », faite hier. », ou sans nom si l'habitude n'existe plus. */
  readonly oath: string;
}

/** Une ligne d'un pouvoir équipé : son nom, son coût et son type, son effet, et ce qui est lu. */
export interface PowerRowText {
  readonly power: PowerKind;
  readonly name: string;
  readonly line: string;
  readonly effect: string;
  readonly label: string;
  readonly kindled?: KindledRowText;
}

/**
 * Les lignes des pouvoirs équipés, dans l'ordre des touches (E1) ; un pouvoir attisé (#237) dit son
 * coût réduit et le Serment tenu, nommé par son habitude (`habitNames`) si elle existe encore.
 */
export function powerRows(
  powers: readonly PowerKind[],
  kindled: readonly KindledPower[] = [],
  habitNames: Readonly<Record<HabitId, string>> = {},
): PowerRowText[] {
  return powers.map((power) => {
    const name = TREE_POWER_NAMES[power];
    const line = powerTypeLine(power);
    const { effect } = POWER_EFFECTS[power];
    const kept = kindled.find((each) => each.power === power);
    if (kept === undefined) {
      return {
        power,
        name,
        line,
        effect,
        label: `${name}, ${line.replace(' · ', ', ')}. ${effect}`,
      };
    }
    const habit = habitNames[kept.habit];
    const oath = habit === undefined ? 'Serment tenu hier.' : `Serment : « ${habit} », faite hier.`;
    const type = powerType(power);
    return {
      power,
      name,
      line,
      effect,
      kindled: { baseCost: POWERS[power].cost, line: `${kindledCost(power)} Élan · ${type}`, oath },
      label: `${kindledLabel(power)}, ${type}. ${effect} ${oath}`,
    };
  });
}

/** La section des Réserves (#226, E1), en tête de la feuille : l'Or et les clés. */
export const RESERVES_TITLE = 'Réserves';

/** L'en-tête lu de la section : « Réserves ». */
export function reservesHeadingLabel(): string {
  return RESERVES_TITLE;
}

/**
 * Les lignes des Réserves (E1, E3) : l'Or, puis les clés qui restent, grises sans clé, avec ce
 * qui en donne.
 */
export function reserveRows({ gold, keys }: LoadoutReserves): StateRowText[] {
  const keysEffect =
    keys > 0
      ? "Ouvrent le coffre scellé d'une Élite. Perdues à la fin de l'ascension."
      : 'Aucune clé. La faveur et Fortune en donnent.';
  return [
    {
      key: 'gold',
      glyph: 'coin8',
      name: 'Or',
      effect: 'Gagné à chaque étage franchi.',
      state: String(gold),
      used: false,
      tone: 'gold',
      label: `Or, ${gold}`,
    },
    {
      key: 'keys',
      glyph: 'key8',
      name: 'Clés',
      effect: keysEffect,
      state: String(keys),
      used: keys === 0,
      tone: 'gold',
      label: `Clés, ${keys} : ${
        keys > 0
          ? "ouvrent le coffre scellé d'une Élite"
          : 'aucune clé. La faveur et Fortune en donnent'
      }`,
    },
  ];
}

/**
 * Les lignes de la faveur (E1) : les relances et ce qui en reste (« 1 sur 2 », #42), puis, à +2, la
 * seconde chance, « Prête » ou « Utilisée » (#206).
 */
export function favorRows({
  rerollsLeft,
  rerollsGranted,
  secondChance,
}: LoadoutFavor): StateRowText[] {
  const rows = [
    favorRow({
      key: 'rerolls',
      glyph: 'reroll',
      name: 'Relances',
      effect: "Redonnent l'offre de bienfaits.",
      state: `${rerollsLeft} sur ${rerollsGranted}`,
      used: rerollsLeft === 0,
    }),
  ];
  if (secondChance !== undefined) {
    rows.push(
      favorRow({
        key: 'secondChance',
        glyph: 'secondChance',
        name: 'Seconde chance',
        effect: 'À 0 PV, relève une fois avec 50 % des PV max.',
        state: secondChance === 'ready' ? 'Prête' : 'Utilisée',
        used: secondChance === 'used',
      }),
    );
  }
  return rows;
}
