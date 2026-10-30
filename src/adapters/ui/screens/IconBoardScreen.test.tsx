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
      'Bénédictions · 3 sur 3',
      'Bénédiction · 1 sur 1',
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

  it('chains the blessing choices 3A, 3B and 3C at each touch, then comes back to the board (#158)', async () => {
    await open('Bénédictions · 3 sur 3');

    expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 3' })).toBeOnTheScreen();
    expect(
      screen.getAllByRole('button', { name: /Rare · / }).map((b) => b.props.accessibilityLabel),
    ).toEqual([
      'Hâte · Rare · Initiative +2 dans chaque combat',
      'Vigueur · Rare · PV max +10 %',
      'Tranchant · Rare · Attaque +20 %',
    ]);
    expect(screen.queryByLabelText(/^Déjà choisie/)).toBeNull();

    await fireEvent.press(screen.getByTestId('blessing-2'));
    expect(screen.getByRole('header', { name: 'Bénédiction 2 sur 3' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Déjà choisie, 1 sur 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bénédictions de départ : Hâte, Rare')).toBeOnTheScreen();
    expect(
      screen.getAllByRole('button', { name: /Commune · / }).map((b) => b.props.accessibilityLabel),
    ).toEqual([
      expect.stringMatching(/^Élan · /),
      expect.stringMatching(/^Protection · /),
      expect.stringMatching(/^Vigueur · /),
    ]);

    await fireEvent.press(screen.getByTestId('blessing-0'));
    expect(screen.getByRole('header', { name: 'Bénédiction 3 sur 3' })).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Bénédictions de départ : Hâte, Rare ; Vigueur, Commune'),
    ).toBeOnTheScreen();
    expect(
      screen.getAllByRole('button', { name: /Épique · / }).map((b) => b.props.accessibilityLabel),
    ).toEqual([
      expect.stringMatching(/^Élan · /),
      expect.stringMatching(/^Tranchant · /),
      expect.stringMatching(/^Protection · /),
    ]);

    await fireEvent.press(screen.getByTestId('blessing-1'));
    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });

  it('starts the blessing choices again from 3A (#158)', async () => {
    await open('Bénédictions · 3 sur 3');
    await fireEvent.press(screen.getByTestId('blessing-0'));
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Bénédictions · 3 sur 3' }));

    expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 3' })).toBeOnTheScreen();
  });

  it('shows the single blessing choice 3D, without any blessing already chosen (#158)', async () => {
    await open('Bénédiction · 1 sur 1');

    expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 1' })).toBeOnTheScreen();
    expect(
      screen.getAllByRole('button', { name: /Commune · / }).map((b) => b.props.accessibilityLabel),
    ).toEqual([
      expect.stringMatching(/^Élan · /),
      expect.stringMatching(/^Vigueur · /),
      expect.stringMatching(/^Protection · /),
    ]);
    expect(screen.queryByText(/Déjà choisie/, hidden)).toBeNull();

    await fireEvent.press(screen.getByTestId('blessing-0'));
    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });
});
