import type { AnyAscentLog, AscentLog } from '../../domain/ascentLog/AscentLog';
import type { BattleLog, FloorPlace } from '../../domain/ascentLog/BattleLog';

/**
 * Le stockage des journaux d'ascension (`AscentLogStore`, #196, ADR 0014), et de leurs combats, un
 * par combat (#197, ADR 0016). Les journaux et les combats sont rendus bruts : leur lecture et leur
 * version du format se décident dans le domaine.
 */
export interface AscentLogStore {
  /**
   * Ajoute le journal d'une ascension qui commence et lui attribue son `id` ; les plus anciens
   * au-delà de `kept` sont effacés, avec leurs combats.
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
  /** Remplace le combat de son palier et de son étage, dans le journal `logId`. */
  saveBattle(logId: number, battle: BattleLog): Promise<void>;
  /** Les combats du journal `logId` aux lieux `places`, dans cet ordre ; un combat absent est sauté. */
  readBattles(logId: number, places: readonly FloorPlace[]): Promise<readonly string[]>;
}
