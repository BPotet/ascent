// Le Serment au Camp (#237, maquette 232 : parcours D, S1 à S7, S14) : prêté dans la fiche d'un
// pouvoir débloqué de 2 Élan ou plus, il porte le chaînon sur son nœud et compte dès demain.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { OATHS_KEY } from '../../../application/useCases/oaths';
import type { PowerKind } from '../../../domain/battle/powers';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { PowerTreeScreen } from './PowerTreeScreen';

reduceMotionInEachTest();

/** L'arbre de la Sentinelle, Représailles et Tenir bon débloqués, le 27 octobre 2026. */
async function show({
  habits = ['Courir 20 minutes', 'Lire 10 pages'],
  oaths,
  doneYesterday = [],
}: {
  habits?: readonly string[];
  oaths?: unknown;
  doneYesterday?: readonly string[];
} = {}) {
  const setUp = ascentSetUp({ shards: 20, powers: ['retaliation', 'holdFast'] });
  const { unitOfWork } = setUp.dependencies;
  for (const name of habits) {
    await unitOfWork.run(async ({ habits: repository, checkIns }) => {
      const habit = await repository.add(HabitName.parse(name), Day.of(2026, 10, 1));
      if (doneYesterday.includes(name)) {
        await checkIns.save({
          habitId: habit.id,
          day: Day.of(2026, 10, 26),
          done: true,
          corrected: false,
        });
      }
    });
  }
  if (oaths !== undefined) {
    setUp.keyValueStore.values.set(OATHS_KEY, JSON.stringify({ version: 1, oaths }));
  }
  await setUp.session.load();
  const onGoToDay = jest.fn();
  await renderScreen(
    <PowerTreeScreen camp={setUp.camp} hero="sentinel" onLeave={jest.fn()} onGoToDay={onGoToDay} />,
    setUp.dependencies,
  );
  await screen.findByTestId('power-tree');
  await act(async () => undefined);
  return { ...setUp, onGoToDay };
}

const node = (code: PowerKind) => screen.getByTestId(`power-node-${code}`);
const hiddenToo = { includeHiddenElements: true } as const;

async function openSheet(code: PowerKind) {
  await fireEvent.press(node(code));
  return within(await screen.findByTestId('power-sheet'));
}

async function swearOn(name: string) {
  const sheet = await openSheet('retaliation');
  await fireEvent.press(sheet.getByRole('button', { name: /Prêter serment/ }));
  await fireEvent.press(await screen.findByRole('radio', { name }));
  await fireEvent.press(screen.getByTestId('oath-swear'));
}

describe('PowerTreeScreen: the Oath (#237)', () => {
  it('binds « Courir » to Retaliation, says it counts from tomorrow, and links the node (S4, S7)', async () => {
    const { keyValueStore, campSound, campHaptics } = await show();
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
    announce.mockClear();

    await swearOn('Courir 20 minutes');

    const frame = await screen.findByTestId('oath-frame');
    expect(within(frame).getByText('« Courir 20 minutes »')).toBeOnTheScreen();
    expect(frame.props.accessibilityLabel).toMatch(/Le Serment compte dès demain/u);
    expect(announce).toHaveBeenCalledWith(
      "Serment prêté : Courir 20 minutes. Représailles sera attisé demain si tu la fais aujourd'hui.",
    );
    expect(campSound.played).toEqual(['seal']);
    expect(campHaptics.successes()).toBe(1);
    expect(JSON.parse(keyValueStore.values.get(OATHS_KEY)!)).toEqual({
      version: 1,
      oaths: [{ power: 'retaliation', habit: 1, since: '2026-10-27' }],
    });
    expect(screen.getByTestId('power-node-oath-retaliation', hiddenToo)).toBeOnTheScreen();
  });

  it('offers no Oath on the Bulwark nor on a power not unlocked (S6)', async () => {
    await show();

    const bulwark = await openSheet('bulwark');
    expect(
      bulwark.getByText('Le Serment se prête sur un pouvoir de 2 Élan ou plus.'),
    ).toBeOnTheScreen();
    expect(bulwark.queryByRole('button', { name: /Prêter serment/ })).not.toBeOnTheScreen();
    await fireEvent.press(bulwark.getByRole('button', { name: 'Fermer' }));

    await fireEvent.press(screen.getByRole('tab', { name: /Errante/ }));
    const mist = await openSheet('mist');
    expect(mist.queryByText('Serment')).not.toBeOnTheScreen();
    await fireEvent.press(mist.getByRole('button', { name: 'Fermer' }));
    const shadowStep = await openSheet('shadowStep');
    expect(shadowStep.getByRole('button', { name: /Prêter serment/ })).toBeOnTheScreen();
  });

  it('shows a habit already bound to another power (S2)', async () => {
    await show({ oaths: [{ power: 'holdFast', habit: 1, since: '2026-10-01' }] });

    const sheet = await openSheet('retaliation');
    await fireEvent.press(sheet.getByRole('button', { name: /Prêter serment/ }));

    expect(
      await screen.findByRole('radio', { name: 'Courir 20 minutes, déjà liée à Tenir bon' }),
    ).toBeDisabled();
  });

  it('says to create a habit first when there is none (S3)', async () => {
    const { onGoToDay } = await show({ habits: [] });

    const sheet = await openSheet('retaliation');
    await fireEvent.press(sheet.getByRole('button', { name: /Prêter serment/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Aller à la Journée' }));

    expect(onGoToDay).toHaveBeenCalled();
  });

  it('keeps no Oath when it cannot be saved, and lets the player try again', async () => {
    const { keyValueStore } = await show();
    keyValueStore.failWrites();

    await swearOn('Courir 20 minutes');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le Serment n'a pas pu être enregistré. Réessaie.",
    );
    expect(screen.queryByTestId('power-node-oath-retaliation', hiddenToo)).not.toBeOnTheScreen();
    keyValueStore.failWrites(false);
    await fireEvent.press(screen.getByTestId('oath-swear'));
    expect(await screen.findByTestId('oath-frame')).toBeOnTheScreen();
  });

  it('shows the Oath kindled the day after, when the habit was done yesterday (S5)', async () => {
    await show({
      oaths: [{ power: 'retaliation', habit: 1, since: '2026-10-25' }],
      doneYesterday: ['Courir 20 minutes'],
    });

    const sheet = await openSheet('retaliation');
    expect(await sheet.findByText('Attisé')).toBeOnTheScreen();
    expect(sheet.getByText('2 → 1 Élan')).toBeOnTheScreen();
  });

  it('says the Oath is broken once its habit is deleted (S14)', async () => {
    await show({
      habits: ['Lire 10 pages'],
      oaths: [{ power: 'retaliation', habit: 9, since: '2026-10-25' }],
    });

    expect(screen.queryByTestId('power-node-oath-retaliation', hiddenToo)).not.toBeOnTheScreen();
    const sheet = await openSheet('retaliation');
    expect(sheet.getByText('Serment rompu')).toBeOnTheScreen();
  });
});

describe('PowerTreeScreen: an Oath being saved, or habits not read (#237)', () => {
  it('keeps the choice open, the button busy, on a double tap while the Oath is saved', async () => {
    const { keyValueStore } = await show();
    const set = keyValueStore.set;
    let release: () => void = () => undefined;
    let writes = 0;
    keyValueStore.set = async (key, value) => {
      if (key === OATHS_KEY) {
        writes += 1;
        await new Promise<void>((resolve) => (release = resolve));
      }
      return set(key, value);
    };

    await swearOn('Courir 20 minutes');
    await fireEvent.press(screen.getByTestId('oath-swear'));

    expect(screen.getByTestId('oath-picker')).toBeOnTheScreen();
    expect(screen.getByTestId('oath-swear')).toBeDisabled();
    expect(screen.getByTestId('oath-swear')).toHaveProp(
      'accessibilityLabel',
      'Prêter serment, en cours',
    );
    await act(async () => release());
    expect(await screen.findByTestId('oath-frame')).toBeOnTheScreen();
    expect(writes).toBe(1);
  });

  it('shows no empty habit name while the habits cannot be read', async () => {
    const setUp = ascentSetUp({ shards: 20, powers: ['retaliation'] });
    setUp.keyValueStore.values.set(
      OATHS_KEY,
      JSON.stringify({
        version: 1,
        oaths: [{ power: 'retaliation', habit: 1, since: '2026-10-01' }],
      }),
    );
    (setUp.dependencies.unitOfWork as InMemoryUnitOfWork).failReads();
    await setUp.session.load();
    await renderScreen(
      <PowerTreeScreen camp={setUp.camp} hero="sentinel" onLeave={jest.fn()} />,
      setUp.dependencies,
    );
    await screen.findByTestId('power-tree');
    await act(async () => undefined);

    const sheet = await openSheet('retaliation');
    expect(sheet.queryByText(/« »|«  »/u)).not.toBeOnTheScreen();
    expect(sheet.queryByTestId('oath-frame')).not.toBeOnTheScreen();
  });
});
