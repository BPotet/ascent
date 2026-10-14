import type { CheckInRepository } from '../../../application/ports/CheckInRepository';
import { type CheckIn, isBlank } from '../../../domain/checkIn/CheckIn';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import type { SqlDatabase } from './SqlDatabase';

interface CheckInRow {
  readonly habit_id: number;
  readonly day: string;
  readonly done: number;
  readonly corrected: number;
}

const COLUMNS = 'habit_id, day, done, corrected';

const toCheckIn = (row: CheckInRow): CheckIn => ({
  habitId: row.habit_id,
  day: Day.fromIsoString(row.day),
  done: row.done === 1,
  corrected: row.corrected === 1,
});

/** Suivis dans la table `check_ins` (migration 0003). À utiliser dans une unité de travail. */
export class SqliteCheckInRepository implements CheckInRepository {
  constructor(private readonly db: SqlDatabase) {}

  async find(habitId: HabitId, day: Day): Promise<CheckIn | null> {
    const row = await this.db.getFirst<CheckInRow>(
      `SELECT ${COLUMNS} FROM check_ins WHERE habit_id = ? AND day = ?`,
      [habitId, day.toIsoString()],
    );
    return row === null ? null : toCheckIn(row);
  }

  async save(checkIn: CheckIn): Promise<void> {
    const key = [checkIn.habitId, checkIn.day.toIsoString()];
    if (isBlank(checkIn)) {
      await this.db.run('DELETE FROM check_ins WHERE habit_id = ? AND day = ?', key);
      return;
    }
    await this.db.run(
      `INSERT INTO check_ins (${COLUMNS}) VALUES (?, ?, ?, ?)
       ON CONFLICT (habit_id, day) DO UPDATE SET done = excluded.done, corrected = excluded.corrected`,
      [...key, Number(checkIn.done), Number(checkIn.corrected)],
    );
  }

  async listBetween(from: Day, to: Day): Promise<CheckIn[]> {
    const rows = await this.db.getAll<CheckInRow>(
      `SELECT ${COLUMNS} FROM check_ins WHERE day BETWEEN ? AND ? ORDER BY day, habit_id`,
      [from.toIsoString(), to.toIsoString()],
    );
    return rows.map(toCheckIn);
  }
}
