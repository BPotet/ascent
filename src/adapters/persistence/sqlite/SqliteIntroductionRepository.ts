import type {
  Introduction,
  IntroductionRepository,
} from '../../../application/ports/IntroductionRepository';
import type { Day } from '../../../domain/day/Day';
import type { SqlDatabase } from './SqlDatabase';

/**
 * Les introductions dans la table `introductions` (migration 0007), une ligne par introduction
 * appliquée : sa clé primaire refuse d'en enregistrer une deux fois. À utiliser dans une unité de
 * travail, avec l'expérience qu'elle ajoute.
 */
export class SqliteIntroductionRepository implements IntroductionRepository {
  constructor(private readonly db: SqlDatabase) {}

  async has(introduction: Introduction): Promise<boolean> {
    const row = await this.db.getFirst<{ readonly name: string }>(
      'SELECT name FROM introductions WHERE name = ?',
      [introduction],
    );
    return row !== null;
  }

  async add(introduction: Introduction, on: Day): Promise<void> {
    await this.db.run('INSERT INTO introductions (name, introduced_on) VALUES (?, ?)', [
      introduction,
      on.toIsoString(),
    ]);
  }
}
