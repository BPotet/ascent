import { parseCamp } from '../../domain/ascent/camp';
import { parseOaths, type Oath } from '../../domain/ascent/oaths';
import type { PowerKind } from '../../domain/battle/powers';
import type { HabitId } from '../../domain/habit/Habit';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { CAMP_KEY } from './campKeys';

/**
 * La clé des Serments (`Oath`, #237, ADR 0021), à côté du Camp : un achat et un Serment n'écrivent
 * jamais la même clé. Des codes de pouvoir et des identifiants d'habitude, jamais un nom.
 */
export const OATHS_KEY = 'camp.oaths';
/** La copie d'une valeur illisible des Serments, gardée avant qu'ils repartent de rien. */
export const UNREADABLE_OATHS_KEY = 'camp.oaths.unreadable';

/** Les Serments stockés, lus avec le Camp `camp` ; la valeur brute est rendue pour la garder à part. */
export interface StoredOaths {
  readonly oaths: readonly Oath[];
  readonly unreadable: boolean;
  readonly raw: string | null;
}

/** Lit les Serments ; une panne de lecture est une exception. */
export async function readOaths(
  keyValueStore: KeyValueStore,
  camp: Parameters<typeof parseOaths>[1],
): Promise<StoredOaths> {
  const raw = await keyValueStore.get(OATHS_KEY);
  return { ...parseOaths(raw, camp), raw };
}

/**
 * Cas d'usage : le pouvoir dont chaque habitude tient le Serment, pour la ligne « Serment · … » de la
 * Vue Journée et la fenêtre de suppression (#237). Lecture seule ; une panne ne montre aucun Serment.
 */
export async function getHabitOaths({
  keyValueStore,
}: {
  readonly keyValueStore: KeyValueStore;
}): Promise<Readonly<Record<HabitId, PowerKind>>> {
  try {
    const { camp } = parseCamp(await keyValueStore.get(CAMP_KEY));
    const { oaths } = await readOaths(keyValueStore, camp);
    return Object.fromEntries(oaths.map(({ habit, power }) => [habit, power]));
  } catch {
    return {};
  }
}
