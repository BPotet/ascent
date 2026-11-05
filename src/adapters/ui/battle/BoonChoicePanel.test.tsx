import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { pixelFont } from '../pixelArt/pixelTypography';

import { BoonChoicePanel } from './BoonChoicePanel';
import { wellOf } from '../testing/iconWell';

const HP = { heroHp: 40, heroMaxHp: 88 } as const;

describe('BoonChoicePanel', () => {
  it('offers 3 boons, and takes one in two steps: the card, then « Prendre »', async () => {
    const onChoose = jest.fn();
    await render(
      <BoonChoicePanel
        offer={['perfectEcho', 'lingeringFrost', 'emberHeart']}
        onChoose={onChoose}
        {...HP}
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
        {...HP}
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
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} {...HP} />);

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

    it("shows Veillée d'hiver in an Epic well, like Cœur de braise (#195)", async () => {
      await render(
        <BoonChoicePanel
          offer={['perfectEcho', 'winterVigil', 'emberHeart']}
          onChoose={jest.fn()}
          {...HP}
        />,
      );

      const wells = screen.getAllByRole('radio').map(wellOf);
      expect(wells.map(({ sprite }) => sprite)).toEqual([
        'boon-icon:perfectEcho',
        'boon-icon:winterVigil',
        'boon-icon:emberHeart',
      ]);
      expect(wells.map(({ style }) => style.borderColor)).toEqual([
        roles.rarityCommon,
        roles.rarityEpic,
        roles.rarityEpic,
      ]);
      expect(
        screen.getByRole('radio', { name: /^Veillée d'hiver, Givre, Épique\. / }),
      ).toBeOnTheScreen();
    });

    it('keeps, in this order, the rarity tag, the name and the effect of a card', async () => {
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} {...HP} />);

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
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} {...HP} />);

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
        await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} {...HP} />);
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
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} {...HP} />);
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

  describe('with the tier boons and the card Second souffle (#212)', () => {
    const { roles } = artPalette;
    const hidden = { includeHiddenElements: true } as const;
    const card = () => screen.getByRole('radio', { name: /^Second souffle/ });
    const texts = (element: ReturnType<typeof card>) =>
      within(element)
        .getAllByText(/./)
        .map((text) => text.props.children);

    it('ends the line of a tier boon with « · Palier 2 » in grey, read at the end of its name', async () => {
      await render(
        <BoonChoicePanel
          offer={['perfectEcho', 'hoarfrost', 'lingeringFrost']}
          onChoose={jest.fn()}
          {...HP}
        />,
      );

      const tierBoon = screen.getByRole('radio', {
        name: 'Gelée blanche, Givre, Rare, palier 2. Chaque impact paré parfaitement te rend 2 PV.',
      });
      expect(within(tierBoon).getByText('· Palier 2')).toHaveStyle({ color: roles.muted });
      expect(wellOf(tierBoon)).toMatchObject({ sprite: 'boon-icon:hoarfrost', scale: 2 });
      expect(screen.getAllByText('· Palier 2')).toHaveLength(1);
      expect(screen.getByLabelText('Offre').props.accessibilityRole).toBe('radiogroup');
    });

    it('shows a green card last, without family nor rarity, with the HP it will give back', async () => {
      await render(
        <BoonChoicePanel
          offer={['trueHour', 'belfryFrost', 'secondBreath']}
          onChoose={jest.fn()}
          {...HP}
        />,
      );

      expect(screen.getAllByRole('radio')).toHaveLength(3);
      expect(screen.getAllByRole('radio')[2]).toBe(card());
      expect(card()).toHaveAccessibleName(
        "Second souffle : rend 8 PV, de 40 à 48 PV sur 88. Ce n'est pas un bienfait.",
      );
      expect(texts(card())).toEqual([
        '+8 PV',
        'Soin',
        'Second souffle',
        'Rend 10 % de tes PV max, tout de suite.',
        '40 → 48 / 88 PV',
      ]);
      expect(within(card()).getByText('Soin')).toHaveStyle({ color: roles.done });
      expect(within(card()).queryByText(/◆/)).toBeNull();
      const well = wellOf(card());
      expect(well).toMatchObject({ sprite: 'second-breath-icon', scale: 2, width: 48 });
      expect(well.style).toMatchObject({ borderColor: roles.done, width: 56 });
      expect(
        StyleSheet.flatten(within(card()).getByTestId('second-breath-frame').props.style),
      ).toMatchObject({ borderColor: roles.doneLine });
      expect(
        screen.getByText("Un seul des trois. Un bienfait dure jusqu'à la fin de l'ascension."),
      ).toBeTruthy();
    });

    it('draws the HP to give back in green on a small bar', async () => {
      await render(
        <BoonChoicePanel offer={['emberHeart', 'secondBreath']} onChoose={jest.fn()} {...HP} />,
      );

      const bar = within(card()).getByTestId('second-breath-bar', hidden);
      const [gain, hp] = within(bar)
        .getAllByTestId(/^second-breath-bar-/, hidden)
        .map((part) => StyleSheet.flatten(part.props.style));
      expect(gain).toMatchObject({ width: `${(48 / 88) * 100}%`, backgroundColor: roles.done });
      expect(hp).toMatchObject({ width: `${(40 / 88) * 100}%` });
      expect(
        screen.getByText("Un seul des deux. Un bienfait dure jusqu'à la fin de l'ascension."),
      ).toBeTruthy();
    });

    it('says « +0 PV » in grey and « Tes PV sont déjà pleins. » at full HP', async () => {
      await render(
        <BoonChoicePanel
          offer={['trueHour', 'secondBreath']}
          onChoose={jest.fn()}
          heroHp={80}
          heroMaxHp={80}
        />,
      );

      expect(card()).toHaveAccessibleName(
        "Second souffle : rend 0 PV, tes PV sont déjà pleins, 80 sur 80. Ce n'est pas un bienfait.",
      );
      expect(within(card()).getByText('+0 PV')).toHaveStyle({ color: roles.parchment });
      expect(within(card()).getByText('80 / 80 PV')).toBeTruthy();
      expect(within(card()).getByText('Tes PV sont déjà pleins.')).toBeTruthy();
    });

    it('preselects the card alone under « Reprends ton souffle »: one press on « Prendre »', async () => {
      const onChoose = jest.fn();
      await render(<BoonChoicePanel offer={['secondBreath']} onChoose={onChoose} {...HP} />);

      expect(screen.getByRole('header', { name: 'Reprends ton souffle' })).toBeOnTheScreen();
      expect(screen.getByText('Tu as tous les bienfaits de ce palier.')).toBeTruthy();
      expect(screen.queryByText('Choisis un bienfait')).toBeNull();
      expect(card()).toBeChecked();
      expect(within(card()).getByTestId('boon-tick', hidden)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Prendre' })).toBeEnabled();

      await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
      expect(onChoose).toHaveBeenCalledWith(0);
    });

    it('shows the HP given back after the choice, in place of « Bienfait obtenu. »', async () => {
      const onChoose = jest.fn();
      await render(
        <BoonChoicePanel
          offer={['trueHour', 'belfryFrost', 'secondBreath']}
          onChoose={onChoose}
          {...HP}
        />,
      );
      await fireEvent.press(card());
      expect(card()).toBeChecked();
      await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

      const obtained = screen.getByTestId('second-breath-obtained');
      expect(
        within(obtained).getByLabelText('PV rendus : Second souffle, 8 PV. PV 48 sur 88.'),
      ).toBeOnTheScreen();
      expect(texts(obtained)).toEqual([
        'Soin',
        'Second souffle',
        '+8 PV',
        'PV 40 → 48 / 88',
        'PV rendus.',
        'Continuer',
      ]);
      expect(within(obtained).getByText('PV rendus.')).toHaveStyle({ color: roles.done });
      expect(screen.queryByText('Bienfait obtenu.')).toBeNull();
      const well = wellOf(obtained);
      expect(well).toMatchObject({ sprite: 'second-breath-icon', scale: 4, width: 96 });
      expect(well.style).toMatchObject({ width: 112, borderColor: roles.done });
      expect(onChoose).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
      expect(onChoose).toHaveBeenCalledWith(2);
    });

    it('says the HP were already full after the choice at full HP', async () => {
      await render(
        <BoonChoicePanel
          offer={['secondBreath']}
          onChoose={jest.fn()}
          heroHp={80}
          heroMaxHp={80}
        />,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

      expect(
        screen.getByLabelText('Second souffle : PV déjà pleins, 80 sur 80.'),
      ).toBeOnTheScreen();
      expect(screen.getByText('+0 PV')).toHaveStyle({ color: roles.muted });
      expect(screen.getByText('Tes PV étaient déjà pleins.')).toHaveStyle({
        color: roles.parchment,
      });
    });

    it('shows a tier boon obtained without its tier mark, as any boon', async () => {
      await render(
        <BoonChoicePanel offer={['ashenBlade', 'secondBreath']} onChoose={jest.fn()} {...HP} />,
      );
      await fireEvent.press(screen.getByRole('radio', { name: /^Lame de cendre/ }));
      await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));

      expect(screen.getByText('Bienfait obtenu.')).toBeTruthy();
      expect(screen.getByText('◆◆◆ Braise · Épique')).toBeTruthy();
      expect(screen.queryByText(/Palier/)).toBeNull();
      expect(wellOf(screen.getByTestId('boon-obtained')).sprite).toBe('boon-icon:ashenBlade');
    });
    describe('with the feedback of the heal (#212, maquette 210 S1)', () => {
      const take = async (hp = 40, maxHp = 88) => {
        await render(
          <BoonChoicePanel
            offer={['secondBreath']}
            onChoose={jest.fn()}
            heroHp={hp}
            heroMaxHp={maxHp}
          />,
        );
        await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
      };
      const advance = async (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += 10) {
          await act(async () => {
            jest.advanceTimersByTime(10);
          });
        }
      };
      const styleOf = (testID: string) =>
        StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style);
      const gainWidth = () => parseFloat(styleOf('second-breath-bar-gain').width as string);
      const puffs = () => screen.queryAllByTestId('second-breath-puff', hidden);

      beforeEach(() => jest.useFakeTimers());
      afterEach(() => {
        jest.useRealTimers();
        jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
      });

      it('lets 4 light puffs rise from the well for 900 ms, then nothing', async () => {
        await take();

        const well = screen.getByTestId('second-breath-well', hidden);
        expect(within(well).getAllByTestId('second-breath-puff', hidden)).toHaveLength(4);
        expect(styleOf('second-breath-puffs')).toMatchObject({ position: 'absolute' });
        await advance(450);
        const risen = puffs().map((puff) => StyleSheet.flatten(puff.props.style));
        expect(risen).toHaveLength(4);
        for (const style of risen) {
          expect(style).toMatchObject({ backgroundColor: roles.light });
          expect(style.opacity).toBeGreaterThan(0);
          expect(style.transform[0].translateY).toBeLessThan(0);
        }
        await advance(500);
        expect(puffs().length).toBeLessThan(4);
        await advance(150);
        expect(puffs()).toHaveLength(0);
      });

      it('makes « +8 PV » appear in 320 ms', async () => {
        await take();

        expect(styleOf('second-breath-gain')).toMatchObject({ opacity: 0 });
        await advance(330);
        expect(styleOf('second-breath-gain')).toMatchObject({
          opacity: 1,
          transform: [{ scale: 1 }],
        });
      });

      it('fills the bar in green from 40 to 48 in 7 steps of 100 ms, after 300 ms', async () => {
        await take();

        expect(gainWidth()).toBeCloseTo((40 / 88) * 100);
        await advance(300);
        expect(gainWidth()).toBeCloseTo((40 / 88) * 100);
        await advance(100);
        expect(gainWidth()).toBeCloseTo(((40 + 8 / 7) / 88) * 100);
        await advance(300);
        expect(gainWidth()).toBeCloseTo(((40 + 32 / 7) / 88) * 100);
        await advance(300);
        expect(gainWidth()).toBeCloseTo((48 / 88) * 100);
        expect(styleOf('second-breath-bar-gain')).toMatchObject({
          backgroundColor: roles.done,
          opacity: 1,
        });
      });

      it('in reduced motion, only fades the green of the bar in, without puffs', async () => {
        jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
        await take();

        expect(puffs()).toHaveLength(0);
        expect(styleOf('second-breath-gain')).toMatchObject({ opacity: 1 });
        expect(styleOf('second-breath-gain').transform).toBeUndefined();
        expect(gainWidth()).toBeCloseTo((48 / 88) * 100);
        expect(styleOf('second-breath-bar-gain')).toMatchObject({ opacity: 0 });
        await advance(700);
        expect(styleOf('second-breath-bar-gain').opacity).toBeCloseTo(4 / 7);
        await advance(300);
        expect(styleOf('second-breath-bar-gain')).toMatchObject({ opacity: 1 });
        expect(puffs()).toHaveLength(0);
      });

      it('lets no puff rise when the HP were already full', async () => {
        await take(80, 80);

        expect(puffs()).toHaveLength(0);
        expect(screen.getByText('+0 PV')).toBeOnTheScreen();
      });
    });
  });
});
