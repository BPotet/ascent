/**
 * La page d'un ennemi (`EnemyPage`, #283, ADR 0032) : l'écran ouvert en touchant une entrée
 * rencontrée ou vaincue du Bestiaire. Le domaine décide de ce qui s'y montre (B20) :
 * - inconnu, ou hors du catalogue du jeu installé : aucune page ;
 * - rencontré : la page cachée, son nom, sa catégorie et son palier, rien d'autre ;
 * - vaincu : la page remplie, ses mécaniques (celles de sa fiche, et seulement elles, B22) et ses
 *   coups, phase 2 comprise, sans aucun chiffre de jeu (B21) : ni PV, ni garde, ni dégâts, ni
 *   Initiative, ni poids, ni durée. Le type le garantit.
 *
 * « Page remplie » joue à la première ouverture de la page remplie (`firstFill`, B18), tant que
 * l'entrée n'a pas la marque « page vue remplie ».
 */
import type { Tier } from '../ascent/tiers';
import type { AttackKind } from '../battle/attacks';
import { ENEMIES, type EnemyKind, type EnemyProfile, type Move } from '../battle/combatants';
import {
  BESTIARY_CATALOG,
  type BestiaryCatalog,
  type BestiaryTierCatalog,
  type EntryCategory,
} from './bestiary';
import type { DiscoveryBook } from './DiscoveryBook';

/**
 * Une mécanique d'un ennemi (`PageMechanic`) : ce que sa page dit de lui, tiré de sa fiche. La
 * Brûlure, le Saignement et le type de coup se disent sur chaque coup (`PageMove`).
 */
export type PageMechanic =
  | 'selfRevive'
  | 'support'
  | 'exhume'
  | 'summon'
  | 'thorns'
  | 'sanctuary'
  | 'aura'
  | 'swarm'
  | 'emberBurst'
  | 'momentumTheft'
  | 'charge'
  | 'sweep'
  | 'phaseShift';

/** Ce qui donne chaque mécanique dans la fiche d'un ennemi, dans l'ordre de la page. */
const MECHANIC_RULES: readonly (readonly [PageMechanic, (profile: EnemyProfile) => boolean])[] = [
  ['selfRevive', (profile) => profile.selfRevive !== undefined],
  ['support', (profile) => profile.supports],
  ['exhume', (profile) => profile.exhume !== undefined],
  ['summon', (profile) => profile.phase2Summon !== undefined],
  ['thorns', (profile) => profile.thorns !== undefined],
  ['sanctuary', (profile) => profile.sanctuary !== undefined],
  ['aura', (profile) => profile.aura !== undefined],
  ['swarm', (profile) => profile.swarm !== undefined],
  ['emberBurst', (profile) => profile.emberBurst !== undefined],
  ['momentumTheft', (profile) => profile.momentumTheft !== undefined],
  ['charge', (profile) => allMoves(profile).some((move) => move.charge === true)],
  ['sweep', (profile) => allMoves(profile).some((move) => move.attack === 'sweep')],
  ['phaseShift', (profile) => profile.phaseShiftPercent !== undefined],
];

/** Toutes les mécaniques, dans l'ordre où la page les dit. */
export const PAGE_MECHANICS: readonly PageMechanic[] = MECHANIC_RULES.map(([mechanic]) => mechanic);

function allMoves(profile: EnemyProfile): readonly Move[] {
  return [...profile.moves, ...(profile.phase2Moves ?? [])];
}

/** Les mécaniques de la fiche `profile`, dans l'ordre de la page (B22). */
export function pageMechanics(profile: EnemyProfile): PageMechanic[] {
  return MECHANIC_RULES.filter(([, has]) => has(profile)).map(([mechanic]) => mechanic);
}

/**
 * Un coup de la page (`PageMove`) : son type, son Saignement, ses charges de Brûlure (un libellé du
 * combat, « Brûlure ×2 ») et sa Charge. Aucun champ de dégâts, de poids ni de durée (B21).
 */
export interface PageMove {
  readonly attack: AttackKind;
  readonly bleed: boolean;
  readonly burn: number | null;
  readonly charge: boolean;
}

/** Une phase de la page : ses coups ; pour la phase 2 d'un boss, ceux qu'elle ajoute seulement. */
export interface PagePhase {
  readonly moves: readonly PageMove[];
}

interface PageIdentity {
  readonly kind: EnemyKind;
  readonly tier: Tier;
  readonly category: EntryCategory;
}

/** La page d'un ennemi : la page cachée d'un ennemi rencontré, ou la page remplie d'un vaincu. */
export type EnemyPage =
  | (PageIdentity & { readonly state: 'encountered' })
  | (PageIdentity & {
      readonly state: 'defeated';
      readonly firstFill: boolean;
      readonly mechanics: readonly PageMechanic[];
      readonly phases: readonly PagePhase[];
    });

const pageMove = (move: Move): PageMove => ({
  attack: move.attack,
  bleed: move.bleed !== undefined,
  burn: move.burn ?? null,
  charge: move.charge === true,
});

/** Les phases de la fiche `profile` : une ; deux pour un boss, la seconde avec ses ajouts. */
function pagePhases(profile: EnemyProfile): PagePhase[] {
  const phases = [{ moves: profile.moves.map(pageMove) }];
  if (profile.phase2Moves !== undefined) phases.push({ moves: profile.phase2Moves.map(pageMove) });
  return phases;
}

const SECTIONS: readonly (readonly [EntryCategory, keyof BestiaryTierCatalog])[] = [
  ['enemy', 'enemies'],
  ['elite', 'elites'],
  ['boss', 'bosses'],
];

/** Le palier et la catégorie de `kind` dans le catalogue (B14, B15) ; `null` s'il n'y est pas. */
function placeOf(kind: string, catalog: BestiaryCatalog): PageIdentity | null {
  for (const tier of [1, 2, 3] as const) {
    for (const [category, key] of SECTIONS) {
      const found = catalog[tier][key].find((each) => each === kind);
      if (found !== undefined) return { kind: found, tier, category };
    }
  }
  return null;
}

/**
 * La page de l'entrée `kind` du carnet `book`, d'après le catalogue du jeu installé : `null` pour
 * une entrée inconnue ou absente du catalogue (l'entrée ne s'ouvre pas, B20, C5).
 */
export function enemyPage(
  book: DiscoveryBook,
  kind: string,
  catalog: BestiaryCatalog = BESTIARY_CATALOG,
): EnemyPage | null {
  const record = book.enemies[kind];
  const place = record === undefined ? null : placeOf(kind, catalog);
  if (record === undefined || place === null) return null;
  if (record.state === 'encountered') return { ...place, state: 'encountered' };
  const profile = ENEMIES[place.kind];
  return {
    ...place,
    state: 'defeated',
    firstFill: record.pageSeen !== true,
    mechanics: pageMechanics(profile),
    phases: pagePhases(profile),
  };
}
