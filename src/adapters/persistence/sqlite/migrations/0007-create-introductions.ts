import type { Migration } from './Migration';

/**
 * Introductions (#26, ADR 0003, §6) : la trace qu'une règle d'expérience introduite par une mise à
 * jour a été appliquée une fois aux données existantes (`IntroductionRepository`). Seule `targetBonus`
 * (la prime d'objectif, rattrapée par `introduceTargetBonus`) est admise ; une future introduction
 * élargira le `CHECK` par une nouvelle migration. `introduced_on` est le jour, en texte `AAAA-MM-JJ`,
 * donné par l'horloge de l'application.
 *
 * Migration additive : elle crée une table vide, ne réécrit aucune ligne, ne calcule aucune date en
 * SQL et n'a aucun `DEFAULT` (§5). `character` n'est pas touché : le rattrapage est fait par le
 * domaine, au démarrage, pour qu'une migration publiée ne dépende jamais d'une règle qui évolue.
 */
export const createIntroductions: Migration = {
  version: 7,
  name: 'create introductions',
  sql: `
    CREATE TABLE introductions (
      name TEXT PRIMARY KEY NOT NULL CHECK (name IN ('targetBonus')),
      introduced_on TEXT NOT NULL
        CHECK (introduced_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    ) STRICT;
  `,
};
