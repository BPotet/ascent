import { fireEvent, render, screen } from '@testing-library/react-native';

import { IconBoardScreen } from './IconBoardScreen';

const hidden = { includeHiddenElements: true } as const;

async function open(entry: string) {
  await render(<IconBoardScreen onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: entry }));
}

describe('IconBoardScreen (#157)', () => {
  it('lists the screens of the boon icons, as a tool of the preview build', async () => {
    await render(<IconBoardScreen onClose={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
    expect(screen.getByText('Outil du build de preview')).toBeOnTheScreen();
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      "Choix d'un bienfait",
      'Sorties · aucun bienfait',
      'Sorties · deux bienfaits',
      'Dernière porte · 5 bienfaits',
      'Fermer',
    ]);
  });

  it('closes the board', async () => {
    const onClose = jest.fn();
    await render(<IconBoardScreen onClose={onClose} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the real boon choice with Écho parfait, Givre persistant and Cœur de braise, then the boon obtained', async () => {
    await open("Choix d'un bienfait");

    expect(screen.getByRole('header', { name: 'Choisis un bienfait' })).toBeOnTheScreen();
    expect(screen.getByText('Étage franchi · +10 Or')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((card) => card.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Écho parfait, /),
      expect.stringMatching(/^Givre persistant, /),
      expect.stringMatching(/^Cœur de braise, /),
    ]);
    await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    expect(screen.getByText('Bienfait obtenu.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });

  it('shows the exits without any boon', async () => {
    await open('Sorties · aucun bienfait');

    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
  });

  it('shows the exits with two boons of different rarities', async () => {
    await open('Sorties · deux bienfaits');

    expect(
      screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^(Combat|Élite|Feu de camp)/ })).toHaveLength(3);
  });

  it('shows the last door with the 5 boons, and comes back to the board', async () => {
    await open('Dernière porte · 5 bienfaits');

    expect(screen.getAllByTestId('loadout-chip', hidden)).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Affronter le boss' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });

  it('comes back to the board from a door', async () => {
    await open('Sorties · deux bienfaits');

    await fireEvent.press(screen.getByTestId('ascent-exit-0'));

    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });
});
