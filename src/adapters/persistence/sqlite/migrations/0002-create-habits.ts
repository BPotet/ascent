import type { Migration } from './Migration';

/**
 * Habitudes (ADR 0002). `id` suit l'ordre de création (AUTOINCREMENT ne réutilise jamais un
 * identifiant). `name_key` est la clé du nom calculée par le domaine (sans majuscules) : l'index
 * UNIQUE est un filet de sécurité, la règle du doublon est vérifiée avant par le domaine.
 * `created_on` est le jour de création, en texte `AAAA-MM-JJ`.
 */
export const createHabits: Migration = {
  version: 2,
  name: 'create habits',
  sql: `
    CREATE TABLE habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
      name_key TEXT NOT NULL UNIQUE,
      created_on TEXT NOT NULL
        CHECK (created_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    ) STRICT;
  `,
};
