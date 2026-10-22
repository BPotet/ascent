import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Keyboard, Platform } from 'react-native';

import { Day } from '../../../domain/day/Day';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import type { WeeklyTarget } from '../../../domain/habit/WeeklyTarget';
import type { CreateHabitOutcome } from '../state/useCreateHabit';
import { NewHabitSheet } from './NewHabitSheet';

const nbsp = '\u00A0';
const wednesday = Day.of(2026, 10, 14);
const cooking = new Habit(1, HabitName.parse('Cuisiner'), wednesday);

function created(name: string): CreateHabitOutcome {
  return { ok: true, habit: new Habit(2, HabitName.parse(name), wednesday) };
}

async function open(
  create: (
    name: string,
    difficulty: Difficulty,
    weeklyTarget: WeeklyTarget,
  ) => Promise<CreateHabitOutcome> = async (name) => created(name),
) {
  const onCreate = jest.fn(create);
  const onCreated = jest.fn();
  const onClose = jest.fn();
  await render(
    <NewHabitSheet
      habits={[cooking]}
      onCreate={onCreate}
      onCreated={onCreated}
      onClose={onClose}
    />,
  );
  return { onCreate, onCreated, onClose };
}

const field = () => screen.getByLabelText('Nom de l’habitude');
const createButton = () => screen.getByRole('button', { name: 'Créer l’habitude' });
const type = (text: string) => fireEvent.changeText(field(), text);
const option = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name},`, 'u') });

describe('NewHabitSheet', () => {
  // Le premier rendu charge et transforme les modules de React Native du panneau (Modal, clavier) :
  // sans cache (bac à sable de StrykerJS), cela dépasse le délai d'un test. On le fait une fois ici.
  beforeAll(async () => {
    await open();
    screen.unmount();
  }, 60_000);

  it('opens with an empty name field, focused, and the create button disabled', async () => {
    await open();

    expect(screen.getByRole('header', { name: 'Nouvelle habitude' })).toBeOnTheScreen();
    expect(field()).toHaveProp('autoFocus', true);
    expect(field()).toHaveProp('placeholder', 'Ex. Cuisiner');
    expect(field()).toHaveDisplayValue('');
    expect(screen.getByText('0/40')).toBeOnTheScreen();
    expect(createButton()).toBeDisabled();
  });

  it('does not cut the name with a native maximum length', async () => {
    await open();

    expect(field()).not.toHaveProp('maxLength', expect.anything());
  });

  it.each(['', ' ', '   ', ' \t'])('keeps the create button disabled for %p', async (text) => {
    await open();

    await type(text);

    expect(createButton()).toBeDisabled();
    expect(screen.getByText('0/40')).toBeOnTheScreen();
  });

  it('counts the characters of the cleaned name, an emoji counting as one', async () => {
    await open();

    await type('  Lire   20 minutes 📚 ');

    expect(screen.getByText('17/40')).toBeOnTheScreen();
    expect(screen.getByLabelText('17 caractères sur 40')).toBeOnTheScreen();
    expect(createButton()).toBeEnabled();
  });

  it('creates the habit with the name as typed, then reports it', async () => {
    const { onCreate, onCreated, onClose } = await open();

    await type('Lire 20 minutes');
    await fireEvent.press(createButton());

    expect(onCreate).toHaveBeenCalledWith('Lire 20 minutes', 'medium', 7);
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('creates the habit from the keyboard', async () => {
    const { onCreate } = await open();

    await type('Méditer');
    await fireEvent(field(), 'submitEditing');

    expect(onCreate).toHaveBeenCalledWith('Méditer', 'medium', 7);
  });

  describe('the block « Difficulté » (E2)', () => {
    it('offers the three difficulties with what a check-in brings, « Moyenne » preselected', async () => {
      await open();

      expect(screen.getByTestId('difficulty-picker')).toHaveAccessibleName('Difficulté');
      expect(screen.getByTestId('difficulty-option-easy')).toHaveTextContent('Facile+5 XP');
      expect(screen.getByTestId('difficulty-option-medium')).toHaveTextContent('Moyenne+10 XP');
      expect(screen.getByTestId('difficulty-option-hard')).toHaveTextContent('Difficile+20 XP');
      expect(option('Moyenne')).toBeChecked();
      expect(option('Facile')).not.toBeChecked();
      expect(option('Difficile')).not.toBeChecked();
    });

    it('creates the habit with the difficulty chosen', async () => {
      const { onCreate } = await open();

      await fireEvent.press(option('Difficile'));
      await type('Courir 5 km');
      await fireEvent.press(createButton());

      expect(option('Difficile')).toBeChecked();
      expect(onCreate).toHaveBeenCalledWith('Courir 5 km', 'hard', 7);
    });

    it('creates with the settings shown when the keyboard validates (↵)', async () => {
      const { onCreate } = await open();

      await type('Méditer 10 minutes');
      await fireEvent.press(option('Facile'));
      await fireEvent(field(), 'submitEditing');

      expect(onCreate).toHaveBeenCalledWith('Méditer 10 minutes', 'easy', 7);
    });

    it('does not enable the creation by choosing a difficulty without a name', async () => {
      const { onCreate } = await open();

      await fireEvent.press(option('Difficile'));

      expect(createButton()).toBeDisabled();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('keeps the difficulty chosen after a duplicate', async () => {
      const { onCreate } = await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

      await fireEvent.press(option('Facile'));
      await type('cuisiner');
      await fireEvent.press(createButton());

      expect(screen.getByRole('alert', { name: /^Tu as déjà une habitude/u })).toBeOnTheScreen();
      expect(option('Facile')).toBeChecked();
      await type('Cuisiner maison');
      await fireEvent.press(createButton());
      expect(onCreate).toHaveBeenLastCalledWith('Cuisiner maison', 'easy', 7);
    });

    it('keeps the difficulty chosen after a failed save, and retries with it', async () => {
      let attempts = 0;
      const { onCreate } = await open(async (name) => {
        attempts += 1;
        return attempts === 1 ? { ok: false, reason: 'saveFailed' } : created(name);
      });

      await fireEvent.press(option('Difficile'));
      await type('Courir 5 km');
      await fireEvent.press(createButton());

      expect(
        screen.getByRole('alert', { name: 'L’habitude n’a pas pu être créée. Réessaie.' }),
      ).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      await fireEvent.press(createButton());
      expect(onCreate).toHaveBeenNthCalledWith(2, 'Courir 5 km', 'hard', 7);
    });

    it('announces no change of the week: there is no week to re-evaluate yet', async () => {
      await open();

      await fireEvent.press(option('Difficile'));

      expect(screen.queryByTestId('difficulty-change-info')).not.toBeOnTheScreen();
    });
  });

  describe('the block « Objectif » (E2)', () => {
    const target = (value: number) => screen.getByTestId(`weekly-target-option-${value}`);

    it('offers the targets 1 to 7, « Tous les jours » (7) preselected', async () => {
      await open();

      expect(screen.getByTestId('weekly-target-picker')).toHaveAccessibleName(
        'Objectif hebdomadaire',
      );
      expect(screen.getAllByTestId(/^weekly-target-option-/u)).toHaveLength(7);
      expect(target(7)).toBeChecked();
      expect(target(3)).not.toBeChecked();
      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('Tous les jours');
    });

    it('creates the habit « Tous les jours » when the keyboard validates (↵) at once', async () => {
      const { onCreate } = await open();

      await type('Boire de l’eau');
      await fireEvent(field(), 'submitEditing');

      expect(onCreate).toHaveBeenCalledWith('Boire de l’eau', 'medium', 7);
    });

    it('creates the habit with the target chosen, said in words', async () => {
      const { onCreate } = await open();

      await fireEvent.press(target(3));
      await type('Courir 5 km');
      await fireEvent.press(createButton());

      expect(screen.getByTestId('weekly-target-phrase')).toHaveTextContent('3 fois par semaine');
      expect(onCreate).toHaveBeenCalledWith('Courir 5 km', 'medium', 3);
    });

    it('keeps the settings chosen after a duplicate', async () => {
      const { onCreate } = await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

      await fireEvent.press(target(3));
      await fireEvent.press(option('Difficile'));
      await type('cuisiner');
      await fireEvent.press(createButton());

      expect(target(3)).toBeChecked();
      await type('Cuisiner maison');
      await fireEvent.press(createButton());
      expect(onCreate).toHaveBeenLastCalledWith('Cuisiner maison', 'hard', 3);
    });

    it('announces no change of target: it applies from the day of creation', async () => {
      await open();

      await fireEvent.press(target(3));

      expect(screen.queryByTestId('weekly-target-change-info')).not.toBeOnTheScreen();
    });
  });

  it('does not create from the keyboard while the name is empty', async () => {
    const { onCreate } = await open();

    await type('  ');
    await fireEvent(field(), 'submitEditing');

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('accepts a name of 40 characters', async () => {
    await open();

    await type('a'.repeat(40));

    expect(screen.getByText('40/40')).toBeOnTheScreen();
    expect(createButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('counts a pasted decomposed accent as one character (NFC)', async () => {
    await open();

    await type('é'.repeat(40));

    expect(screen.getByText('40/40')).toBeOnTheScreen();
    expect(createButton()).toBeEnabled();
  });

  it('counts a composed emoji as its code points, like the rule (ADR 0002)', async () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    await open();

    await type(`${'a'.repeat(35)}${family}`);
    expect(screen.getByText('40/40')).toBeOnTheScreen();
    expect(createButton()).toBeEnabled();

    await type(`${'a'.repeat(36)}${family}`);
    expect(screen.getByText('41/40')).toBeOnTheScreen();
    expect(createButton()).toBeDisabled();
  });

  it('keeps a pasted name of 41 characters and explains the limit', async () => {
    const { onCreate } = await open();

    await type('é'.repeat(41));

    expect(field()).toHaveDisplayValue('é'.repeat(41));
    expect(screen.getByText('41/40')).toBeOnTheScreen();
    expect(
      screen.getByRole('alert', { name: 'Le nom compte 40 caractères au plus.' }),
    ).toBeOnTheScreen();
    expect(createButton()).toBeDisabled();
    await fireEvent(field(), 'submitEditing');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('refuses a duplicate, names the existing habit, and keeps the name typed', async () => {
    const { onCreated } = await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

    await type('cuisiner  ');
    await fireEvent.press(createButton());

    expect(
      screen.getByRole('alert', { name: `Tu as déjà une habitude «${nbsp}Cuisiner${nbsp}».` }),
    ).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `Tu as déjà une habitude «${nbsp}Cuisiner${nbsp}».`,
    );
    expect(field()).toHaveDisplayValue('cuisiner  ');
    expect(createButton()).toBeDisabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('announces nothing while the name is valid', async () => {
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    await open();

    await type('Méditer');

    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it('clears a refusal as soon as the name changes', async () => {
    await open(async () => ({ ok: false, reason: 'duplicate' }) as const);
    await type('cuisiner');
    await fireEvent.press(createButton());

    await type('cuisiner maison');

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    expect(createButton()).toBeEnabled();
  });

  it.each([
    ['empty', 'Le nom ne peut pas être vide.'],
    ['tooLong', 'Le nom compte 40 caractères au plus.'],
    ['limit', '10 habitudes au plus. Supprime une habitude pour en ajouter une.'],
  ] as const)('explains a refusal « %s »', async (reason, message) => {
    await open(async () => ({ ok: false, reason }) as const);

    await type('Méditer');
    await fireEvent.press(createButton());

    expect(screen.getByRole('alert', { name: message })).toBeOnTheScreen();
  });

  it('names the typed habit when the duplicate is not in the list', async () => {
    await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

    await type('  Lire   ');
    await fireEvent.press(createButton());

    expect(
      screen.getByRole('alert', { name: `Tu as déjà une habitude «${nbsp}Lire${nbsp}».` }),
    ).toBeOnTheScreen();
  });

  it('keeps the name typed when the habit cannot be saved, and lets the player retry', async () => {
    let attempts = 0;
    const { onCreate, onCreated } = await open(async (name) => {
      attempts += 1;
      return attempts === 1 ? { ok: false, reason: 'saveFailed' } : created(name);
    });

    await type('Méditer');
    await fireEvent.press(createButton());

    expect(
      screen.getByRole('alert', { name: 'L’habitude n’a pas pu être créée. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(field()).toHaveDisplayValue('Méditer');
    expect(onCreated).not.toHaveBeenCalled();

    await fireEvent.press(createButton());
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('cannot create twice while the first creation is in progress', async () => {
    let finish: (outcome: CreateHabitOutcome) => void = () => undefined;
    const { onCreate } = await open(
      () =>
        new Promise<CreateHabitOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    await type('Méditer');

    await fireEvent.press(createButton());
    expect(createButton()).toBeDisabled();
    await fireEvent(field(), 'submitEditing');
    await act(async () => finish(created('Méditer')));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('closes without creating, with « Annuler » or by touching outside', async () => {
    const { onCreate, onClose } = await open();
    await type('Méditer');

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await fireEvent.press(screen.getByTestId('new-habit-scrim', { includeHiddenElements: true }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('keeps the outside of the sheet out of reach of the screen reader', async () => {
    await open();

    expect(screen.getByTestId('new-habit-scrim', { includeHiddenElements: true })).toHaveProp(
      'accessible',
      false,
    );
  });

  it('closes with the back button of the phone', async () => {
    const { onClose } = await open();

    await fireEvent(screen.getByTestId('new-habit-sheet'), 'requestClose');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers touch targets of at least 44 points', async () => {
    await open();

    expect(createButton()).toHaveStyle({ minHeight: 52 });
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveStyle({ minHeight: 52 });
    expect(field()).toHaveStyle({ height: 52 });
  });

  it('slides in, unless the player asked to reduce motion', async () => {
    await open();
    expect(screen.getByTestId('new-habit-sheet')).toHaveProp('animationType', 'slide');
  });

  it('appears without animation when the player asked to reduce motion', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);

    await open();

    await waitFor(() =>
      expect(screen.getByTestId('new-habit-sheet')).toHaveProp('animationType', 'none'),
    );
  });

  describe('with the keyboard open', () => {
    function spyOnKeyboard() {
      const listeners: { event: string; listener: (event?: unknown) => void }[] = [];
      jest.spyOn(Keyboard, 'addListener').mockImplementation(((
        event: string,
        listener: (event?: unknown) => void,
      ) => {
        listeners.push({ event, listener });
        return { remove: jest.fn() };
      }) as never);
      return (event: string) =>
        act(() => {
          for (const entry of listeners.filter((candidate) => candidate.event === event)) {
            entry.listener(undefined);
          }
        });
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      ['ios', 'keyboardWillShow', 'keyboardWillHide'],
      ['android', 'keyboardDidShow', 'keyboardDidHide'],
    ] as const)(
      'keeps the counter, the messages and the buttons above the keyboard on %s',
      async (os, showEvent, hideEvent) => {
        jest.replaceProperty(Platform, 'OS', os);
        const emit = spyOnKeyboard();
        await open();
        const avoiding = screen.getByTestId('new-habit-keyboard-avoiding');
        const sheet = screen.getByTestId('new-habit-sheet-content');

        // « padding » : the whole sheet is pushed up by the height of the keyboard.
        expect(avoiding).toHaveStyle({ paddingBottom: 0 });
        expect(sheet).toHaveStyle({ paddingBottom: 36 });

        await emit(showEvent);
        expect(sheet).toHaveStyle({ paddingBottom: 16 });
        expect(within(sheet).getByText('0/40')).toBeOnTheScreen();
        expect(within(sheet).getByRole('button', { name: 'Créer l’habitude' })).toBeOnTheScreen();

        await emit(hideEvent);
        expect(sheet).toHaveStyle({ paddingBottom: 36 });
      },
    );
  });
});
