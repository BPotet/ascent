import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { pixelFont } from '../pixelArt/pixelTypography';

import { BoonChoicePanel } from './BoonChoicePanel';
import { wellOf } from '../testing/iconWell';

describe('BoonChoicePanel', () => {
  it('offers 3 boons, and takes one in two steps: the card, then « Prendre »', async () => {
    const onChoose = jest.fn();
    await render(
      <BoonChoicePanel
        offer={['perfectEcho', 'lingeringFrost', 'emberHeart']}
        onChoose={onChoose}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Prendre' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Écho parfait, Écho, Commun/ }));
    expect(screen.getByRole('radio', { name: /^Écho parfait/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

    expect(screen.getByText('Bienfait obtenu.')).toBeOnTheScreen();
    expect(
      screen.getByText('Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).'),
    ).toBeOnTheScreen();
    expect(onChoose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onChoose).toHaveBeenCalledWith(0);
  });

  it('hatches « Prendre » until a card is chosen, then ticks the chosen card and its name in gold (#120)', async () => {
    await render(
      <BoonChoicePanel
        offer={['perfectEcho', 'lingeringFrost', 'emberHeart']}
        onChoose={jest.fn()}
      />,
    );

    const take = () => screen.getByRole('button', { name: 'Prendre' });
    expect(take()).toBeDisabled();
    expect(within(take()).getByTestId('pixel-button-hatching')).toBeOnTheScreen();
    expect(screen.queryByTestId('boon-tick', { includeHiddenElements: true })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));

    const chosen = screen.getByRole('radio', { name: /^Givre persistant/ });
    expect(within(chosen).getByTestId('boon-tick', { includeHiddenElements: true })).toBeTruthy();
    expect(within(chosen).getByText('Givre persistant')).toHaveStyle({
      color: artPalette.roles.gold,
      fontFamily: pixelFont,
    });
    expect(screen.getAllByTestId('boon-tick', { includeHiddenElements: true })).toHaveLength(1);
    expect(take()).toBeEnabled();
    expect(within(take()).queryByTestId('pixel-button-hatching')).toBeNull();
  });

  describe('with the boon icons (#157)', () => {
    const { roles } = artPalette;
    const hidden = { includeHiddenElements: true } as const;
    const OFFER = ['perfectEcho', 'lingeringFrost', 'emberHeart'] as const;

    it('shows on the left of each card its 48 dp icon, in a 56 dp well of the colour of its rarity', async () => {
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);

      const cards = screen.getAllByRole('radio');
      const wells = cards.map(wellOf);
      expect(wells.map(({ sprite }) => sprite)).toEqual([
        'boon-icon:perfectEcho',
        'boon-icon:lingeringFrost',
        'boon-icon:emberHeart',
      ]);
      expect(wells.map(({ style }) => style.borderColor)).toEqual([
        roles.rarityCommon,
        roles.rarityRare,
        roles.rarityEpic,
      ]);
      wells.forEach(({ style, width }) => {
        expect(style).toMatchObject({ width: 56, height: 56 });
        expect(width).toBe(48);
      });
      expect(wells.map(({ scale }) => scale)).toEqual([3, 2, 2]);
    });

    it('keeps, in this order, the rarity tag, the name and the effect of a card', async () => {
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);

      const card = screen.getByRole('radio', { name: /^Givre persistant/ });
      expect(
        within(card)
          .getAllByText(/./)
          .map((text) => text.props.children),
      ).toEqual([
        '◆◆ Givre · Rare',
        'Givre persistant',
        'Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
      ]);
      expect(within(card).getByText('◆◆ Givre · Rare')).toHaveStyle({ color: roles.rarityRare });
      expect(card).toHaveAccessibleName(
        'Givre persistant, Givre, Rare. Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
      );
    });

    it('keeps the line of the rarity on the well of the chosen card', async () => {
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);

      await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));

      const chosen = wellOf(screen.getByRole('radio', { name: /^Givre persistant/ }));
      expect(chosen.style.borderColor).toBe(roles.rarityRare);
      within(screen.getByRole('radio', { name: /^Givre persistant/ }))
        .getAllByTestId('icon-well-corner', hidden)
        .forEach((corner) =>
          expect(StyleSheet.flatten(corner.props.style).backgroundColor).toBe(roles.goldBg),
        );
    });

    it.each([
      ['lingeringFrost', 1, 4, roles.rarityRare],
      ['perfectEcho', 0, 6, roles.rarityCommon],
    ] as const)(
      'shows the obtained %s at 96 dp (×%p), in a doubled 112 dp well of its rarity',
      async (kind, index, scale, color) => {
        await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
        await fireEvent.press(screen.getAllByRole('radio')[index]!);
        await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

        const obtained = screen.getByTestId('boon-obtained');
        const well = wellOf(obtained);
        expect(well).toMatchObject({ sprite: `boon-icon:${kind}`, scale, width: 96 });
        expect(well.style).toMatchObject({ width: 112, height: 112, borderColor: color });
        expect(within(obtained).getByTestId('icon-well-double', hidden)).toBeTruthy();
      },
    );

    it('announces the boon obtained, then its effect, and keeps its rarity, name, effect and « Continuer »', async () => {
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
      await fireEvent.press(screen.getByRole('radio', { name: /^Givre persistant/ }));
      await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

      expect(
        screen.getByLabelText(
          'Bienfait obtenu : Givre persistant, Givre, Rare. Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('◆◆ Givre · Rare')).toHaveStyle({ color: roles.rarityRare });
      expect(screen.getByText('Givre persistant')).toBeTruthy();
      expect(
        screen.getByText('Un ennemi étourdi se relève avec la moitié de sa garde seulement.'),
      ).toBeTruthy();
      expect(screen.getByText('Bienfait obtenu.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Continuer' })).toBeOnTheScreen();
    });
  });
});
