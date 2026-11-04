import type { AnyAscentLog, AscentLog } from '../../domain/ascentLog/AscentLog';

/**
 * Le stockage des journaux d'ascension (`AscentLogStore`, #196, ADR 0014). Les journaux sont rendus
 * bruts : leur lecture et leur version du format se décident dans le domaine.
 */
export interface AscentLogStore {
  /**
   * Ajoute le journal d'une ascension qui commence et lui attribue son `id` ; les plus anciens
   * au-delà de `kept` sont effacés.
   */
  start(log: AscentLog, kept: number): Promise<AscentLog>;
  /** Remplace ce journal (même `id`) seulement. */
  save(log: AnyAscentLog): Promise<void>;
  /** Le dernier journal ajouté, `null` sans journal. */
  latest(): Promise<string | null>;
  /** Les journaux gardés, du plus ancien au plus récent. */
  readAll(): Promise<readonly string[]>;
  /** Le nombre de journaux gardés, sans les lire. */
  count(): Promise<number>;
}
