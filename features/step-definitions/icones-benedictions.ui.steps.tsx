/**
 * Scénarios de « Les icônes des bénédictions de départ » (#158). Le choix d'une bénédiction est
 * rendu par `AscentScreen`, sur une ascension sauvegardée dont l'offre (`blessingOffer`), les
 * raretés restantes (`blessingRarities`) et les bénédictions prises (`blessings`) sont fixées comme
 * dans la maquette, avec la simulation de `SpriteCanvas` : elle expose le nom, l'échelle et la
 * taille en pixels d'art de chaque icône.
 *
 * Correspondance des libellés :
 * - « l'icône de N dp » : la taille rendue, pixels d'art × `artPixelSize(échelle)`, à la densité 3 ;
 * - « un écrin au trait de la couleur Rare » : l'`IconWell` du bouton, de bordure `rarityRare` ;
 * - « une pastille d'équipement » : une `LoadoutChip` (`loadout-chip`) ;
 * - « l'écran de choix d'une bénédiction » : l'écran `ascent-blessing`.
 */
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { PixelRatio, StyleSheet } from 'react-native';

import { chooseBlessing, startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { BlessingFamily, StartingBlessing } from '../../src/domain/ascent/blessings';
import type { Rarity } from '../../src/domain/ascent/rarity';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { artPixelSize } from '../../src/adapters/ui/pixelArt/artPixel';
import { BLESSING_ICONS } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/blessingIcons';
import { blessingIcon } from '../../src/adapters/ui/pixelArt/sprites/gameIcons';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

type Element = ReturnType<typeof screen.getByTestId>;
type Session = ReturnType<typeof ascentSetUp>['session'];

/** Le pixel physique d'un écran de densité `density`. */
function atDensity(density: number) {
  jest
    .spyOn(PixelRatio, 'roundToNearestPixel')
    .mockImplementation((size) => Math.round(size * density) / density);
}

/** L'écrin d'un élément, et le nom et la taille rendue de son icône. */
function wellOf(element: Element) {
  const well = within(element).getByTestId('icon-well', hidden);
  const icon = within(well).getByTestId('icon-well-icon', hidden).props as {
    sprite: string;
    scale: 2 | 3 | 4 | 6;
    pixelWidth: number;
    pixelHeight: number;
  };
  return {
    style: StyleSheet.flatten(well.props.style),
    sprite: icon.sprite,
    width: icon.pixelWidth * artPixelSize(icon.scale),
    height: icon.pixelHeight * artPixelSize(icon.scale),
  };
}

/** Les textes d'un bouton de bénédiction, dans l'ordre. */
function textsOf(button: Element): string[] {
  return within(button)
    .getAllByText(/./, hidden)
    .map((text) => text.props.children as string);
}

function buttons(): Element[] {
  return [0, 1, 2].map((index) => screen.getByTestId(`blessing-${index}`));
}

/** Une ascension au choix d'une bénédiction : son offre, la rareté proposée, celles déjà prises. */
function choosing(
  offer: readonly BlessingFamily[],
  rarities: readonly Rarity[],
  taken: readonly StartingBlessing[] = [],
): Ascent {
  return {
    ...startAscent(42, { gauge: 1, blessings: [...rarities] }),
    blessingOffer: offer,
    blessings: taken,
  };
}

/** Une ascension commencée avec 3 bénédictions, dont l'offre tirée par le domaine contient la Hâte. */
function openingWithHaste(): Ascent {
  for (let seed = 1; ; seed += 1) {
    const ascent = startAscent(seed, { gauge: 1, blessings: ['rare', 'common', 'epic'] });
    if (ascent.blessingOffer!.includes('haste')) return ascent;
  }
}

let session: Session;

async function show(saved?: Ascent, begin?: Parameters<Session['begin']>[0]) {
  const setUp = ascentSetUp(saved === undefined ? {} : { saved });
  session = setUp.session;
  await session.load();
  if (begin !== undefined) session.begin(begin);
  await renderScreen(
    <AscentScreen session={session} visibility={{ onChange: () => () => {} }} onLeave={() => {}} />,
    setUp.dependencies,
  );
}

async function unmount() {
  await act(async () => {
    screen.unmount();
  });
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => atDensity(3));
  afterEach(() => jest.restoreAllMocks());

  given('le joueur a fait hier 3 habitudes et vient de choisir son héros', () => {
    // Trois habitudes faites hier : trois bénédictions, la plus rare d'abord (voir `choosing`).
  });

  and(
    "l'écran « Bénédiction 1 sur 3 » propose Hâte, Vigueur et Tranchant en rareté Rare",
    async () => {
      await show(choosing(['haste', 'vigor', 'edge'], ['rare', 'common', 'epic']));
      expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 3' })).toBeOnTheScreen();
    },
  );

  then(
    "chaque bouton montre l'icône de bénédiction de sa famille à 48 dp, dans un écrin au trait de la couleur Rare",
    () => {
      const wells = buttons().map(wellOf);
      expect(wells.map((well) => well.sprite)).toEqual(
        (['haste', 'vigor', 'edge'] as const).map((family) => blessingIcon(family).sprite),
      );
      wells.forEach((well) => {
        expect([well.width, well.height]).toEqual([48, 48]);
        expect(well.style.borderColor).toBe(roles.rarityRare);
      });
    },
  );

  and(
    "il montre ensuite le nom de la famille, « ◆◆ Rare » sur sa propre ligne et dans la couleur de la rareté, puis l'effet",
    () => {
      expect(buttons().map(textsOf)).toEqual([
        ['Hâte', '◆◆ Rare', 'Initiative +2 dans chaque combat'],
        ['Vigueur', '◆◆ Rare', 'PV max +10 %'],
        ['Tranchant', '◆◆ Rare', 'Attaque +20 %'],
      ]);
      buttons().forEach((button) =>
        expect(within(button).getByText('◆◆ Rare', hidden)).toHaveStyle({
          color: roles.rarityRare,
        }),
      );
    },
  );

  and('chaque bouton fait au moins 72 dp de haut', () => {
    buttons().forEach((button) => expect(button).toHaveStyle({ minHeight: 72 }));
  });

  given("l'écran « Bénédiction 1 sur 3 »", async () => {
    await show(choosing(['haste', 'vigor', 'edge'], ['rare', 'common', 'epic']));
  });

  when('le joueur touche le bouton Hâte', async () => {
    await fireEvent.press(
      screen.getByRole('button', { name: 'Hâte · Rare · Initiative +2 dans chaque combat' }),
    );
  });

  then('la Hâte est choisie sans autre confirmation', () => {
    expect(session.current()!.blessings).toEqual([{ family: 'haste', rarity: 'rare' }]);
  });

  and("l'écran « Bénédiction 2 sur 3 » s'affiche", async () => {
    expect(await screen.findByRole('header', { name: 'Bénédiction 2 sur 3' })).toBeOnTheScreen();
  });

  let next: Ascent;

  given('le joueur a choisi la Hâte en rareté Rare', () => {
    const opening = openingWithHaste();
    next = chooseBlessing(opening, opening.blessingOffer!.indexOf('haste'));
    expect(next.blessings).toEqual([{ family: 'haste', rarity: 'rare' }]);
  });

  when("l'écran « Bénédiction 2 sur 3 » s'affiche en rareté Commune", async () => {
    await show(next);
    expect(screen.getByRole('header', { name: 'Bénédiction 2 sur 3' })).toBeOnTheScreen();
    expect(within(buttons()[0]!).getByText('◆ Commune', hidden)).toBeTruthy();
  });

  then(
    "la section « Déjà choisie » montre une pastille d'équipement Hâte, avec son icône, son nom et « ◆◆ Rare »",
    () => {
      expect(screen.getByLabelText('Déjà choisie, 1 sur 3')).toBeOnTheScreen();
      const [chip, ...others] = screen.getAllByTestId('loadout-chip', hidden);
      expect(others).toEqual([]);
      expect(wellOf(chip!).sprite).toBe(blessingIcon('haste').sprite);
      expect(textsOf(chip!)).toEqual(['Hâte', '◆◆ Rare']);
    },
  );

  and('les trois familles proposées excluent la Hâte', () => {
    expect(next.blessingOffer).toHaveLength(3);
    expect(next.blessingOffer).not.toContain('haste');
    expect(buttons().map((button) => wellOf(button).sprite)).not.toContain(
      blessingIcon('haste').sprite,
    );
  });

  given('le joueur a choisi la Hâte (Rare) puis la Vigueur (Commune)', () => {
    // Les bénédictions prises, dans l'ordre du choix : voir l'étape suivante.
  });

  when("l'écran « Bénédiction 3 sur 3 » s'affiche en rareté Épique", async () => {
    await show(
      choosing(
        ['momentum', 'edge', 'protection'],
        ['epic'],
        [
          { family: 'haste', rarity: 'rare' },
          { family: 'vigor', rarity: 'common' },
        ],
      ),
    );
    expect(screen.getByRole('header', { name: 'Bénédiction 3 sur 3' })).toBeOnTheScreen();
  });

  then(
    'la section « Déjà choisies » montre la Hâte avec « ◆◆ Rare » et la Vigueur avec « ◆ Commune »',
    () => {
      expect(screen.getByLabelText('Déjà choisies, 2 sur 3')).toBeOnTheScreen();
      expect(screen.getAllByTestId('loadout-chip', hidden).map(textsOf)).toEqual([
        ['Hâte', '◆◆ Rare'],
        ['Vigueur', '◆ Commune'],
      ]);
    },
  );

  and('chaque écrin a le trait de la couleur de sa rareté', () => {
    expect(
      screen.getAllByTestId('loadout-chip', hidden).map((chip) => wellOf(chip).style.borderColor),
    ).toEqual([roles.rarityRare, roles.rarityCommon]);
    buttons().forEach((button) => expect(wellOf(button).style.borderColor).toBe(roles.rarityEpic));
  });

  and('Élan, Tranchant et Protection sont proposés avec « ◆◆◆ Épique »', () => {
    expect(buttons().map((button) => textsOf(button).slice(0, 2))).toEqual([
      ['Élan', '◆◆◆ Épique'],
      ['Tranchant', '◆◆◆ Épique'],
      ['Protection', '◆◆◆ Épique'],
    ]);
  });

  const protection: Partial<Record<Rarity, { well: ReturnType<typeof wellOf>; texts: string[] }>> =
    {};

  given(
    'la famille Protection est proposée en Commune, puis en Épique dans une autre ascension',
    async () => {
      for (const rarity of ['common', 'epic'] as const) {
        await show(choosing(['protection', 'vigor', 'edge'], [rarity]));
        const button = buttons()[0]!;
        protection[rarity] = { well: wellOf(button), texts: textsOf(button) };
        await unmount();
      }
    },
  );

  then("l'icône affichée est la même", () => {
    const { common, epic } = protection;
    expect(common!.well.sprite).toBe('blessing-icon:protection');
    expect(epic!.well.sprite).toBe(common!.well.sprite);
    expect([epic!.well.width, epic!.well.height]).toEqual([
      common!.well.width,
      common!.well.height,
    ]);
  });

  and("seuls le trait de l'écrin, les losanges, le mot et la couleur de la rareté changent", () => {
    const { common, epic } = protection;
    expect([common!.well.style.borderColor, epic!.well.style.borderColor]).toEqual([
      roles.rarityCommon,
      roles.rarityEpic,
    ]);
    expect([common!.texts[1], epic!.texts[1]]).toEqual(['◆ Commune', '◆◆◆ Épique']);
    expect(common!.texts[0]).toBe(epic!.texts[0]);
  });

  given("le joueur n'a fait qu'une habitude hier", () => {
    // Une seule habitude faite hier : une seule bénédiction (voir l'étape suivante).
  });

  when("l'écran « Bénédiction 1 sur 1 » s'affiche", async () => {
    await show(choosing(['momentum', 'vigor', 'protection'], ['common']));
    expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 1' })).toBeOnTheScreen();
  });

  then('il montre trois boutons à icône et aucune section « Déjà choisie »', () => {
    expect(buttons().map((button) => wellOf(button).sprite)).toEqual(
      (['momentum', 'vigor', 'protection'] as const).map((family) => blessingIcon(family).sprite),
    );
    expect(screen.queryByText(/Déjà choisie/, hidden)).toBeNull();
    expect(screen.queryByTestId('loadout-chip', hidden)).toBeNull();
  });

  and(
    'une icône 16 × 16 (Élan, Vigueur) et une icône 24 × 24 (Protection) ont la même taille de 48 dp',
    () => {
      expect(
        (['momentum', 'vigor', 'protection'] as const).map((family) => BLESSING_ICONS[family].w),
      ).toEqual([16, 16, 24]);
      expect(buttons().map((button) => [wellOf(button).width, wellOf(button).height])).toEqual([
        [48, 48],
        [48, 48],
        [48, 48],
      ]);
    },
  );

  const shown: boolean[] = [];

  given("la jauge est Neutre ou en Malédiction, ou l'ascension est une reprise", () => {
    // Trois cas : jauge Neutre, jauge en Malédiction sans bénédiction, ascension reprise après les
    // bénédictions choisies (voir l'étape suivante).
  });

  when("le joueur commence ou reprend l'ascension", async () => {
    shown.length = 0;
    const cases: (() => Promise<void>)[] = [
      () => show(undefined, { gauge: 0, blessings: [] }),
      () => show(undefined, { gauge: -1, blessings: [] }),
      () =>
        show({
          ...startAscent(42, { gauge: 1, blessings: [] }),
          blessings: [{ family: 'haste', rarity: 'rare' }],
        }),
    ];
    for (const begin of cases) {
      await begin();
      expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
      shown.push(screen.queryByTestId('ascent-blessing') !== null);
      await unmount();
    }
  });

  then("l'écran de choix d'une bénédiction ne s'affiche pas, comme aujourd'hui", () => {
    expect(shown).toEqual([false, false, false]);
  });

  given('un bouton de bénédiction', async () => {
    await show(
      choosing(['haste', 'momentum', 'edge'], ['rare'], [{ family: 'vigor', rarity: 'common' }]),
    );
  });

  then("l'icône est cachée au lecteur d'écran", () => {
    expect(screen.queryAllByTestId('icon-well')).toEqual([]);
    expect(screen.getAllByTestId('icon-well', hidden)).toHaveLength(4);
  });

  and('le bouton est lu « Hâte · Rare · Initiative +2 dans chaque combat »', () => {
    expect(buttons()[0]).toHaveAccessibleName('Hâte · Rare · Initiative +2 dans chaque combat');
  });

  and("la section « Déjà choisie » est lue d'un trait comme une liste", () => {
    expect(screen.getByLabelText('Déjà choisie, 1 sur 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bénédictions de départ : Vigueur, Commune')).toBeOnTheScreen();
    expect(screen.queryByText('Vigueur')).toBeNull();
  });
};

autoBindSteps([loadFeature('features/icones-benedictions.feature')], [steps]);
