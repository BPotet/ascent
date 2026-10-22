import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { WhatsNewCard } from './WhatsNewCard';

async function show() {
  const onAdjust = jest.fn();
  const onClose = jest.fn();
  await render(<WhatsNewCard onAdjust={onAdjust} onClose={onClose} />);
  return { onAdjust, onClose };
}

describe('WhatsNewCard', () => {
  it('says what is new: the difficulty and the weekly target of each habit', async () => {
    await show();

    const card = screen.getByTestId('whats-new-card');
    expect(within(card).getByText('Nouveau')).toBeOnTheScreen();
    expect(
      screen.getByText('Règle la difficulté et l’objectif de chaque habitude'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Pour l’instant, toutes sont en Moyenne, tous les jours : rien ne change pour ton expérience.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Nouveau : règle la difficulté et l’objectif de chaque habitude. Pour l’instant, toutes sont en Moyenne, tous les jours : rien ne change pour ton expérience.',
      ),
    ).toBeOnTheScreen();
  });

  it('offers « Régler »', async () => {
    const { onAdjust, onClose } = await show();

    await fireEvent.press(screen.getByRole('button', { name: 'Régler' }));

    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes with its own button, 44 pt at least', async () => {
    const { onAdjust, onClose } = await show();

    const close = screen.getByRole('button', { name: 'Fermer la nouveauté' });
    await fireEvent.press(close);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAdjust).not.toHaveBeenCalled();
    expect(close).toHaveStyle({ minWidth: 44, minHeight: 44 });
    expect(screen.getByTestId('whats-new-adjust')).toBeOnTheScreen();
    expect(screen.getByTestId('whats-new-close')).toBeOnTheScreen();
  });
});
