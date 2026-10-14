// Réservé aux tests d'intégration : une connexion expo-sqlite simulée sur une vraie base SQLite
// (`node:sqlite`). Elle reproduit le comportement d'expo-sqlite 57 qui compte pour les transactions :
// - `withTransactionAsync` envoie BEGIN, COMMIT et ROLLBACK sur la connexion elle-même ;
// - `withExclusiveTransactionAsync` ouvre une AUTRE connexion, sur laquelle les requêtes de la
//   transaction doivent passer.
// Chaque instruction est journalisée avec le nom de la connexion qui l'a reçue.
// Pour les scénarios : `reopen()` rouvre la même base (redémarrage de l'application) et
// `faults.failWhen(...)` fait échouer des requêtes (panne de stockage, voir `sqlFaults.ts`).
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SqlValue } from '../sqlite/SqlDatabase';
import { SqlFaults } from './sqlFaults';

export interface ExecutedStatement {
  readonly connection: string;
  readonly sql: string;
}

export class FakeExpoSqliteConnection {
  closed = false;
  failOnClose = false;
  /** Les requêtes de cette connexion à faire échouer. */
  readonly faults = new SqlFaults();

  private constructor(
    private readonly db: DatabaseSync,
    readonly name: string,
    readonly statements: ExecutedStatement[],
  ) {}

  static open(): FakeExpoSqliteConnection {
    return new FakeExpoSqliteConnection(
      new DatabaseSync(':memory:', { enableForeignKeyConstraints: false }),
      'main',
      [],
    );
  }

  /**
   * Une nouvelle connexion à la même base, comme après un redémarrage de l'application :
   * les données sont conservées, le journal des instructions et les pannes repartent de zéro.
   */
  reopen(): FakeExpoSqliteConnection {
    return new FakeExpoSqliteConnection(this.db, 'main', []);
  }

  private log(sql: string): void {
    if (this.closed) {
      throw new Error('Access to closed resource');
    }
    this.statements.push({ connection: this.name, sql });
    this.faults.check(sql);
  }

  async execAsync(source: string): Promise<void> {
    this.log(source);
    this.db.exec(source);
  }

  async runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }> {
    this.log(source);
    const result = this.db.prepare(source).run(...(params as SQLInputValue[]));
    return { changes: Number(result.changes) };
  }

  async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
    this.log(source);
    return (this.db.prepare(source).get(...(params as SQLInputValue[])) as T | undefined) ?? null;
  }

  async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
    this.log(source);
    return this.db.prepare(source).all(...(params as SQLInputValue[])) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    try {
      await this.execAsync('BEGIN');
      await task();
      await this.execAsync('COMMIT');
    } catch (error) {
      await this.execAsync('ROLLBACK');
      throw error;
    }
  }

  async withExclusiveTransactionAsync(
    task: (txn: FakeExpoSqliteConnection) => Promise<void>,
  ): Promise<void> {
    const txn = new FakeExpoSqliteConnection(this.db, 'exclusive-transaction', this.statements);
    await txn.withTransactionAsync(() => task(txn));
  }

  async closeAsync(): Promise<void> {
    if (this.failOnClose) {
      throw new Error('Unable to close the database');
    }
    this.closed = true;
  }
}
