/** Valeur qu'on peut lier à un paramètre `?` d'une requête SQL. */
export type SqlValue = string | number | null;

/**
 * Accès SQL minimal dont ont besoin les adaptateurs de persistance.
 * Implémenté par expo-sqlite sur le téléphone et par `node:sqlite` dans les tests d'intégration,
 * pour que les adaptateurs soient testés sur une vraie base SQLite.
 */
export interface SqlDatabase {
  /** Exécute une ou plusieurs instructions, sans paramètre. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  getFirst<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row | null>;
  getAll<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;
  /** Exécute `task` dans une transaction : tout est annulé si elle échoue. */
  transaction(task: () => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
