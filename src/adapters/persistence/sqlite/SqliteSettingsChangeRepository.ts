import type { SettingsChangeRepository } from '../../../application/ports/SettingsChangeRepository';
import { Day } from '../../../domain/day/Day';
import { parseDifficulty } from '../../../domain/habit/Difficulty';
import type { HabitId } from '../../../domain/habit/Habit';
import type { HabitSettings, SettingsChange } from '../../../domain/habit/SettingsChange';
import { parseWeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import type { SqlDatabase } from './SqlDatabase';

interface SettingsChangeRow {
  readonly sequence: number;
  readonly habit_id: number;
  readonly changed_on: string;
  readonly difficulty: string;
  readonly weekly_target: number | null;
}

const COLUMNS = 'sequence, habit_id, changed_on, difficulty, weekly_target';

const toSettingsChange = (row: SettingsChangeRow): SettingsChange => ({
  habitId: row.habit_id,
  changedOn: Day.fromIsoString(row.changed_on),
  sequence: row.sequence,
  difficulty: parseDifficulty(row.difficulty),
  weeklyTarget: row.weekly_target === null ? null : parseWeeklyTarget(row.weekly_target),
});

/**
 * Changements de réglages dans la table `settings_changes` (migrations 0005 et 0006), effacés avec
 * leur habitude par `ON DELETE CASCADE`. L'objectif hebdomadaire est vide (NULL) dans les changements
 * d'avant la mise à jour de #24, relu `null` ; il est toujours écrit. À utiliser dans une unité de
 * travail.
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

  async add(habitId: HabitId, changedOn: Day, settings: HabitSettings): Promise<SettingsChange> {
    const row = (await this.db.getFirst<SettingsChangeRow>(
      `INSERT INTO settings_changes (habit_id, changed_on, difficulty, weekly_target)
       VALUES (?, ?, ?, ?)
       RETURNING ${COLUMNS}`,
      [habitId, changedOn.toIsoString(), settings.difficulty, settings.weeklyTarget],
    )) as SettingsChangeRow;
    return toSettingsChange(row);
  }
}
