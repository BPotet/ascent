import type { SettingsChangeRepository } from '../../../application/ports/SettingsChangeRepository';
import { Day } from '../../../domain/day/Day';
import { parseDifficulty } from '../../../domain/habit/Difficulty';
import type { HabitId } from '../../../domain/habit/Habit';
import type { SettingsChange, SettingsChangeValues } from '../../../domain/habit/SettingsChange';
import type { SqlDatabase } from './SqlDatabase';

interface SettingsChangeRow {
  readonly sequence: number;
  readonly habit_id: number;
  readonly changed_on: string;
  readonly difficulty: string;
}

const COLUMNS = 'sequence, habit_id, changed_on, difficulty';

const toSettingsChange = (row: SettingsChangeRow): SettingsChange => ({
  habitId: row.habit_id,
  changedOn: Day.fromIsoString(row.changed_on),
  sequence: row.sequence,
  difficulty: parseDifficulty(row.difficulty),
});

/**
 * Changements de réglages dans la table `settings_changes` (migration 0005), effacés avec leur
 * habitude par `ON DELETE CASCADE`. À utiliser dans une unité de travail.
 */
export class SqliteSettingsChangeRepository implements SettingsChangeRepository {
  constructor(private readonly db: SqlDatabase) {}

  async listByHabit(habitId: HabitId): Promise<SettingsChange[]> {
    const rows = await this.db.getAll<SettingsChangeRow>(
      `SELECT ${COLUMNS} FROM settings_changes WHERE habit_id = ? ORDER BY changed_on, sequence`,
      [habitId],
    );
    return rows.map(toSettingsChange);
  }

  async listAll(): Promise<SettingsChange[]> {
    const rows = await this.db.getAll<SettingsChangeRow>(
      `SELECT ${COLUMNS} FROM settings_changes ORDER BY habit_id, changed_on, sequence`,
    );
    return rows.map(toSettingsChange);
  }

  async add(
    habitId: HabitId,
    changedOn: Day,
    settings: SettingsChangeValues,
  ): Promise<SettingsChange> {
    const row = (await this.db.getFirst<SettingsChangeRow>(
      `INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (?, ?, ?)
       RETURNING ${COLUMNS}`,
      [habitId, changedOn.toIsoString(), settings.difficulty],
    )) as SettingsChangeRow;
    return toSettingsChange(row);
  }
}
