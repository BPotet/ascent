import type { ActionTrackView, TrackEntry } from './battleView';

/** La rangée d'une case : la manche en cours, ou l'aperçu de la manche suivante. */
export type TrackRow = 'current' | 'next';

/** Une case qui sort de la frise : l'ennemi tombé, sa rangée et sa place d'avant. */
export interface LeavingEntry {
  readonly entry: TrackEntry;
  readonly row: TrackRow;
  readonly index: number;
}

/** Ce qui change dans la frise d'un rendu au suivant (#175, maquette F3). */
export interface TrackTransition {
  readonly leaving: readonly LeavingEntry[];
  readonly entering: readonly TrackEntry[];
}

/**
 * Un ennemi de la frise : sa place dans le combat et son nom de code. Un renfort qui prend la place
 * d'un ennemi tombé est un autre ennemi ; un boss qui change de phase reste le même.
 */
function enemyKey({ actor, fighter }: TrackEntry): string | null {
  return actor === 'hero' ? null : `${actor}:${fighter}`;
}

function enemyKeys(track: ActionTrackView): Set<string> {
  return new Set([...track.current, ...track.next].flatMap((entry) => enemyKey(entry) ?? []));
}

/**
 * Ce qui sort et ce qui entre, de la frise `previous` à la frise `current` : sortent les ennemis
 * présents avant (manche ou aperçu) et absents des deux maintenant, à chacune de leurs places
 * d'avant ; entrent les ennemis absents des deux avant. Un combattant qui a agi, un ennemi qui Se
 * relève seul (il reste dans l'aperçu) et le changement de manche ne font rien sortir. Au premier
 * rendu (`previous` à `null`), rien ne bouge.
 */
export function trackTransition(
  previous: ActionTrackView | null,
  current: ActionTrackView,
): TrackTransition {
  if (previous === null) return { leaving: [], entering: [] };
  const before = enemyKeys(previous);
  const now = enemyKeys(current);
  const gone = (entry: TrackEntry) => {
    const key = enemyKey(entry);
    return key !== null && !now.has(key);
  };
  const leavingFrom = (row: TrackRow) =>
    previous[row].flatMap((entry, index) => (gone(entry) ? [{ entry, row, index }] : []));
  const seen = new Set<string>();
  const entering = [...current.current, ...current.next].filter((entry) => {
    const key = enemyKey(entry);
    if (key === null || before.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { leaving: [...leavingFrom('current'), ...leavingFrom('next')], entering };
}

/** Une case rendue : une case de la frise, ou la case fantôme d'un ennemi qui sort. */
export interface PlacedEntry {
  readonly entry: TrackEntry;
  readonly ghost: boolean;
}

/** Les cases d'une rangée, avec la case fantôme de chaque ennemi qui sort à sa place d'avant. */
export function placeGhosts(
  row: readonly TrackEntry[],
  ghosts: readonly LeavingEntry[],
): PlacedEntry[] {
  const placed: PlacedEntry[] = row.map((entry) => ({ entry, ghost: false }));
  [...ghosts]
    .sort((a, b) => a.index - b.index)
    .forEach(({ entry, index }) => placed.splice(index, 0, { entry, ghost: true }));
  return placed;
}
