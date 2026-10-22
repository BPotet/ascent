import { Day } from '../../domain/day/Day';
import { HabitName } from '../../domain/habit/HabitName';
import type { KeyValueStore } from '../ports/KeyValueStore';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { createHabit } from './createHabit';
import { deleteHabit } from './deleteHabit';
import { introduceWeeklyTarget } from './introduceWeeklyTarget';
import { dismissWhatsNewCard, getWhatsNewCard, WHATS_NEW_CARD_DISMISSED_KEY } from './whatsNewCard';

function mapStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

const monday5 = Day.of(2026, 10, 5);
const wednesday14 = Day.of(2026, 10, 14);

describe('Carte de nouveauté (WhatsNewCard)', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let keyValueStore: ReturnType<typeof mapStore>;
  const clock = settableClock(wednesday14);
  const deps = () => ({ clock, unitOfWork, keyValueStore });

  /** Une habitude d'avant la mise à jour, puis le changement d'introduction. */
  async function existingHabit(name: string): Promise<number> {
    const habit = await unitOfWork.run(({ habits }) => habits.add(HabitName.parse(name), monday5));
    await unitOfWork.addSettingsChangeBeforeWeeklyTarget(habit.id, monday5);
    await introduceWeeklyTarget(deps());
    return habit.id;
  }

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    keyValueStore = mapStore();
    clock.setToday(wednesday14);
  });

  it('is not shown at the first install, without any habit', async () => {
    await expect(getWhatsNewCard(deps())).resolves.toBe(false);
  });

  it('is not shown when every habit was created after the update', async () => {
    await createHabit(deps(), 'Lire');

    await expect(getWhatsNewCard(deps())).resolves.toBe(false);
  });

  it('is shown when a habit existed before the update', async () => {
    await existingHabit('Cuisiner');
    await createHabit(deps(), 'Lire');

    await expect(getWhatsNewCard(deps())).resolves.toBe(true);
  });

  it('is never shown again once dismissed, even after a restart', async () => {
    await existingHabit('Cuisiner');

    await dismissWhatsNewCard(deps());

    expect(keyValueStore.values).toEqual(new Map([[WHATS_NEW_CARD_DISMISSED_KEY, 'true']]));
    await expect(getWhatsNewCard(deps())).resolves.toBe(false);
    await expect(
      getWhatsNewCard({ ...deps(), unitOfWork: new InMemoryUnitOfWork() }),
    ).resolves.toBe(false);
  });

  it('does not read the habits once dismissed', async () => {
    await dismissWhatsNewCard(deps());
    unitOfWork.failReads();

    await expect(getWhatsNewCard(deps())).resolves.toBe(false);
  });

  it('is not shown once the habits that existed before the update are all deleted', async () => {
    const cooking = await existingHabit('Cuisiner');
    await createHabit(deps(), 'Lire');

    await deleteHabit(deps(), cooking);

    await expect(getWhatsNewCard(deps())).resolves.toBe(false);
  });

  it('lets a storage failure through', async () => {
    unitOfWork.failReads();

    await expect(getWhatsNewCard(deps())).rejects.toThrow(StorageUnavailableError);
  });
});
