import type { Migration } from './Migration';

/**
 * Suivis (ADR 0002, décisions 3 et 4) : au plus un par habitude et par jour (clé primaire).
 * `done` et `corrected` (la marque « corrigé ») valent 0 ou 1 ; une case « pas fait » non corrigée
 * n'a pas de ligne. Les suivis d'une habitude supprimée sont effacés avec elle (cascade, avec
 * `PRAGMA foreign_keys = ON`). `day` est en texte `AAAA-MM-JJ`, indexé pour les intervalles de jours.
 */
export const createCheckIns: Migration = {
  version: 3,
  name: 'create check_ins',
  sql: `
    CREATE TABLE check_ins (
      habit_id INTEGER NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
      day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      done INTEGER NOT NULL CHECK (done IN (0, 1)),
      corrected INTEGER NOT NULL CHECK (corrected IN (0, 1)),
      PRIMARY KEY (habit_id, day),
      CHECK (done = 1 OR corrected = 1)
    ) STRICT, WITHOUT ROWID;
    CREATE INDEX check_ins_by_day ON check_ins (day);
  `,
};
