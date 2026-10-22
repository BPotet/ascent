import type { Migration } from './Migration';

/**
 * Changements de réglages (ADR 0003) : l'historique daté des réglages de chaque habitude, effacé
 * avec elle (cascade, avec `PRAGMA foreign_keys = ON`). `sequence` est l'ordre de saisie
 * (AUTOINCREMENT ne réutilise jamais une valeur) ; `changed_on` est le jour de la saisie, en texte
 * `AAAA-MM-JJ`, toujours donné par l'horloge de l'application, jamais calculé en SQL.
 *
 * Migration additive : chaque habitude existante reçoit un changement « Moyenne » daté de son jour
 * de création (R2). Toutes ses semaines valent donc 10 Xp par case « fait », le barème de la
 * migration 0004 : l'expérience (`character`) n'est pas touchée et reste exactement la même.
 *
 * Un réglage ajouté plus tard (l'objectif hebdomadaire, #24) sera une colonne vide (NULL) sans
 * valeur par défaut : aucune valeur n'est inventée pour le passé.
 */
export const createSettingsChanges: Migration = {
  version: 5,
  name: 'create settings_changes',
  sql: `
    CREATE TABLE settings_changes (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
      changed_on TEXT NOT NULL
        CHECK (changed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard'))
    ) STRICT;
    CREATE INDEX settings_changes_by_habit ON settings_changes (habit_id, changed_on, sequence);
    INSERT INTO settings_changes (habit_id, changed_on, difficulty)
      SELECT id, created_on, 'medium' FROM habits ORDER BY id;
  `,
};
