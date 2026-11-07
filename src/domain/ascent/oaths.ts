/**
 * Le Serment (`Oath`, #237, ADR 0021) : le joueur lie une habitude à un pouvoir débloqué de 2 Élan
 * ou plus, pouvoir de base compris ; un pouvoir porte au plus un Serment, une habitude aussi. Il se
 * prête au Camp, librement et sans coût, et compte **à partir du lendemain** : faite hier, son
 * habitude attise le pouvoir (`KindledPower`) pour toute une ascension, −1 Élan, au moins 1.
 *
 * Il ne touche jamais aux Éclats, aux Déblocages ni à leurs prix. Son habitude n'est qu'un
 * identifiant : aucun nom d'habitude n'est stocké. Un Serment dont l'habitude a été supprimée est
 * lu « rompu » sans être réécrit : un identifiant d'habitude n'est jamais réutilisé.
 */
import { POWERS, basePower, type PowerKind } from '../battle/powers';
import { Day } from '../day/Day';
import type { HabitId } from '../habit/Habit';
import { campPowers, type Camp } from './camp';

/** Le coût en Élan à partir duquel un pouvoir porte un Serment. */
export const OATH_MIN_COST = 2;

/** Un Serment : l'habitude liée au pouvoir, et le jour (`AAAA-MM-JJ`) où il est prêté ou changé. */
export interface Oath {
  readonly power: PowerKind;
  readonly habit: HabitId;
  readonly since: string;
}

/** Un pouvoir attisé (`KindledPower`) : le pouvoir et l'habitude de son Serment tenu hier. */
export interface KindledPower {
  readonly power: PowerKind;
  readonly habit: HabitId;
}

const costsEnough = (power: PowerKind) => POWERS[power].cost >= OATH_MIN_COST;

/** `power` peut porter un Serment : débloqué (ou pouvoir de base) et à 2 Élan ou plus. */
export function canBearOath(camp: Camp, power: PowerKind): boolean {
  const owned = basePower(POWERS[power].hero) === power || campPowers(camp).includes(power);
  return owned && costsEnough(power);
}

/** La réponse à un Serment prêté. */
export type OathSwearing =
  | { readonly kind: 'sworn'; readonly oaths: readonly Oath[] }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'notEligible' }
  | { readonly kind: 'unknownHabit' }
  | { readonly kind: 'habitTaken'; readonly by: PowerKind };

export interface OathRequest {
  readonly camp: Camp;
  /** Les habitudes qui existent. */
  readonly habits: readonly HabitId[];
  readonly power: PowerKind;
  readonly habit: HabitId;
  readonly today: Day;
}

/**
 * Lie `habit` à `power`, à partir d'aujourd'hui : le Serment du pouvoir, s'il y en a un, est
 * remplacé à sa place. La même habitude sur le même pouvoir ne change rien, pas même le jour, pour
 * qu'un retouchage ne repousse pas l'attisé au lendemain.
 */
export function swearOath(
  oaths: readonly Oath[],
  { camp, habits, power, habit, today }: OathRequest,
): OathSwearing {
  if (!canBearOath(camp, power)) return { kind: 'notEligible' };
  if (!habits.includes(habit)) return { kind: 'unknownHabit' };
  const current = oaths.find((oath) => oath.power === power);
  if (current?.habit === habit) return { kind: 'unchanged' };
  const holder = oaths.find((oath) => oath.habit === habit);
  if (holder !== undefined) return { kind: 'habitTaken', by: holder.power };
  const sworn: Oath = { power, habit, since: today.toIsoString() };
  return {
    kind: 'sworn',
    oaths:
      current === undefined
        ? [...oaths, sworn]
        : oaths.map((oath) => (oath === current ? sworn : oath)),
  };
}

/**
 * L'état d'un Serment aujourd'hui : rompu (son habitude n'existe plus), prêté ou changé aujourd'hui
 * (il ne compte qu'à partir de demain), tenu (son habitude a été faite hier) ou non tenu.
 */
export type OathStanding = 'broken' | 'fresh' | 'kept' | 'missed';

export function oathStanding(
  oath: Oath,
  habits: readonly HabitId[],
  doneYesterday: readonly HabitId[],
  today: Day,
): OathStanding {
  if (!habits.includes(oath.habit)) return 'broken';
  if (!Day.fromIsoString(oath.since).isBefore(today)) return 'fresh';
  return doneYesterday.includes(oath.habit) ? 'kept' : 'missed';
}

/**
 * Les pouvoirs attisés parmi `powers`, les pouvoirs équipés dans l'ordre des touches : ceux dont le
 * Serment est tenu. Un pouvoir non équipé n'est jamais attisé.
 */
export function kindledPowers(
  powers: readonly PowerKind[],
  oaths: readonly Oath[],
  habits: readonly HabitId[],
  doneYesterday: readonly HabitId[],
  today: Day,
): KindledPower[] {
  return powers.flatMap((power) => {
    const oath = oaths.find((each) => each.power === power);
    return oath !== undefined && oathStanding(oath, habits, doneYesterday, today) === 'kept'
      ? [{ power, habit: oath.habit }]
      : [];
  });
}

const OATHS_VERSION = 1;

/** Les Serments tels qu'ils sont stockés, en JSON : des codes de pouvoir et des identifiants. */
export function serializeOaths(oaths: readonly Oath[]): string {
  return JSON.stringify({
    version: OATHS_VERSION,
    oaths: oaths.map(({ power, habit, since }) => ({ power, habit, since })),
  });
}

function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return Day.fromIsoString(value).toIsoString() === value;
  } catch {
    return false;
  }
}

function isOath(value: unknown): value is Oath {
  if (typeof value !== 'object' || value === null) return false;
  const { power, habit, since } = value as Partial<Record<keyof Oath, unknown>>;
  return (
    typeof power === 'string' &&
    Object.hasOwn(POWERS, power) &&
    costsEnough(power as PowerKind) &&
    typeof habit === 'number' &&
    Number.isInteger(habit) &&
    habit > 0 &&
    isDay(since)
  );
}

const distinct = (values: readonly unknown[]) => new Set(values).size === values.length;

/**
 * Les Serments stockés : rien de stocké, aucun ; une valeur illisible (version, code inconnu ou à
 * moins de 2 Élan, habitude qui n'est pas un entier > 0, jour invalide, pouvoir ou habitude en
 * double) le dit, sans Serment. Un Serment sur un pouvoir que `camp` ne contient plus est ignoré,
 * sans être réécrit.
 */
export function parseOaths(
  raw: string | null,
  camp: Camp,
): { readonly oaths: readonly Oath[]; readonly unreadable: boolean } {
  if (raw === null) return { oaths: [], unreadable: false };
  try {
    const stored = JSON.parse(raw) as { version?: unknown; oaths?: unknown } | null;
    const oaths = stored?.oaths;
    if (
      stored?.version === OATHS_VERSION &&
      Array.isArray(oaths) &&
      oaths.every(isOath) &&
      distinct(oaths.map(({ power }) => power)) &&
      distinct(oaths.map(({ habit }) => habit))
    ) {
      return {
        oaths: oaths
          .filter(({ power }) => canBearOath(camp, power))
          .map(({ power, habit, since }) => ({ power, habit, since })),
        unreadable: false,
      };
    }
  } catch {
    // Illisible : aucun Serment, la valeur est gardée à part par la session du camp.
  }
  return { oaths: [], unreadable: true };
}
