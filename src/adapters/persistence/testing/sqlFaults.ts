// Réservé aux tests : désigner les requêtes SQL à faire échouer, pour simuler une panne de stockage.
import type { SqlValue } from '../sqlite/SqlDatabase';

/** Une panne ciblée : les requêtes qui répondent à `sql` et dont les paramètres vérifient `params`. */
export interface SqlFault {
  readonly sql: RegExp;
  readonly params: (params: readonly SqlValue[]) => boolean;
}

/** Les lectures d'une table (`SELECT … FROM table`). */
export function readsFrom(table: string): RegExp {
  return new RegExp(String.raw`^\s*SELECT\b[\s\S]*\bFROM\s+${table}\b`, 'i');
}

/** Les écritures dans une table (`INSERT INTO`, `UPDATE`, `DELETE FROM`). */
export function writesTo(table: string): RegExp {
  return new RegExp(String.raw`^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+${table}\b`, 'i');
}

/**
 * Les lectures d'une table qui portent sur `value`, par exemple les suivis d'une semaine
 * (`readsFromWith('check_ins', '2026-10-05')`) : les autres lectures de la table réussissent.
 */
export function readsFromWith(table: string, value: SqlValue): SqlFault {
  return { sql: readsFrom(table), params: (params) => params.includes(value) };
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
  private fault: SqlFault | null = null;

  /** Fait échouer les requêtes qui répondent à `fault` ; `null` répare. */
  failWhen(fault: RegExp | SqlFault | null): void {
    this.fault = fault instanceof RegExp ? { sql: fault, params: () => true } : fault;
  }

  check(sql: string, params: readonly SqlValue[] = []): void {
    if (this.fault !== null && this.fault.sql.test(sql) && this.fault.params(params)) {
      throw new SimulatedStorageError(sql);
    }
  }
}
