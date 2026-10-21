import type { Migration } from './Migration';

/**
 * Personnage (ADR 0002, décision 5) : une seule ligne (`id = 1`), avec son expérience `xp` et son
 * Xp conservée `retained_xp`, jamais négatives (R16).
 *
 * Calcul rétroactif (R19) : l'expérience part de 10 Xp par suivi « fait » déjà enregistré, toutes
 * dates confondues (invariant R15) ; un « pas fait » corrigé ne compte pas. L'Xp conservée vaut 0,
 * car aucune habitude n'a pu être supprimée avant cette version (#6 vient après #5). Le barème de
 * 10 Xp est figé ici : un autre barème passerait par une nouvelle migration.
 */
export const createCharacter: Migration = {
  version: 4,
  name: 'create character',
  sql: `
    CREATE TABLE character (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      xp INTEGER NOT NULL CHECK (xp >= 0),
      retained_xp INTEGER NOT NULL CHECK (retained_xp >= 0)
    ) STRICT;
    INSERT INTO character (id, xp, retained_xp)
      SELECT 1, 10 * COUNT(*), 0 FROM check_ins WHERE done = 1;
  `,
};
