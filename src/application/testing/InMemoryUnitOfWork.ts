// Réservé aux tests : unité de travail et dépôts en mémoire. Ils passent les mêmes tests de contrat
// que les adaptateurs SQLite (`src/adapters/persistence/testing/`), et peuvent simuler une panne.
// Ils vivent dans `application/testing` pour servir aux tests des cas d'usage et des écrans, qui
// n'ont pas le droit d'importer un adaptateur de persistance.
import { type CheckIn, isBlank } from '../../domain/checkIn/CheckIn';
import type { Day } from '../../domain/day/Day';
import { Habit, type HabitId } from '../../domain/habit/Habit';
import type { HabitName } from '../../domain/habit/HabitName';
import type { CheckInRepository } from '../ports/CheckInRepository';
import type { HabitRepository } from '../ports/HabitRepository';
import type { Repositories, UnitOfWork } from '../ports/UnitOfWork';

export class StorageUnavailableError extends Error {
  constructor(operation: string) {
    super(`Storage unavailable: cannot ${operation}`);
    this.name = 'StorageUnavailableError';
  }
}

interface Faults {
  reads: boolean;
  writes: boolean;
}

interface State {
  habits: Habit[];
  lastHabitId: number;
  /** Les suivis, par habitude et par jour (`clé de checkInKey`). */
  checkIns: Map<string, CheckIn>;
}

const checkInKey = (habitId: HabitId, day: Day) => `${habitId}/${day.toIsoString()}`;

const byDayThenHabit = (a: CheckIn, b: CheckIn) => a.day.compareTo(b.day) || a.habitId - b.habitId;

class InMemoryHabitRepository implements HabitRepository {
  constructor(
    private readonly state: State,
    private readonly faults: Faults,
  ) {}

  async listAll(): Promise<Habit[]> {
    if (this.faults.reads) {
      throw new StorageUnavailableError('read habits');
    }
    return [...this.state.habits];
  }

  async findById(id: HabitId): Promise<Habit | null> {
    return (await this.listAll()).find((habit) => habit.id === id) ?? null;
  }

  async add(name: HabitName, createdOn: Day): Promise<Habit> {
    if (this.faults.writes) {
      throw new StorageUnavailableError('write habits');
    }
    if (this.state.habits.some((habit) => habit.name.sameAs(name))) {
      throw new Error(`UNIQUE constraint failed: habits.name_key (${name.key})`);
    }
    this.state.lastHabitId += 1;
    const habit = new Habit(this.state.lastHabitId, name, createdOn);
    this.state.habits.push(habit);
    return habit;
  }
}

class InMemoryCheckInRepository implements CheckInRepository {
  constructor(
    private readonly state: State,
    private readonly faults: Faults,
  ) {}

  async find(habitId: HabitId, day: Day): Promise<CheckIn | null> {
    this.checkReads();
    return this.state.checkIns.get(checkInKey(habitId, day)) ?? null;
  }

  async save(checkIn: CheckIn): Promise<void> {
    if (this.faults.writes) {
      throw new StorageUnavailableError('write check-ins');
    }
    if (!this.state.habits.some((habit) => habit.id === checkIn.habitId)) {
      throw new Error(`FOREIGN KEY constraint failed: no habit ${checkIn.habitId}`);
    }
    const key = checkInKey(checkIn.habitId, checkIn.day);
    if (isBlank(checkIn)) {
      this.state.checkIns.delete(key);
    } else {
      this.state.checkIns.set(key, { ...checkIn });
    }
  }

  async listBetween(from: Day, to: Day): Promise<CheckIn[]> {
    this.checkReads();
    return [...this.state.checkIns.values()]
      .filter(({ day }) => !day.isBefore(from) && !day.isAfter(to))
      .sort(byDayThenHabit);
  }

  private checkReads(): void {
    if (this.faults.reads) {
      throw new StorageUnavailableError('read check-ins');
    }
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  private state: State = { habits: [], lastHabitId: 0, checkIns: new Map() };
  private readonly faults: Faults = { reads: false, writes: false };
  private queue: Promise<unknown> = Promise.resolve();

  /** Simule une panne de lecture des données (ou la répare avec `false`). */
  failReads(fail = true): void {
    this.faults.reads = fail;
  }

  /** Simule une panne d'écriture des données (ou la répare avec `false`). */
  failWrites(fail = true): void {
    this.faults.writes = fail;
  }

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.execute(work));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async execute<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    const snapshot: State = {
      ...this.state,
      habits: [...this.state.habits],
      checkIns: new Map(this.state.checkIns),
    };
    try {
      return await work({
        habits: new InMemoryHabitRepository(this.state, this.faults),
        checkIns: new InMemoryCheckInRepository(this.state, this.faults),
      });
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }
}
