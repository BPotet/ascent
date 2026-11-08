import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { BoonKind } from '../../../domain/ascent/boons';
import type { Exit } from '../../../domain/ascent/exits';
import { ExitChoice } from './ExitChoice';

const hidden = { includeHiddenElements: true } as const;
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 2 },
  { kind: 'elite', groupSize: 1 },
  { kind: 'campfire', groupSize: null },
];
const BOSS: readonly Exit[] = [{ kind: 'boss', groupSize: null }];
const FIVE: readonly BoonKind[] = [
  'perfectEcho',
  'lingeringFrost',
  'shatteringEmber',
  'blazingEmber',
  'emberHeart',
];

function names() {
  return screen
    .getAllByTestId('loadout-chip', hidden)
    .map((chip) => within(chip).getAllByText(/./, hidden)[0]!.props.children as string);
}

describe('ExitChoice: the cursed enemy at the doors (#209)', () => {
  const CURSED_DOORS: readonly Exit[] = [
    { kind: 'combat', groupSize: 3 },
    { kind: 'elite', groupSize: null },
  ];

  it('says « dont 1 maudit » on the Combat door and « Élite maudite » under the strong curse', async () => {
    await render(<ExitChoice boons={[]} exits={CURSED_DOORS} gauge={-2} onChoose={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Combat · 3 ennemis · dont 1 maudit' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Élite maudite · objet Rare garanti · coffre scellé' }),
    ).toBeOnTheScreen();
  });

  it('keeps the Elite door as today under the curse, and every door without it', async () => {
    await render(<ExitChoice boons={[]} exits={CURSED_DOORS} gauge={-1} onChoose={jest.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Élite · objet Rare garanti · coffre scellé' }),
    ).toBeOnTheScreen();

    await render(<ExitChoice boons={[]} exits={CURSED_DOORS} onChoose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Combat · 3 ennemis' })).toBeOnTheScreen();
  });
});

describe('ExitChoice (#157)', () => {
  it('shows the « Bienfaits » section in chips, in the order won, then the doors', async () => {
    const onChoose = jest.fn();
    await render(
      <ExitChoice
        boons={['perfectEcho', 'lingeringFrost']}
        exits={DOORS}
        banner={<Text>Étage franchi · +10 Or</Text>}
        onChoose={onChoose}
      />,
    );

    expect(screen.getByText('Étage franchi · +10 Or')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
    ).toBeOnTheScreen();
    expect(names()).toEqual(['Écho parfait', 'Givre persistant']);
    expect(screen.getByText('◆ Commun', hidden)).toBeTruthy();
    expect(screen.getByText('◆◆ Rare', hidden)).toBeTruthy();
    expect(screen.getByText('Bienfaits', hidden)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await fireEvent.press(screen.getByTestId('ascent-exit-2'));
    expect(onChoose).toHaveBeenCalledWith(2);
  });

  it('writes « Aucun bienfait » without any chip when no boon is owned', async () => {
    await render(<ExitChoice boons={[]} exits={DOORS} onChoose={jest.fn()} />);

    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-chip', hidden)).toBeNull();
    expect(screen.queryByText('Bienfaits', hidden)).toBeNull();
  });

  it('puts 5 boons on 2 columns and 3 rows before the last door', async () => {
    await render(<ExitChoice boons={FIVE} exits={BOSS} onChoose={jest.fn()} />);

    expect(names()).toEqual([
      'Écho parfait',
      'Givre persistant',
      'Braise brisante',
      'Braise ardente',
      'Cœur de braise',
    ]);
    expect(screen.getAllByTestId('loadout-chip-row', hidden)).toHaveLength(3);
    expect(screen.getByRole('header', { name: 'Dernière porte' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Affronter le boss' })).toBeOnTheScreen();
  });
});

describe('ExitChoice: the escorted Elite door (#257)', () => {
  const ELITE: readonly Exit[] = [
    { kind: 'combat', groupSize: 3 },
    { kind: 'elite', groupSize: null },
  ];

  it('adds the escort line with crossed swords at tier 2, read by the screen reader (E1)', async () => {
    await render(<ExitChoice boons={[]} exits={ELITE} tier={2} onChoose={jest.fn()} />);

    const door = screen.getByRole('button', {
      name: 'Élite. Escortée de 1 ennemi. Objet Rare garanti. Coffre scellé',
    });
    expect(within(door).getByText('Escortée · 1 ennemi', hidden)).toBeOnTheScreen();
    expect(within(door).getByTestId('ascent-exit-1-escort-swords', hidden)).toBeOnTheScreen();
    expect(within(door).queryByText('dont 1 maudit', hidden)).toBeNull();
  });

  it('adds « dont 1 maudit » with the skull under the curse at tier 3 (E1b)', async () => {
    await render(<ExitChoice boons={[]} exits={ELITE} tier={3} gauge={-1} onChoose={jest.fn()} />);

    const door = screen.getByRole('button', {
      name: 'Élite. Escortée de 2 ennemis, dont 1 maudit. Objet Rare garanti. Coffre scellé',
    });
    expect(within(door).getByText('Escortée · 2 ennemis', hidden)).toBeOnTheScreen();
    expect(within(door).getByText('dont 1 maudit', hidden)).toBeOnTheScreen();
    expect(within(door).getAllByTestId('pixel-button-icon', hidden)).toHaveLength(1);
  });

  it('names the door « Élite maudite » under the strong curse (E1c)', async () => {
    await render(<ExitChoice boons={[]} exits={ELITE} tier={3} gauge={-2} onChoose={jest.fn()} />);

    const door = screen.getByRole('button', {
      name: 'Élite maudite. Escortée de 2 ennemis. Objet Rare garanti. Coffre scellé',
    });
    expect(
      within(door).getByText('Élite maudite · objet Rare garanti · coffre scellé', hidden),
    ).toBeOnTheScreen();
    expect(within(door).queryByText('dont 1 maudit', hidden)).toBeNull();
  });

  it('shows no escort line at tier 1', async () => {
    await render(<ExitChoice boons={[]} exits={ELITE} tier={1} onChoose={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Élite · objet Rare garanti · coffre scellé' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Escortée/u, hidden)).toBeNull();
  });

  it('chooses the escorted Elite door', async () => {
    const onChoose = jest.fn();
    await render(<ExitChoice boons={[]} exits={ELITE} tier={2} onChoose={onChoose} />);

    fireEvent.press(screen.getByTestId('ascent-exit-1'));

    expect(onChoose).toHaveBeenCalledWith(1);
  });
});
