import type { Day } from '../../domain/day/Day';

/**
 * Une règle d'expérience introduite par une mise à jour, à appliquer une fois aux données
 * existantes : `targetBonus`, la prime d'objectif (#26, `introduceTargetBonus`).
 */
export type Introduction = 'targetBonus';

/**
 * Dépôt des introductions (`IntroductionRepository`), voir `docs/glossary.md` (« Introduction ») et
 * l'ADR 0003, §6 : la trace qu'une règle d'expérience introduite par une mise à jour a été appliquée
 * une fois aux données existantes. On ne l'obtient que dans une unité de travail (`UnitOfWork`) : la
 * trace s'écrit dans la même transaction que l'expérience ajoutée, pour qu'un démarrage interrompu
 * puis rejoué n'accorde jamais deux fois. À distinguer du changement d'introduction
 * (`introductionChange`) : une introduction ne touche aucune habitude. Une panne de stockage est une
 * exception.
 */
export interface IntroductionRepository {
  /** Vrai si `introduction` a déjà été appliquée. */
  has(introduction: Introduction): Promise<boolean>;
  /**
   * Enregistre que `introduction` a été appliquée le jour `on` (lu sur l'horloge). Une introduction
   * déjà enregistrée est refusée par une exception.
   */
  add(introduction: Introduction, on: Day): Promise<void>;
}
