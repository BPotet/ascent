// Réservé aux tests : désigner les requêtes SQL à faire échouer, pour simuler une panne de stockage.

/** Les lectures d'une table (`SELECT … FROM table`). */
export function readsFrom(table: string): RegExp {
  return new RegExp(String.raw`^\s*SELECT\b[\s\S]*\bFROM\s+${table}\b`, 'i');
}

/** Les écritures dans une table (`INSERT INTO`, `UPDATE`, `DELETE FROM`). */
export function writesTo(table: string): RegExp {
  return new RegExp(String.raw`^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+${table}\b`, 'i');
}

/** L'erreur levée par une requête qu'on fait échouer. */
export class SimulatedStorageError extends Error {
  constructor(sql: string) {
    super(`Simulated storage failure: ${sql.trim().split(/\s+/).slice(0, 4).join(' ')}`);
    this.name = 'SimulatedStorageError';
  }
}

/** Un interrupteur de pannes : `failWhen(pattern)` fait échouer les requêtes qui y répondent. */
export class SqlFaults {
  private pattern: RegExp | null = null;

  /** Fait échouer les requêtes qui répondent à `pattern` ; `null` répare. */
  failWhen(pattern: RegExp | null): void {
    this.pattern = pattern;
  }

  check(sql: string): void {
    if (this.pattern?.test(sql)) {
      throw new SimulatedStorageError(sql);
    }
  }
}
