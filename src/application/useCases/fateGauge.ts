import { blessingRarities } from '../../domain/ascent/blessings';
import { fateGauge, type FateGauge } from '../../domain/ascent/fateGauge';
import type { Rarity } from '../../domain/ascent/rarity';
import { expectedHabitsOn } from '../../domain/habit/ExpectedHabit';
import { weekSettingsOf } from '../../domain/habit/WeekSettings';
import { Week } from '../../domain/week/Week';
import type { PreferenceDependencies } from './checkInHint';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** Le scellement de la jauge (`GaugeSeal`) du jour, dans le stockage clé-valeur (#93, P29). */
export const GAUGE_SEAL_KEY = 'ascent.gaugeSeal';

export type FateGaugeDependencies = UseCaseDependencies & PreferenceDependencies;

/** La jauge du jour, d'après hier : `done` habitudes faites sur `expected` attendues. */
export interface FateGaugeReading {
  readonly gauge: FateGauge;
  /** Les raretés des bénédictions de départ, une par habitude faite hier (3 au plus). */
  readonly blessings: readonly Rarity[];
  readonly done: number;
  readonly expected: number;
  /** Figée au lancement de la 1re ascension du jour. */
  readonly sealed: boolean;
}

const NEUTRAL: FateGaugeReading = { gauge: 0, blessings: [], done: 0, expected: 0, sealed: false };

interface Seal extends Omit<FateGaugeReading, 'sealed'> {
  readonly day: string;
}

async function readSeal({ keyValueStore }: PreferenceDependencies): Promise<Seal | null> {
  try {
    return JSON.parse((await keyValueStore.get(GAUGE_SEAL_KEY)) ?? 'null') as Seal | null;
  } catch {
    return null;
  }
}

/**
 * Cas d'usage : la jauge du jour (P22 à P25). Scellée aujourd'hui, elle ne change plus ; sinon elle
 * se calcule sur hier, comme le rappel d'hier (suivis du lundi de la semaine d'hier jusqu'à hier,
 * habitudes attendues, difficulté de la semaine d'hier). Un scellement d'un autre jour est ignoré.
 * Une lecture en échec donne une jauge Neutre : l'ascension se lance toujours (P28).
 */
export async function getFateGauge(dependencies: FateGaugeDependencies): Promise<FateGaugeReading> {
  const { clock, unitOfWork } = dependencies;
  const today = clock.today();
  const seal = await readSeal(dependencies);
  if (seal?.day === today.toIsoString()) {
    const { day: _day, ...reading } = seal;
    return { ...reading, sealed: true };
  }
  try {
    return await unitOfWork.run(async ({ habits, checkIns, settingsChanges }) => {
      const yesterday = today.plusDays(-1);
      const week = Week.containing(yesterday);
      const weekCheckIns = await checkIns.listBetween(week.start, yesterday);
      const changes = await settingsChanges.listAll();
      const expected = expectedHabitsOn(yesterday, await habits.listAll(), weekCheckIns, changes);
      const done = expected.filter((habit) =>
        weekCheckIns.some(
          (checkIn) =>
            checkIn.done && checkIn.habitId === habit.id && checkIn.day.equals(yesterday),
        ),
      );
      const doneHabits = done.map((habit) => ({
        name: habit.name.value,
        createdOn: habit.createdOn,
        difficulty: weekSettingsOf(
          changes.filter((change) => change.habitId === habit.id),
          week,
          habit.createdOn,
        ).difficulty,
      }));
      return {
        gauge: fateGauge(done.length, expected.length),
        blessings: blessingRarities(doneHabits),
        done: done.length,
        expected: expected.length,
        sealed: false,
      };
    });
  } catch {
    return NEUTRAL;
  }
}

/** Cas d'usage : scelle la jauge pour aujourd'hui, au lancement de la 1re ascension du jour. */
export async function sealFateGauge(
  dependencies: FateGaugeDependencies,
  reading: FateGaugeReading,
): Promise<void> {
  if (reading.sealed) return;
  const { sealed: _sealed, ...rest } = reading;
  const seal: Seal = { day: dependencies.clock.today().toIsoString(), ...rest };
  await dependencies.keyValueStore.set(GAUGE_SEAL_KEY, JSON.stringify(seal));
}
