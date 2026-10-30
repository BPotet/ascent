import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { Loadout } from '../../../domain/ascent/loadout';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { wellOf } from '../testing/iconWell';
import { LoadoutSheet } from './LoadoutSheet';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

const THREE: Loadout = {
  blessings: [{ family: 'haste', rarity: 'rare' }],
  boons: ['perfectEcho', 'lingeringFrost'],
};
const MAX: Loadout = {
  blessings: [
    { family: 'protection', rarity: 'epic' },
    { family: 'haste', rarity: 'rare' },
    { family: 'vigor', rarity: 'common' },
  ],
  boons: ['perfectEcho', 'lingeringFrost', 'shatteringEmber', 'blazingEmber', 'emberHeart'],
};
const EMPTY: Loadout = { blessings: [], boons: [] };

async function open(loadout: Loadout, { combat = false } = {}) {
  const onClose = jest.fn();
  await render(<LoadoutSheet loadout={loadout} combat={combat} visible onClose={onClose} />);
  return { onClose };
}

const rows = () => screen.getAllByTestId('loadout-row');

describe('LoadoutSheet (#159)', () => {
  it('opens with its title, focused by the screen reader, and its subtitle', async () => {
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    focus.mockClear();
    await open(THREE);

    const title = screen.getByRole('header', { name: 'Équipement' });
    expect(title).toBeOnTheScreen();
    expect(
      screen.getByText("Tes bénédictions et tes bienfaits, jusqu'à la fin de l'ascension."),
    ).toBeOnTheScreen();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0]?.[1]).toBe('focus');
  });

  it('is not shown when closed', async () => {
    await render(
      <LoadoutSheet loadout={THREE} combat={false} visible={false} onClose={jest.fn()} />,
    );

    expect(screen.queryByRole('header', { name: 'Équipement' })).toBeNull();
  });

  it('lists the starting blessings, then the boons in the order won, each with its icon, name, rarity and effect', async () => {
    await open(THREE);

    expect(rows().map((row) => wellOf(row).sprite)).toEqual([
      'blessing-icon:haste',
      'boon-icon:perfectEcho',
      'boon-icon:lingeringFrost',
    ]);
    const [haste, echo, frost] = rows();
    expect(within(haste!).getByText('Hâte')).toBeOnTheScreen();
    expect(within(haste!).getByText('◆◆ Bénédiction · Rare')).toHaveStyle({
      color: roles.rarityRare,
    });
    expect(within(haste!).getByText('Initiative +2 dans chaque combat')).toBeOnTheScreen();
    expect(within(echo!).getByText('Écho parfait')).toBeOnTheScreen();
    expect(within(echo!).getByText('◆ Écho · Commun')).toHaveStyle({
      color: roles.rarityCommon,
    });
    expect(within(frost!).getByText('◆◆ Givre · Rare')).toBeOnTheScreen();
    expect(
      within(frost!).getByText('Un ennemi étourdi se relève avec la moitié de sa garde seulement.'),
    ).toBeOnTheScreen();
  });

  it('heads each part with its count', async () => {
    await open(THREE);

    expect(screen.getByLabelText('Bénédictions de départ, 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bienfaits, 2')).toBeOnTheScreen();
  });

  it('reads each row with its name, rarity and effect, its icon hidden', async () => {
    await open(THREE);

    const [haste, echo] = rows();
    expect(haste).toHaveAccessibleName('Hâte · Rare · Initiative +2 dans chaque combat');
    expect(echo).toHaveAccessibleName(
      'Écho parfait, Écho, Commun. Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).',
    );
    expect(wellOf(haste!).well).toHaveProp('accessibilityElementsHidden', true);
  });

  it('tells each empty part, without a row', async () => {
    await open(EMPTY);

    expect(
      screen.getByText("Aucune bénédiction de départ : aucune habitude faite hier ne l'a donnée."),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Aucun bienfait pour l'instant. Gagne un combat pour en choisir un."),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-row')).toBeNull();
  });

  it('writes « Combat en pause » at the top in combat', async () => {
    await open(THREE, { combat: true });

    expect(screen.getByRole('status')).toHaveTextContent('Combat en pause');
  });

  it('writes no « Combat en pause » out of combat', async () => {
    await open(THREE);

    expect(screen.queryByText('Combat en pause')).toBeNull();
  });

  it('hints « Fais défiler », hidden from the screen reader, beyond 3 entries', async () => {
    await open(MAX);

    const more = screen.getByTestId('loadout-sheet-more', hidden);
    expect(more).toHaveTextContent('▼ Fais défiler');
    expect(more).toHaveProp('accessibilityElementsHidden', true);
    expect(screen.queryByText('▼ Fais défiler')).toBeNull();
  });

  it('hints nothing up to 3 entries', async () => {
    await open(THREE);

    expect(screen.queryByTestId('loadout-sheet-more', hidden)).toBeNull();
  });

  it.each([
    ['« Fermer »', () => fireEvent.press(screen.getByRole('button', { name: 'Fermer' }))],
    ['the back gesture', () => fireEvent(screen.getByTestId('loadout-sheet'), 'requestClose')],
    [
      'the backdrop',
      () =>
        fireEvent.press(screen.getByTestId('loadout-sheet-scrim', { includeHiddenElements: true })),
    ],
  ])('closes with %s', async (_, close) => {
    const { onClose } = await open(THREE);

    await close();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with a « Fermer » of 48 dp at least', async () => {
    await open(THREE);

    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveStyle({
      minHeight: MIN_TARGET_SIZE,
    });
  });
});
