import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import type { RenameHabitOutcome } from '../state/useEditHabit';
import { EditHabitSheet } from './EditHabitSheet';

const nbsp = ' ';
const monday = Day.of(2026, 10, 5);
const cooking = new Habit(1, HabitName.parse('Cuisiner'), monday);
const budget = new Habit(2, HabitName.parse('Budget du jour'), Day.of(2026, 10, 12));

function renamed(name: string): RenameHabitOutcome {
  return { ok: true, habit: new Habit(1, HabitName.parse(name), monday) };
}

async function open(
  rename: (name: string) => Promise<RenameHabitOutcome> = async (name) => renamed(name),
  deleteAlert: string | null = null,
) {
  const props = {
    onRename: jest.fn(rename),
    onRenamed: jest.fn(),
    onGone: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
  };
  await render(
    <EditHabitSheet
      habit={cooking}
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
      const { onRename } = await open();

      await type(text);
      await fireEvent(field(), 'submitEditing');

      expect(saveButton()).toBeDisabled();
      expect(onRename).not.toHaveBeenCalled();
    },
  );

  it('renames the habit, and passes it on', async () => {
    const { onRename, onRenamed } = await open();

    await type('Cuisiner maison');
    await fireEvent.press(saveButton());

    expect(onRename).toHaveBeenCalledWith('Cuisiner maison');
    expect(onRenamed).toHaveBeenCalledWith(expect.any(Habit));
    expect(onRenamed.mock.calls[0]?.[0].name.value).toBe('Cuisiner maison');
  });

  it('lets the player change only the capital letters', async () => {
    const { onRename } = await open();

    await type('CUISINER');

    expect(saveButton()).toBeEnabled();
    await fireEvent.press(saveButton());
    expect(onRename).toHaveBeenCalledWith('CUISINER');
  });

  it('explains an emptied name and disables saving', async () => {
    const { onRename } = await open();

    await type('   ');

    expect(screen.getByRole('alert', { name: 'Le nom ne peut pas être vide.' })).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Le nom ne peut pas être vide.',
    );
    expect(screen.getByText('0/40')).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('keeps a pasted name of 41 characters and explains the limit', async () => {
    const { onRename } = await open();

    await type('é'.repeat(41));

    expect(field()).toHaveDisplayValue('é'.repeat(41));
    expect(screen.getByText('41/40')).toBeOnTheScreen();
    expect(
      screen.getByRole('alert', { name: 'Le nom compte 40 caractères au plus.' }),
    ).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('refuses the name of another habit, names it, and keeps the name typed', async () => {
    const { onRenamed } = await open(async () => ({ ok: false, reason: 'duplicate' }) as const);

    await type('budget du jour');
    await fireEvent.press(saveButton());

    expect(
      screen.getByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Budget du jour${nbsp}».`,
      }),
    ).toBeOnTheScreen();
    expect(field()).toHaveDisplayValue('budget du jour');
    expect(saveButton()).toBeDisabled();
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it('keeps the name typed when it cannot be saved, and lets the player retry', async () => {
    let attempts = 0;
    const { onRename, onRenamed } = await open(async (name) => {
      attempts += 1;
      return attempts === 1 ? { ok: false, reason: 'saveFailed' } : renamed(name);
    });

    await type('Cuisiner maison');
    await fireEvent.press(saveButton());

    expect(
      screen.getByRole('alert', { name: 'Le nom n’a pas pu être enregistré. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(field()).toHaveDisplayValue('Cuisiner maison');
    expect(onRenamed).not.toHaveBeenCalled();

    await fireEvent.press(saveButton());
    expect(onRename).toHaveBeenCalledTimes(2);
    expect(onRenamed).toHaveBeenCalledTimes(1);
  });

  it('tells the screen when the habit no longer exists', async () => {
    const { onGone, onRenamed } = await open(
      async () => ({ ok: false, reason: 'unknownHabit' }) as const,
    );

    await type('Cuisiner maison');
    await fireEvent.press(saveButton());

    expect(onGone).toHaveBeenCalledTimes(1);
    expect(onRenamed).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('asks for the deletion', async () => {
    const { onDelete, onRename } = await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('explains a deletion that could not be prepared', async () => {
    await open(undefined, 'La suppression a échoué. Réessaie.');

    expect(
      screen.getByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
  });

  it('closes with « Annuler »', async () => {
    const { onClose, onRename } = await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
  });
});
