/**
 * Le choix des pouvoirs équipés (`EquippedPower`, #236) : au menu des pouvoirs (#270), exactement
 * min(3, possédés) pouvoirs distincts parmi les pouvoirs possédés du héros (son pouvoir de base et
 * ses pouvoirs débloqués), le pouvoir de base pouvant rester de côté. Le dernier choix validé ou lancé
 * est mémorisé par héros (`EquippedPowersMemory`, clé `camp.equippedPowers`, ADR 0022 et 0026) : il
 * donne la présélection de la prochaine ascension, s'il est encore valide.
 */
import { HEROES, type HeroKind } from '../battle/combatants';
import { POWERS, basePower, powerOrder, type PowerKind } from '../battle/powers';
import { campPowers, type Camp } from './camp';
import { EQUIPPED_POWER_SLOTS, equippedPowers } from './powerTree';

/** Les derniers pouvoirs équipés lancés, par héros ; un héros absent n'a pas de mémoire. */
export type EquippedPowersMemory = Partial<Readonly<Record<HeroKind, readonly PowerKind[]>>>;

const EQUIPPED_POWERS_VERSION = 1;

/** Les pouvoirs possédés de `hero` (PW6) : son pouvoir de base et ses pouvoirs débloqués, dans l'ordre de l'arbre. */
export function ownedPowers(camp: Camp, hero: HeroKind): readonly PowerKind[] {
  return powerOrder(hero, [basePower(hero), ...campPowers(camp)]);
}

/** Les pouvoirs possédés de `hero` dans l'ordre où il les a eus : le pouvoir de base, puis les achats. */
function acquiredPowers(camp: Camp, hero: HeroKind): readonly PowerKind[] {
  return [basePower(hero), ...campPowers(camp).filter((power) => POWERS[power].hero === hero)];
}

/** Le nombre de pouvoirs équipés de `hero` : min(3, possédés). */
export function equippedSlots(camp: Camp, hero: HeroKind): number {
  return Math.min(EQUIPPED_POWER_SLOTS, ownedPowers(camp, hero).length);
}

/** Des codes distincts, tous de `hero` et possédés. */
function ownedDistinct(camp: Camp, hero: HeroKind, powers: readonly PowerKind[]): boolean {
  const owned = ownedPowers(camp, hero);
  return new Set(powers).size === powers.length && powers.every((power) => owned.includes(power));
}

/** Un choix valide : des pouvoirs distincts, tous de `hero` et possédés, au nombre de min(3, possédés). */
export function isEquippedChoice(
  camp: Camp,
  hero: HeroKind,
  powers: readonly PowerKind[],
): boolean {
  return powers.length === equippedSlots(camp, hero) && ownedDistinct(camp, hero, powers);
}

/**
 * La présélection du menu des pouvoirs et du Choix du héros : la mémoire de `hero` si elle est valide (1 à 3 pouvoirs
 * distincts, tous de lui et possédés), ses places libres remplies par ses autres pouvoirs possédés
 * dans l'ordre où il les a eus ; sinon la règle d'office (`equippedPowers`). Dans l'ordre de l'arbre.
 */
export function preselectedPowers(
  camp: Camp,
  memory: EquippedPowersMemory,
  hero: HeroKind,
): readonly PowerKind[] {
  const remembered = memory[hero];
  const valid =
    remembered !== undefined &&
    remembered.length >= 1 &&
    remembered.length <= EQUIPPED_POWER_SLOTS &&
    ownedDistinct(camp, hero, remembered);
  if (!valid) return equippedPowers(camp, hero);
  const free = Math.max(0, equippedSlots(camp, hero) - remembered.length);
  const others = acquiredPowers(camp, hero).filter((power) => !remembered.includes(power));
  return powerOrder(hero, [...remembered, ...others.slice(0, free)]);
}

/**
 * La mémoire après un « Valider » (#270) ou un lancement avec `powers` pour `hero` : les autres héros
 * gardent la leur.
 */
export function rememberEquippedPowers(
  memory: EquippedPowersMemory,
  hero: HeroKind,
  powers: readonly PowerKind[],
): EquippedPowersMemory {
  return { ...memory, [hero]: powerOrder(hero, powers) };
}

/** La mémoire telle qu'elle est stockée, en JSON. */
export function serializeEquippedPowersMemory(memory: EquippedPowersMemory): string {
  return JSON.stringify({ version: EQUIPPED_POWERS_VERSION, heroes: memory });
}

const isPower = (value: unknown): value is PowerKind =>
  typeof value === 'string' && Object.hasOwn(POWERS, value);

/**
 * La mémoire stockée : rien de stocké, ou une valeur illisible (JSON, version), se lit « aucune
 * mémoire » ; un héros inconnu, ou une liste qui n'est pas faite de pouvoirs connus, est ignoré.
 * La validité du choix face au Camp se juge à la présélection.
 */
export function parseEquippedPowersMemory(raw: string | null): EquippedPowersMemory {
  if (raw === null) return {};
  try {
    const stored = JSON.parse(raw) as { version?: unknown; heroes?: unknown } | null;
    const heroes = stored?.heroes;
    if (
      stored?.version !== EQUIPPED_POWERS_VERSION ||
      typeof heroes !== 'object' ||
      heroes === null ||
      Array.isArray(heroes)
    ) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(heroes).filter(
        ([hero, powers]) =>
          Object.hasOwn(HEROES, hero) && Array.isArray(powers) && powers.every(isPower),
      ),
    ) as EquippedPowersMemory;
  } catch {
    return {};
  }
}

/** Ce que fait un toucher sur la ligne d'un pouvoir du menu des pouvoirs (#270), et le brouillon après. */
export interface EquippedPowerToggle {
  readonly kind: 'checked' | 'unchecked' | 'refused';
  readonly powers: readonly PowerKind[];
}

/**
 * Un toucher sur la ligne de `power` dans le brouillon `draft` de `hero` (#270, M1 à M3) : un pouvoir
 * coché se décoche, pouvoir de base compris ; un pouvoir non coché se coche s'il reste une place ;
 * sinon, ou pour un pouvoir qu'il ne possède pas, c'est un refus et le brouillon ne change pas (M2).
 * Le brouillon suit l'ordre de l'arbre.
 */
export function toggleEquippedPower(
  camp: Camp,
  hero: HeroKind,
  draft: readonly PowerKind[],
  power: PowerKind,
): EquippedPowerToggle {
  if (draft.includes(power)) {
    return { kind: 'unchecked', powers: draft.filter((each) => each !== power) };
  }
  if (!ownedPowers(camp, hero).includes(power) || draft.length >= equippedSlots(camp, hero)) {
    return { kind: 'refused', powers: draft };
  }
  return { kind: 'checked', powers: powerOrder(hero, [...draft, power]) };
}

/** Les pouvoirs nouveaux d'un héros (#270) : équipés tout seuls (M8), ou en attente d'une place (T4, M9). */
export interface NewPowerStanding {
  readonly autoEquipped: readonly PowerKind[];
  readonly waiting: readonly PowerKind[];
}

/**
 * Les pouvoirs nouveaux (`NewPower`, #270) de `hero`, débloqués dans l'arbre et pas encore vus dans le
 * menu des pouvoirs : ceux de la présélection `preselected` se sont équipés tout seuls (il restait une
 * place), les autres attendent une place. Dans l'ordre de l'arbre.
 */
export function newPowerStanding(
  preselected: readonly PowerKind[],
  newPowers: readonly PowerKind[],
  hero: HeroKind,
): NewPowerStanding {
  const mine = powerOrder(hero, newPowers);
  return {
    autoEquipped: mine.filter((power) => preselected.includes(power)),
    waiting: mine.filter((power) => !preselected.includes(power)),
  };
}

const NEW_POWERS_VERSION = 1;

/** Les pouvoirs nouveaux tels qu'ils sont stockés, en JSON (#270, `camp.newPowers`). */
export function serializeNewPowers(powers: readonly PowerKind[]): string {
  return JSON.stringify({ version: NEW_POWERS_VERSION, powers });
}

/**
 * Les pouvoirs nouveaux stockés (#270) : rien de stocké, ou une valeur illisible (JSON, version), se
 * lit « aucun » ; un code inconnu, un doublon ou un pouvoir de base est ignoré.
 */
export function parseNewPowers(raw: string | null): readonly PowerKind[] {
  if (raw === null) return [];
  try {
    const stored = JSON.parse(raw) as { version?: unknown; powers?: unknown } | null;
    if (stored?.version !== NEW_POWERS_VERSION || !Array.isArray(stored.powers)) return [];
    const powers = stored.powers.filter(
      (power): power is PowerKind => isPower(power) && power !== basePower(POWERS[power].hero),
    );
    return [...new Set(powers)];
  } catch {
    return [];
  }
}
