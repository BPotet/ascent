import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import type { Difficulty } from '../../../domain/habit/Difficulty';
import type { UpdateHabitInput } from '../../../application/useCases/updateHabit';
import type { UpdateHabitOutcome } from '../state/useEditHabit';
import { EditHabitSheet } from './EditHabitSheet';

const nbsp = ' ';
const monday = Day.of(2026, 10, 5);
const cooking = new Habit(1, HabitName.parse('Cuisiner'), monday);
const budget = new Habit(2, HabitName.parse('Budget du jour'), Day.of(2026, 10, 12));

function updated({ name, difficulty }: UpdateHabitInput): UpdateHabitOutcome {
  return {
    ok: true,
    habit: new Habit(1, HabitName.parse(name), monday),
    weekSettings: { difficulty: difficulty ?? 'medium' },
    nameChanged: name.trim() !== 'Cuisiner',
    settingsChanged: difficulty !== undefined,
    xpChange: 0,
    xp: 0,
  };
}

async function open(
  save: (input: UpdateHabitInput) => Promise<UpdateHabitOutcome> = async (input) => updated(input),
  deleteAlert: string | null = null,
  difficulty: Difficulty = 'medium',
) {
  const props = {
    onSave: jest.fn(save),
    onSaved: jest.fn(),
    onGone: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
  };
  await render(
    <EditHabitSheet
      habit={cooking}
      difficulty={difficulty}
      habits={[cooking, budget]}
      deleteAlert={deleteAlert}
      {...props}
    />,
  );
  return props;
}

const field = () => screen.getByLabelText('Nom de l’habitude');
const saveButton = () => screen.getByRole('button', { name: 'Enregistrer' });
const type = (text: string) => fireEvent.changeText(field(), text);
const option = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name},`, 'u') });
const info = () => screen.queryByTestId('difficulty-change-info');

describe('EditHabitSheet', () => {
  // Le premier rendu charge les modules du panneau (Modal, clavier) : une fois, avec plus de temps.
  beforeAll(async () => {
    await open();
    screen.unmount();
  }, 60_000);

  it('opens « Modifier l’habitude » with the name, without keyboard, saving disabled', async () => {
    await open();

    expect(screen.getByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
    expect(field()).toHaveDisplayValue('Cuisiner');
    expect(field()).toHaveProp('autoFocus', false);
    expect(screen.getByText('8/40')).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Supprimer l’habitude' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('signals the deletion otherwise than by its color: an icon and a hint', async () => {
    await open();

    const remove = screen.getByRole('button', { name: 'Supprimer l’habitude' });
    expect(remove).toHaveProp(
      'accessibilityHint',
      'Demande une confirmation avant de supprimer définitivement l’habitude.',
    );
    expect(screen.getByTestId('trash-glyph', { includeHiddenElements: true })).toBeTruthy();
  });

  it.each(['Cuisiner', '  Cuisiner ', 'Cuisiner​'])(
    'keeps saving disabled while the cleaned name has not changed (%p)',
    async (text) => {
      const { onSave } = await open();

      await type(text);
      await fireEvent(field(), 'submitEditing');

      expect(saveButton()).toBeDisabled();
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('renames the habit, keeping its difficulty, and passes it on', async () => {
    const { onSave, onSaved } = await open();

    await type('Cuisiner maison');
    await fireEvent.press(saveButton());

    expect(onSave).toHaveBeenCalledWith({ name: 'Cuisiner maison' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ ok: true, nameChanged: true }));
    expect(onSaved.mock.calls[0]?.[0].habit.name.value).toBe('Cuisiner maison');
  });

  it('lets the player change only the capital letters', async () => {
    const { onSave } = await open();

    await type('CUISINER');

    expect(saveButton()).toBeEnabled();
    await fireEvent.press(saveButton());
    expect(onSave).toHaveBeenCalledWith({ name: 'CUISINER' });
  });

  it('explains an emptied name and disables saving', async () => {
    const { onSave } = await open();

    await type('   ');

    expect(screen.getByRole('alert', { name: 'Le nom ne peut pas être vide.' })).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Le nom ne peut pas être vide.',
    );
    expect(screen.getByText('0/40')).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a pasted name of 41 characters and explains the limit', async () => {
    const { onSave } = await open();

    await type('é'.repeat(41));

    expect(field()).toHaveDisplayValue('é'.repeat(41));
    expect(screen.getByText('41/40')).toBeOnTheScreen();
    expect(
      screen.getByRole('alert', { name: 'Le nom compte 40 caractères au plus.' }),
    ).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('refuses the name of another habit, names it, and keeps the name typed', async () => {
    const { onSaved } = await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

    await type('budget du jour');
    await fireEvent.press(saveButton());

    expect(
      screen.getByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Budget du jour${nbsp}».`,
      }),
    ).toBeOnTheScreen();
    expect(field()).toHaveDisplayValue('budget du jour');
    expect(saveButton()).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('keeps the name typed when it cannot be saved, and lets the player retry', async () => {
    let attempts = 0;
    const { onSave, onSaved } = await open(async (input) => {
      attempts += 1;
      return attempts === 1 ? { ok: false, reason: 'saveFailed' } : updated(input);
    });

    await type('Cuisiner maison');
    await fireEvent.press(saveButton());

    expect(
      screen.getByRole('alert', {
        name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
      }),
    ).toBeOnTheScreen();
    expect(field()).toHaveDisplayValue('Cuisiner maison');
    expect(onSaved).not.toHaveBeenCalled();

    await fireEvent.press(saveButton());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('cannot rename twice while the first renaming is being saved (double tap)', async () => {
    let finish: (outcome: UpdateHabitOutcome) => void = () => undefined;
    const { onSave, onSaved } = await open(
      () =>
        new Promise<UpdateHabitOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    await type('Cuisiner maison');

    await fireEvent.press(saveButton());
    expect(saveButton()).toBeDisabled();
    await fireEvent.press(saveButton());
    await fireEvent(field(), 'submitEditing');
    await act(async () => finish(updated({ name: 'Cuisiner maison' })));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('tells the screen when the habit no longer exists', async () => {
    const { onGone, onSaved } = await open(
      async () => ({ ok: false, reason: 'unknownHabit' }) as const,
    );

    await type('Cuisiner maison');
    await fireEvent.press(saveButton());

    expect(onGone).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  describe('the block « Difficulté » (E7)', () => {
    it.each(['easy', 'medium', 'hard'] as const)(
      'is prefilled with the difficulty of the current week (%s), without message',
      async (difficulty) => {
        await open(undefined, null, difficulty);

        expect(screen.getByTestId('difficulty-picker')).toHaveAccessibleName('Difficulté');
        expect(screen.getByTestId(`difficulty-option-${difficulty}`)).toBeChecked();
        expect(saveButton()).toBeDisabled();
        expect(info()).not.toBeOnTheScreen();
      },
    );

    it('says the whole current week is re-evaluated when the difficulty changes, and enables saving', async () => {
      await open();

      await fireEvent.press(option('Difficile'));

      const message =
        'S’applique à toute cette semaine : les suivis de la semaine rapporteront +20 XP. Les semaines passées ne changent pas.';
      expect(screen.getByText(message)).toBeOnTheScreen();
      expect(info()).toHaveAccessibleName(message);
      expect(info()).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(message);
      expect(screen.getByTestId('info-glyph', { includeHiddenElements: true })).toBeTruthy();
      expect(saveButton()).toBeEnabled();
    });

    it('follows the rate of the difficulty chosen', async () => {
      await open();

      await fireEvent.press(option('Facile'));

      expect(info()).toHaveTextContent(/rapporteront \+5 XP\./u);
    });

    it('announces the message again when another difficulty is chosen', async () => {
      await open();

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(option('Facile'));

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(
        expect.stringContaining('rapporteront +5 XP.'),
      );
    });

    it('goes back to « nothing changed » when the first difficulty is chosen again', async () => {
      await open();

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(option('Moyenne'));

      expect(info()).not.toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it('saves the difficulty alone, with the name unchanged, in one go', async () => {
      const { onSave, onSaved } = await open();

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(saveButton());

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ name: 'Cuisiner', difficulty: 'hard' });
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ settingsChanged: true, weekSettings: { difficulty: 'hard' } }),
      );
    });

    it('saves the name and the difficulty together', async () => {
      const { onSave } = await open();

      await type('Courir 10 km');
      await fireEvent.press(option('Facile'));
      await fireEvent.press(saveButton());

      expect(onSave).toHaveBeenCalledWith({ name: 'Courir 10 km', difficulty: 'easy' });
    });

    it('keeps the difficulty chosen while the name is corrected', async () => {
      await open();

      await fireEvent.press(option('Difficile'));
      await type('');

      expect(saveButton()).toBeDisabled();
      expect(option('Difficile')).toBeChecked();
      await type('Cuisiner');
      expect(saveButton()).toBeEnabled();
    });

    it('keeps the difficulty chosen after a failed save, and retries with it', async () => {
      let attempts = 0;
      const { onSave, onSaved } = await open(async (input) => {
        attempts += 1;
        return attempts === 1 ? { ok: false, reason: 'saveFailed' } : updated(input);
      });

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(saveButton());

      expect(
        screen.getByRole('alert', {
          name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
        }),
      ).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      expect(onSaved).not.toHaveBeenCalled();
      await fireEvent.press(saveButton());
      expect(onSave).toHaveBeenNthCalledWith(2, { name: 'Cuisiner', difficulty: 'hard' });
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it('keeps the difficulty chosen after a duplicate', async () => {
      await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

      await fireEvent.press(option('Facile'));
      await type('budget du jour');
      await fireEvent.press(saveButton());

      expect(screen.getByRole('alert', { name: /^Tu as déjà une habitude/u })).toBeOnTheScreen();
      expect(option('Facile')).toBeChecked();
    });
  });

  it('asks for the deletion', async () => {
    const { onDelete, onSave } = await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('explains a deletion that could not be prepared', async () => {
    await open(undefined, 'La suppression a échoué. Réessaie.');

    expect(
      screen.getByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
  });

  it('closes with « Annuler »', async () => {
    const { onClose, onSave } = await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
