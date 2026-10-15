import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { DeleteHabitOutcome } from '../state/useEditHabit';
import { DeleteHabitDialog, deleteHabitBody, deleteHabitTitle } from './DeleteHabitDialog';

const nbsp = ' ';
const KEPT = 'Son historique sera effacé. L’expérience gagnée les jours passés reste acquise';

async function open(
  xpRemoved = 10,
  confirm: () => Promise<DeleteHabitOutcome> = async () => ({ ok: true, xpRemoved, xp: 30 }),
) {
  const props = {
    onConfirm: jest.fn(confirm),
    onDeleted: jest.fn(),
    onGone: jest.fn(),
    onCancel: jest.fn(),
  };
  await render(<DeleteHabitDialog name="Cuisiner" xpRemoved={xpRemoved} {...props} />);
  return props;
}

const deleteButton = () => screen.getByRole('button', { name: 'Supprimer' });

describe('deleteHabitTitle and deleteHabitBody', () => {
  it('names the habit', () => {
    expect(deleteHabitTitle('Cuisiner')).toBe(`Supprimer «${nbsp}Cuisiner${nbsp}»${nbsp}?`);
  });

  it('announces the experience removed when the habit is done today', () => {
    expect(deleteHabitBody(10)).toBe(
      `${KEPT}${nbsp}; seule celle d’aujourd’hui est retirée (−10 XP).`,
    );
  });

  it('says the experience is kept when the habit is not done today', () => {
    expect(deleteHabitBody(0)).toBe(`${KEPT}.`);
  });
});

describe('DeleteHabitDialog', () => {
  beforeAll(async () => {
    await open();
    screen.unmount();
  }, 60_000);

  it('asks to confirm the deletion of the habit and says what is removed', async () => {
    await open(10);

    expect(
      screen.getByRole('header', { name: `Supprimer «${nbsp}Cuisiner${nbsp}»${nbsp}?` }),
    ).toBeOnTheScreen();
    expect(screen.getByText(deleteHabitBody(10))).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('says the experience is kept when nothing is removed', async () => {
    await open(0);

    expect(screen.getByText(deleteHabitBody(0))).toBeOnTheScreen();
  });

  it('makes « Annuler » the default action: first, and focused by the screen reader', async () => {
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    focus.mockClear();
    await open();

    const buttons = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(buttons).toEqual(['Annuler', 'Supprimer']);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]?.[1]).toBe('focus');
  });

  it('signals the deletion as definitive otherwise than by its color', async () => {
    await open();

    expect(deleteButton()).toHaveProp(
      'accessibilityHint',
      `Supprime définitivement «${nbsp}Cuisiner${nbsp}» et ses suivis.`,
    );
  });

  it.each([
    ['« Annuler »', () => fireEvent.press(screen.getByRole('button', { name: 'Annuler' }))],
    [
      'the backdrop',
      () =>
        fireEvent.press(screen.getByTestId('delete-habit-scrim', { includeHiddenElements: true })),
    ],
    ['the back button', () => fireEvent(screen.getByTestId('delete-habit-dialog'), 'requestClose')],
  ])('cancels with %s, without deleting', async (_, cancel) => {
    const { onCancel, onConfirm } = await open();

    await cancel();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('deletes the habit once confirmed, and passes the result on', async () => {
    const { onConfirm, onDeleted } = await open();

    await fireEvent.press(deleteButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledWith({ ok: true, xpRemoved: 10, xp: 30 });
  });

  it('does not delete twice while the deletion is being saved', async () => {
    let finish: (outcome: DeleteHabitOutcome) => void = () => undefined;
    const { onConfirm } = await open(
      10,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    await fireEvent.press(deleteButton());
    await fireEvent.press(deleteButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(deleteButton()).toBeDisabled();
    finish({ ok: true, xpRemoved: 10, xp: 30 });
  });

  it('stays open after a failure, explains it, and lets the player retry', async () => {
    let attempts = 0;
    const { onConfirm, onDeleted } = await open(10, async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, reason: 'saveFailed' }
        : { ok: true, xpRemoved: 10, xp: 30 };
    });

    await fireEvent.press(deleteButton());

    expect(
      screen.getByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(onDeleted).not.toHaveBeenCalled();
    const retry = screen.getByRole('button', { name: 'Réessayer' });
    expect(retry).toBeEnabled();

    await fireEvent.press(retry);

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('tells the screen when the habit no longer exists', async () => {
    const { onGone, onDeleted } = await open(
      10,
      async () => ({ ok: false, reason: 'unknownHabit' }) as const,
    );

    await fireEvent.press(deleteButton());

    expect(onGone).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('fades in, unless the player asked to reduce motion', async () => {
    await open();

    expect(screen.getByTestId('delete-habit-dialog')).toHaveProp('animationType', 'fade');
  });

  it('appears without animation when the player asked to reduce motion', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);

    await open();

    await waitFor(() =>
      expect(screen.getByTestId('delete-habit-dialog')).toHaveProp('animationType', 'none'),
    );
  });

  it('offers touch targets of at least 44 points', async () => {
    await open();

    expect(deleteButton()).toHaveStyle({ minHeight: 52 });
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveStyle({ minHeight: 52 });
  });
});
