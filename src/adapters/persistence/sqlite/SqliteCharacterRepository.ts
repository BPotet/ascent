import type { CharacterRepository } from '../../../application/ports/CharacterRepository';
import { Character } from '../../../domain/character/Character';
import type { SqlDatabase } from './SqlDatabase';

interface CharacterRow {
  readonly xp: number;
  readonly retained_xp: number;
}

/**
 * Le personnage dans la table `character` (migration 0004), sa ligne unique `id = 1`, créée par la
 * migration. À utiliser dans une unité de travail.
 */
export class SqliteCharacterRepository implements CharacterRepository {
  constructor(private readonly db: SqlDatabase) {}

  async get(): Promise<Character> {
    const row = await this.db.getFirst<CharacterRow>(
      'SELECT xp, retained_xp FROM character WHERE id = 1',
    );
    if (row === null) {
      throw new Error('The character is missing from the database');
    }
    return new Character(row.xp, row.retained_xp);
  }

  async save(character: Character): Promise<void> {
    await this.db.run(
      `INSERT INTO character (id, xp, retained_xp) VALUES (1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET xp = excluded.xp, retained_xp = excluded.retained_xp`,
      [character.xp, character.retainedXp],
    );
  }
}
