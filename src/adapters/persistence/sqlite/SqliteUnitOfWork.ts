import type { Repositories, UnitOfWork } from '../../../application/ports/UnitOfWork';
import type { SqlDatabase } from './SqlDatabase';
import { SqliteCharacterRepository } from './SqliteCharacterRepository';
import { SqliteCheckInRepository } from './SqliteCheckInRepository';
import { SqliteHabitRepository } from './SqliteHabitRepository';

/**
 * Unité de travail sur la base locale (ADR 0002, décision 6).
 * Les unités de travail sont mises en file : une seule transaction à la fois sur la connexion,
 * car expo-sqlite refuse un BEGIN dans une transaction déjà ouverte.
 */
export class SqliteUnitOfWork implements UnitOfWork {
  private readonly repositories: Repositories;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: SqlDatabase) {
    this.repositories = {
      habits: new SqliteHabitRepository(db),
      checkIns: new SqliteCheckInRepository(db),
      character: new SqliteCharacterRepository(db),
    };
  }

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.execute(work));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    let result: T | undefined;
    await this.db.transaction(async () => {
      result = await work(this.repositories);
    });
    return result as T;
  }
}
