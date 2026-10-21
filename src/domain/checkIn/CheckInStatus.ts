/**
 * État du suivi (`CheckInStatus`) d'une case, voir `docs/glossary.md` et R8 :
 * - `done` : Fait, suivi « fait », jour ≤ aujourd'hui ;
 * - `pending` : À faire, aujourd'hui sans « fait » ;
 * - `missed` : Pas fait, jour clos sans « fait » ;
 * - `upcoming` : À venir, jour après aujourd'hui, non modifiable ;
 * - `notStarted` : Hors habitude, jour avant le jour de création, non modifiable.
 */
export type CheckInStatus = 'done' | 'pending' | 'missed' | 'upcoming' | 'notStarted';
