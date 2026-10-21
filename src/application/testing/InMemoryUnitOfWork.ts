// Réservé aux tests : unité de travail et dépôts en mémoire. Ils passent les mêmes tests de contrat
// que les adaptateurs SQLite (`src/adapters/persistence/testing/`), et peuvent simuler une panne.
// Ils vivent dans `application/testing` pour servir aux tests des cas d'usage et des écrans, qui
// n'ont pas le droit d'importer un adaptateur de persistance.
import { Character } from '../../domain/character/Character';
import { type CheckIn, isBlank } from '../../domain/checkIn/CheckIn';
import type { Day } from '../../domain/day/Day';
import { Habit, type HabitId } from '../../domain/habit/Habit';
import type { HabitName } from '../../domain/habit/HabitName';
import {
  compareSettingsChanges,
  type SettingsChange,
  type SettingsChangeValues,
} from '../../domain/habit/SettingsChange';
import type { CharacterRepository } from '../ports/CharacterRepository';
import type { CheckInRepository } from '../ports/CheckInRepository';
import type { HabitRepository } from '../ports/HabitRepository';
import type { SettingsChangeRepository } from '../ports/SettingsChangeRepository';
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
  character: Character;
  settingsChanges: SettingsChange[];
  lastSequence: number;
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
    this.checkWrites();
    if (this.state.habits.some((habit) => habit.name.sameAs(name))) {
      throw new Error(`UNIQUE constraint failed: habits.name_key (${name.key})`);
    }
    this.state.lastHabitId += 1;
    const habit = new Habit(this.state.lastHabitId, name, createdOn);
    this.state.habits.push(habit);
    return habit;
  }

  async rename(id: HabitId, name: HabitName): Promise<void> {
    this.checkWrites();
    if (this.state.habits.some((habit) => habit.id !== id && habit.name.sameAs(name))) {
      throw new Error(`UNIQUE constraint failed: habits.name_key (${name.key})`);
    }
    this.state.habits = this.state.habits.map((habit) =>
      habit.id === id ? new Habit(habit.id, name, habit.createdOn) : habit,
    );
  }

  /** Comme `ON DELETE CASCADE` : les suivis et les changements de réglages sont effacés avec elle. */
  async remove(id: HabitId): Promise<void> {
    this.checkWrites();
    this.state.habits = this.state.habits.filter((habit) => habit.id !== id);
    this.state.settingsChanges = this.state.settingsChanges.filter(
      (change) => change.habitId !== id,
    );
    for (const [key, checkIn] of this.state.checkIns) {
      if (checkIn.habitId === id) {
        this.state.checkIns.delete(key);
      }
    }
  }

  private checkWrites(): void {
    if (this.faults.writes) {
      throw new StorageUnavailableError('write habits');
    }
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

  async listByHabit(habitId: HabitId): Promise<CheckIn[]> {
    this.checkReads();
    return [...this.state.checkIns.values()]
      .filter((checkIn) => checkIn.habitId === habitId)
      .sort(byDayThenHabit);
  }

  private checkReads(): void {
    if (this.faults.reads) {
      throw new StorageUnavailableError('read check-ins');
    }
  }
}

class InMemoryCharacterRepository implements CharacterRepository {
  constructor(
    private readonly state: State,
    private readonly faults: Faults,
  ) {}

  async get(): Promise<Character> {
    if (this.faults.reads) {
      throw new StorageUnavailableError('read the character');
    }
    return this.state.character;
  }

  async save(character: Character): Promise<void> {
    if (this.faults.writes) {
      throw new StorageUnavailableError('write the character');
    }
    this.state.character = character;
  }
}

const byHabitThenHistory = (a: SettingsChange, b: SettingsChange) =>
  a.habitId - b.habitId || compareSettingsChanges(a, b);

class InMemorySettingsChangeRepository implements SettingsChangeRepository {
  constructor(
    private readonly state: State,
    private readonly faults: Faults,
  ) {}

  async listByHabit(habitId: HabitId): Promise<SettingsChange[]> {
    return (await this.listAll()).filter((change) => change.habitId === habitId);
  }

  async listAll(): Promise<SettingsChange[]> {
    if (this.faults.reads) {
      throw new StorageUnavailableError('read settings changes');
    }
    return [...this.state.settingsChanges].sort(byHabitThenHistory);
  }

  async add(
    habitId: HabitId,
    changedOn: Day,
    settings: SettingsChangeValues,
  ): Promise<SettingsChange> {
    if (this.faults.writes) {
      throw new StorageUnavailableError('write settings changes');
    }
    if (!this.state.habits.some((habit) => habit.id === habitId)) {
      throw new Error(`FOREIGN KEY constraint failed: no habit ${habitId}`);
    }
    this.state.lastSequence += 1;
    const change: SettingsChange = {
      habitId,
      changedOn,
      sequence: this.state.lastSequence,
      difficulty: settings.difficulty,
    };
    this.state.settingsChanges.push(change);
    return change;
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  private state: State = {
    habits: [],
    lastHabitId: 0,
    checkIns: new Map(),
    character: Character.NEW,
    settingsChanges: [],
    lastSequence: 0,
  };
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
      settingsChanges: [...this.state.settingsChanges],
    };
    try {
      return await work({
        habits: new InMemoryHabitRepository(this.state, this.faults),
        checkIns: new InMemoryCheckInRepository(this.state, this.faults),
        character: new InMemoryCharacterRepository(this.state, this.faults),
        settingsChanges: new InMemorySettingsChangeRepository(this.state, this.faults),
      });
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }
}
