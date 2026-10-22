import type { Migration } from './Migration';

/**
 * Objectif hebdomadaire (#24, ADR 0003, §4) : une colonne `weekly_target` sur les changements de
 * réglages, de 1 à 7, **vide (NULL) et sans valeur par défaut**. Les changements existants
 * (rétro-remplis par 0005, puis créés par #23) restent vides : vide veut dire « ce réglage n'existait
 * pas encore », donc pas d'objectif pour leurs semaines (R17). Aucune ligne n'est réécrite et aucune
 * date n'est calculée en SQL.
 *
 * L'objectif des habitudes existantes vient du changement d'introduction (`introduceWeeklyTarget`),
 * ajouté au démarrage après les migrations et daté par l'horloge de l'application. `character`
 * n'est pas touché.
 */
export const addWeeklyTarget: Migration = {
  version: 6,
  name: 'add weekly_target to settings_changes',
  sql: `
    ALTER TABLE settings_changes ADD COLUMN weekly_target INTEGER
      CHECK (weekly_target IS NULL OR weekly_target BETWEEN 1 AND 7);
  `,
};
