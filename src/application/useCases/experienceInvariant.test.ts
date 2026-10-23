import { Day } from '../../domain/day/Day';
import { DIFFICULTIES, type Difficulty } from '../../domain/habit/Difficulty';
import { experienceInvariant } from '../testing/experienceInvariant';
import { InMemoryUnitOfWork } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { deleteHabit } from './deleteHabit';
import { toggleCheckIn } from './toggleCheckIn';
import { updateHabit } from './updateHabit';

/** Générateur pseudo-aléatoire déterministe (LCG), pour des séquences reproductibles. */
const random = (seed: number) => {
  let state = seed;
  return (below: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % below;
  };
};

const NAMES = ['Cuisiner', 'Budget du jour', 'Courir 5 km', 'Lire 20 pages'];

describe('invariant of the experience (ADR 0003)', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'keeps xp = Σ check-ins « fait » at the difficulty of their week + retained, through every use case (seed %p)',
    async (seed) => {
      const next = random(seed);
      const unitOfWork = new InMemoryUnitOfWork();
      const clock = settableClock(Day.of(2026, 10, 5));
      const deps = { clock, unitOfWork };
      const pick = <T>(values: readonly T[]): T => values[next(values.length)] as T;
      const existing = () => unitOfWork.run(({ habits }) => habits.listAll());

      for (let step = 0; step < 120; step += 1) {
        const habits = await existing();
        const action = next(16);
        if (action === 0) {
          // Minuit, ou un fuseau vers l'est.
          clock.setToday(clock.today().plusDays(1 + next(3)));
        } else if (action === 1) {
          // Recul d'horloge ou fuseau vers l'ouest : des suivis « fait » deviennent futurs.
          clock.setToday(clock.today().plusDays(-1 - next(2)));
        } else if (action <= 3 || habits.length === 0) {
          await createHabit(deps, pick(NAMES), pick<Difficulty>(DIFFICULTIES));
        } else if (action <= 6) {
          const habit = pick(habits);
          await updateHabit(deps, habit.id, {
            name: next(4) === 0 ? pick(NAMES) : habit.name.value,
            difficulty: pick<Difficulty>(DIFFICULTIES),
          });
        } else if (action === 7) {
          await deleteHabit(deps, pick(habits).id);
        } else {
          await toggleCheckIn(deps, pick(habits).id, clock.today().plusDays(-next(10)));
        }

        const { xp, expected } = await experienceInvariant(unitOfWork);
        expect(xp).toBe(expected);
      }
    },
  );
});
