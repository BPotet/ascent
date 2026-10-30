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
