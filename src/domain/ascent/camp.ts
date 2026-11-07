/**
 * Le Camp (`Camp`, #40, ADR 0017) : le refuge entre les ascensions, où le Gardien de la flamme
 * (`FlameKeeper`) vend les Déblocages, chacun une fois, à son Prix de déblocage (`UnlockPrice`).
 * Le Camp garde chaque Déblocage avec le prix payé, et les pouvoirs débloqués dans l'arbre de
 * pouvoirs (#235) ; les Éclats disponibles (`AvailableShards`) sont calculés, jamais stockés : le
 * Total d'Éclats n'est jamais débité.
 */
import { POWERS, basePower, type PowerKind } from '../battle/powers';
import type { Ascent } from './Ascent';
import { BOONS } from './boons';
import { ITEMS } from './items';
import type { Rarity } from './rarity';
import { UNLOCKS, type Unlock } from './unlocks';

/** Le Prix de déblocage selon la rareté (C1) : il ne dépend jamais de la jauge, du héros ni des bénédictions (C2). */
export const UNLOCK_PRICES: Readonly<Record<Rarity, number>> = { common: 20, rare: 40, epic: 80 };

/** La rareté d'un Déblocage, lue dans le catalogue des objets ou des bienfaits. */
export function unlockRarity(unlock: Unlock): Rarity {
  return unlock === 'emberHeart' ? BOONS.emberHeart.rarity : ITEMS[unlock].rarity;
}

/** Le Prix de déblocage (`UnlockPrice`) d'un Déblocage. */
export function unlockPrice(unlock: Unlock): number {
  return UNLOCK_PRICES[unlockRarity(unlock)];
}

/** Le catalogue du Gardien de la flamme : par prix croissant ; à prix égal, l'ordre du Codex. */
export const FLAME_KEEPER_CATALOGUE: readonly Unlock[] = [...UNLOCKS].sort(
  (a, b) => unlockPrice(a) - unlockPrice(b),
);

/** Un Déblocage acheté, avec le prix payé. */
export interface PaidUnlock {
  readonly unlock: Unlock;
  readonly price: number;
}

/** Un pouvoir débloqué dans l'arbre de pouvoirs (#235), avec le prix payé. */
export interface PaidPower {
  readonly power: PowerKind;
  readonly price: number;
}

/** Le Camp (`Camp`) : les Déblocages et les pouvoirs débloqués, chacun dans l'ordre des achats. */
export interface Camp {
  readonly unlocks: readonly PaidUnlock[];
  readonly powers: readonly PaidPower[];
}

export const EMPTY_CAMP: Camp = { unlocks: [], powers: [] };

/** Les pouvoirs débloqués du Camp (#235), jamais perdus. */
export function campPowers(camp: Camp): readonly PowerKind[] {
  return camp.powers.map(({ power }) => power);
}

/** Les Déblocages du Camp, que reçoit chaque nouvelle ascension. */
export function campUnlocks(camp: Camp): readonly Unlock[] {
  return camp.unlocks.map(({ unlock }) => unlock);
}

/**
 * Les Éclats disponibles : le Total d'Éclats moins les prix payés, Déblocages et pouvoirs
 * (#235), jamais sous 0 (C3).
 */
export function availableShards(shardTotal: number, camp: Camp): number {
  const spent = [...camp.unlocks, ...camp.powers].reduce((sum, { price }) => sum + price, 0);
  return Math.max(0, shardTotal - spent);
}

/**
 * La réponse d'un achat au Camp : tout ou rien, jamais de dette ni de doublon. Un pouvoir de rang 2
 * est verrouillé tant que le rang 1 de sa voie ne l'est pas ; le pouvoir de base et une frappe
 * « Bientôt » ne se vendent pas (#235).
 */
export type CampPurchase =
  | { readonly kind: 'unlocked'; readonly camp: Camp }
  | { readonly kind: 'alreadyUnlocked' }
  | { readonly kind: 'notEnoughShards'; readonly missing: number }
  | { readonly kind: 'locked'; readonly after: PowerKind }
  | { readonly kind: 'notForSale' };

/** Achète `unlock` au Camp, au prix d'aujourd'hui, figé avec le Déblocage (C3, C9). */
export function unlockAtCamp(camp: Camp, shardTotal: number, unlock: Unlock): CampPurchase {
  if (campUnlocks(camp).includes(unlock)) return { kind: 'alreadyUnlocked' };
  const price = unlockPrice(unlock);
  const available = availableShards(shardTotal, camp);
  if (available < price) return { kind: 'notEnoughShards', missing: price - available };
  return { kind: 'unlocked', camp: { ...camp, unlocks: [...camp.unlocks, { unlock, price }] } };
}

/**
 * L'état d'une carte du catalogue : déjà dans la tour, dès la prochaine ascension (acheté pendant
 * une ascension en cours qui ne l'a pas), achetable, ou ce qu'il manque.
 */
export type UnlockState =
  | { readonly kind: 'unlocked' }
  | { readonly kind: 'nextAscent' }
  | { readonly kind: 'affordable' }
  | { readonly kind: 'missing'; readonly missing: number };

export interface CampOfferEntry {
  readonly unlock: Unlock;
  readonly price: number;
  readonly state: UnlockState;
}

/** Les cartes du catalogue, avec leur prix et leur état, pour l'ascension `ascent` (C4). */
export function campOffer(
  camp: Camp,
  shardTotal: number,
  ascent: Ascent | null,
): readonly CampOfferEntry[] {
  const owned = campUnlocks(camp);
  const available = availableShards(shardTotal, camp);
  const running = ascent !== null && ascent.outcome === null ? ascent : null;
  return FLAME_KEEPER_CATALOGUE.map((unlock) => {
    const price = unlockPrice(unlock);
    const state: UnlockState = owned.includes(unlock)
      ? running === null || running.unlocks.includes(unlock)
        ? { kind: 'unlocked' }
        : { kind: 'nextAscent' }
      : available >= price
        ? { kind: 'affordable' }
        : { kind: 'missing', missing: price - available };
    return { unlock, price, state };
  });
}

const CAMP_VERSION = 1;

/** Le Camp tel qu'il est stocké, en JSON, pouvoirs compris (#235) : une seule clé, une écriture. */
export function serializeCamp(camp: Camp): string {
  return JSON.stringify({ version: CAMP_VERSION, unlocks: camp.unlocks, powers: camp.powers });
}

const isPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

function isPaidUnlock(value: unknown): value is PaidUnlock {
  if (typeof value !== 'object' || value === null) return false;
  const { unlock, price } = value as Partial<Record<keyof PaidUnlock, unknown>>;
  return (UNLOCKS as readonly unknown[]).includes(unlock) && isPrice(price);
}

/** Un pouvoir achetable : un pouvoir lançable qui n'est pas un pouvoir de base (#235). */
function isPurchasablePower(value: unknown): value is PowerKind {
  return (
    typeof value === 'string' &&
    Object.hasOwn(POWERS, value) &&
    basePower(POWERS[value as PowerKind].hero) !== value
  );
}

function isPaidPower(value: unknown): value is PaidPower {
  if (typeof value !== 'object' || value === null) return false;
  const { power, price } = value as Partial<Record<keyof PaidPower, unknown>>;
  return isPurchasablePower(power) && isPrice(price);
}

/** Les pouvoirs stockés : absents (un Camp d'avant #235), aucun ; `null` s'ils sont illisibles. */
function storedPowers(powers: unknown): readonly PaidPower[] | null {
  if (powers === undefined) return [];
  if (!Array.isArray(powers) || !powers.every(isPaidPower)) return null;
  if (new Set(powers.map(({ power }) => power)).size !== powers.length) return null;
  return powers.map(({ power, price }) => ({ power, price }));
}

/**
 * Le Camp stocké : rien de stocké donne un Camp vide ; une valeur illisible (version, nom de code
 * inconnu ou non achetable, doublon, prix qui n'est pas un entier > 0) le dit, et le Camp repart
 * vide. Des pouvoirs absents (un Camp d'avant #235) se lisent : aucun.
 */
export function parseCamp(raw: string | null): {
  readonly camp: Camp;
  readonly unreadable: boolean;
} {
  if (raw === null) return { camp: EMPTY_CAMP, unreadable: false };
  try {
    const stored = JSON.parse(raw) as {
      version?: unknown;
      unlocks?: unknown;
      powers?: unknown;
    } | null;
    const unlocks = stored?.unlocks;
    const powers = storedPowers(stored?.powers);
    if (
      stored?.version === CAMP_VERSION &&
      Array.isArray(unlocks) &&
      unlocks.every(isPaidUnlock) &&
      new Set(unlocks.map(({ unlock }) => unlock)).size === unlocks.length &&
      powers !== null
    ) {
      return {
        camp: { unlocks: unlocks.map(({ unlock, price }) => ({ unlock, price })), powers },
        unreadable: false,
      };
    }
  } catch {
    // Illisible : le Camp repart vide, la valeur est gardée à part par la session du camp.
  }
  return { camp: EMPTY_CAMP, unreadable: true };
}
