/**
 * Scénarios de « Les icônes des bienfaits dans le choix d'un bienfait et aux sorties » (#157). Le
 * choix d'un bienfait est rendu par `BoonChoicePanel`, les sorties par `AscentScreen` (avec ses
 * bénédictions de départ) ou par `ExitChoice`, avec la simulation de `SpriteCanvas` : elle expose le
 * nom, l'échelle et la taille en pixels d'art de chaque icône.
 *
 * Correspondance des libellés :
 * - « l'icône de N dp » : la taille rendue, pixels d'art × `artPixelSize(échelle)`, à la densité 3 ;
 * - « un écrin de N dp » : le côté de l'`IconWell` ; « doublé » : son trait d'encre intérieur ;
 * - « une pastille d'équipement » : une `LoadoutChip` (`loadout-chip`) ; un rang : `loadout-chip-row` ;
 * - « les données validées » : la constante `ICONS` de la maquette validée v2, identique à l'Atelier
 *   le 30/10/2026 (notes de l'Architect sur #157), l'entrée `aegis` étant la famille `protection`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { Dimensions, PixelRatio, StyleSheet } from 'react-native';

import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { BLESSING_FAMILIES, type BlessingFamily } from '../../src/domain/ascent/blessings';
import { BOON_KINDS, type BoonKind } from '../../src/domain/ascent/boons';
import type { Exit } from '../../src/domain/ascent/exits';
import { BoonChoicePanel } from '../../src/adapters/ui/battle/BoonChoicePanel';
import { ExitChoice } from '../../src/adapters/ui/components/ExitChoice';
import { BOON_NAMES } from '../../src/adapters/ui/format/boonText';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { artPixelSize } from '../../src/adapters/ui/pixelArt/artPixel';
import { BLESSING_ICONS } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/blessingIcons';
import { BOON_ICONS } from '../../src/adapters/ui/pixelArt/sprites/atelier/data/boonIcons';
import type { AssetImage } from '../../src/adapters/ui/pixelArt/sprites/atelier/fullAnimation';
import { boonIcon, iconScale } from '../../src/adapters/ui/pixelArt/sprites/gameIcons';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;
const OFFER = ['perfectEcho', 'lingeringFrost', 'emberHeart'] as const;
const FIVE: readonly BoonKind[] = [
  'perfectEcho',
  'lingeringFrost',
  'shatteringEmber',
  'blazingEmber',
  'emberHeart',
];
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 2 },
  { kind: 'elite', groupSize: 1 },
  { kind: 'campfire', groupSize: null },
];
const MOCKUP = path.join(__dirname, '../../docs/mockups/153-boon-blessing-icons/index.html');
/** L'entrée de l'Atelier (et de la maquette) de chaque famille de bénédiction. */
const ATELIER_BLESSINGS: Readonly<Record<BlessingFamily, string>> = {
  vigor: 'vigor',
  momentum: 'momentum',
  edge: 'edge',
  protection: 'aegis',
  haste: 'haste',
};

type Element = ReturnType<typeof screen.getByTestId>;

/** Le pixel physique d'un écran de densité `density`. */
function atDensity(density: number) {
  jest
    .spyOn(PixelRatio, 'roundToNearestPixel')
    .mockImplementation((size) => Math.round(size * density) / density);
}

/** L'écrin d'un élément, et le nom, l'échelle et la taille rendue de son icône. */
function wellOf(element: Element) {
  const well = within(element).getByTestId('icon-well', hidden);
  const icon = within(well).getByTestId('icon-well-icon', hidden).props as {
    sprite: string;
    scale: 2 | 3 | 4 | 6;
    pixelWidth: number;
    pixelHeight: number;
  };
  return {
    well,
    style: StyleSheet.flatten(well.props.style),
    sprite: icon.sprite,
    scale: icon.scale,
    width: icon.pixelWidth * artPixelSize(icon.scale),
    height: icon.pixelHeight * artPixelSize(icon.scale),
  };
}

function card(name: string): Element {
  return screen.getByRole('radio', { name: new RegExp(`^${name}`) });
}

function chipNames(): string[] {
  return screen
    .getAllByTestId('loadout-chip', hidden)
    .map((chip) => within(chip).getAllByText(/./, hidden)[0]!.props.children as string);
}

function setFontScale(fontScale: number) {
  Dimensions.set({
    window: { ...Dimensions.get('window'), fontScale },
    screen: { ...Dimensions.get('screen'), fontScale },
  });
}

async function showExits(saved: Ascent) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={() => {}}
    />,
    setUp.dependencies,
  );
}

/** Une ascension entre deux étages : les sorties, avec ces bienfaits et ces bénédictions. */
function between(boons: readonly BoonKind[]): Ascent {
  const ascent = startAscent(42);
  return {
    ...ascent,
    encounter: null,
    exits: DOORS,
    lastGold: 10,
    gold: 10,
    blessings: [{ family: 'haste', rarity: 'rare' }],
    hero: { ...ascent.hero, boons },
  };
}

/** La constante `ICONS` de la maquette validée. */
function mockupIcons(): Readonly<Record<string, AssetImage>> {
  const html = readFileSync(MOCKUP, 'utf8');
  const json = /const ICONS=(\{.*?\});\n/.exec(html)?.[1];
  if (json === undefined) throw new Error('The mockup has no ICONS');
  return JSON.parse(json) as Record<string, AssetImage>;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => atDensity(3));
  afterEach(() => jest.restoreAllMocks());

  given("le joueur vient de gagner un combat qui n'est pas celui du boss", () => {
    // Le choix d'un bienfait ne s'ouvre qu'après un combat gagné qui n'est pas celui du boss (#92).
  });

  and(
    "l'écran « Choisis un bienfait » propose Écho parfait, Givre persistant et Cœur de braise",
    async () => {
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
      expect(screen.getByRole('header', { name: 'Choisis un bienfait' })).toBeOnTheScreen();
    },
  );

  then("chaque carte montre à gauche l'icône de bienfait de 48 dp, dans un écrin de 56 dp", () => {
    const cards = screen.getAllByRole('radio');
    expect(cards.map((element) => wellOf(element).sprite)).toEqual(
      OFFER.map((kind) => boonIcon(kind).sprite),
    );
    cards.forEach((element) => {
      const { style, width, height } = wellOf(element);
      expect([style.width, style.height, width, height]).toEqual([56, 56, 48, 48]);
      // À gauche : la carte est une rangée, l'écrin avant la colonne des textes.
      const well = within(element).getByTestId('icon-well', hidden);
      const row = well.parent!;
      const texts = within(element).getAllByText(/./)[0]!.parent!;
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row' });
      expect(row.children.indexOf(well)).toBeLessThan(row.children.indexOf(texts));
    });
  });

  and("le trait de l'écrin a la couleur de la rareté du bienfait", () => {
    expect(
      screen.getAllByRole('radio').map((element) => wellOf(element).style.borderColor),
    ).toEqual([roles.rarityCommon, roles.rarityRare, roles.rarityEpic]);
  });

  and("la carte garde, dans cet ordre, « ◆◆ Givre · Rare », le nom et l'effet", () => {
    expect(
      within(card('Givre persistant'))
        .getAllByText(/./)
        .map((text) => text.props.children),
    ).toEqual([
      '◆◆ Givre · Rare',
      'Givre persistant',
      'Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
    ]);
  });

  and("« Prendre » reste inactif tant qu'aucune carte n'est choisie", () => {
    expect(screen.getByRole('button', { name: 'Prendre' })).toBeDisabled();
  });

  given("l'écran « Choisis un bienfait »", async () => {
    await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
  });

  when('le joueur touche la carte Givre persistant', async () => {
    await fireEvent.press(card('Givre persistant'));
  });

  then("la carte prend un cadre d'or, une coche et un nom en or", () => {
    const chosen = card('Givre persistant');
    expect(chosen).toBeChecked();
    expect(within(chosen).getByTestId('boon-tick', hidden)).toBeTruthy();
    expect(within(chosen).getByText('Givre persistant')).toHaveStyle({ color: roles.gold });
    const frame = within(chosen).getAllByTestId('pixel-frame-light', hidden)[0]!.parent!;
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({ borderColor: roles.gold });
  });

  and('son écrin garde le trait de la rareté Rare', () => {
    expect(wellOf(card('Givre persistant')).style.borderColor).toBe(roles.rarityRare);
  });

  and("« Prendre » s'active", () => {
    expect(screen.getByRole('button', { name: 'Prendre' })).toBeEnabled();
  });

  given('le joueur a choisi Givre persistant', async () => {
    await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
    await fireEvent.press(card('Givre persistant'));
  });

  when('il touche « Prendre »', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
  });

  then(
    "l'écran « Bienfait obtenu. » montre l'icône de Givre persistant à 96 dp, dans un écrin doublé au trait de la rareté",
    () => {
      const obtained = screen.getByTestId('boon-obtained');
      const { well, style, sprite, width, height } = wellOf(obtained);
      expect(sprite).toBe('boon-icon:lingeringFrost');
      expect([width, height]).toEqual([96, 96]);
      expect(style).toMatchObject({ width: 112, height: 112, borderColor: roles.rarityRare });
      expect(within(well).getByTestId('icon-well-double', hidden)).toBeTruthy();
    },
  );

  and("la rareté, le nom, l'effet et « Continuer » restent affichés", () => {
    expect(screen.getByText('◆◆ Givre · Rare')).toBeTruthy();
    expect(screen.getByText('Givre persistant')).toBeTruthy();
    expect(
      screen.getByText('Un ennemi étourdi se relève avec la moitié de sa garde seulement.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeOnTheScreen();
  });

  and(
    "le lecteur d'écran annonce « Bienfait obtenu : Givre persistant, Givre, Rare » suivi de l'effet",
    () => {
      expect(
        screen.getByLabelText(
          'Bienfait obtenu : Givre persistant, Givre, Rare. Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
        ),
      ).toBeOnTheScreen();
    },
  );

  given('le joueur a gagné Écho parfait puis Givre persistant', () => {
    // Les bienfaits gagnés, dans l'ordre, et une bénédiction de départ (Hâte) : voir `between`.
  });

  when("l'écran « Choisis ta sortie » s'affiche", async () => {
    await showExits(between(['perfectEcho', 'lingeringFrost']));
    expect(await screen.findByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
  });

  then(
    "la section « Bienfaits » montre une pastille d'équipement par bienfait, dans l'ordre où ils ont été gagnés",
    () => {
      expect(screen.getByText('Bienfaits', hidden)).toBeTruthy();
      expect(chipNames()).toEqual(['Écho parfait', 'Givre persistant']);
    },
  );

  and(
    "chaque pastille montre l'icône dans un écrin de 52 dp, le nom et la rareté (« ◆ Commun », « ◆◆ Rare »)",
    () => {
      const chips = screen.getAllByTestId('loadout-chip', hidden);
      expect(chips.map((chip) => wellOf(chip).style.width)).toEqual([52, 52]);
      expect(chips.map((chip) => wellOf(chip).width)).toEqual([48, 48]);
      expect(within(chips[0]!).getByText('◆ Commun', hidden)).toBeTruthy();
      expect(within(chips[1]!).getByText('◆◆ Rare', hidden)).toBeTruthy();
    },
  );

  and('les pastilles sont rangées sur 2 colonnes', () => {
    const rows = screen.getAllByTestId('loadout-chip-row', hidden);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getAllByTestId('loadout-chip', hidden)).toHaveLength(2);
  });

  and("les bénédictions de départ ne s'y affichent pas", () => {
    expect(screen.queryByText('Hâte', hidden)).toBeNull();
    expect(
      screen
        .getAllByTestId('icon-well-icon', hidden)
        .filter((icon) => String(icon.props.sprite).startsWith('blessing-icon:')),
    ).toEqual([]);
  });

  and('les portes restent à leur place', () => {
    expect(DOORS.map((_, index) => screen.getByTestId(`ascent-exit-${index}`))).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Combat · 2 ennemis' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Feu de camp · soin de 40 % des PV' }),
    ).toBeOnTheScreen();
  });

  given('le joueur ne possède aucun bienfait', () => {
    // Cas de secours : l'étage 1 donne toujours un bienfait (maquette, 2B).
  });

  when("l'écran des sorties s'affiche", async () => {
    await showExits(between([]));
    expect(await screen.findByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
  });

  then('la section « Bienfaits » affiche le texte « Aucun bienfait »', () => {
    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
  });

  and("aucune pastille vide n'est affichée", () => {
    expect(screen.queryByTestId('loadout-chip', hidden)).toBeNull();
  });

  given('le joueur possède 5 bienfaits, le maximum', () => {
    // Cinq bienfaits : le choix n'en propose plus que 2 au dernier étage (#92).
  });

  when("l'écran « Dernière porte » s'affiche", async () => {
    await render(
      <ExitChoice boons={FIVE} exits={[{ kind: 'boss', groupSize: null }]} onChoose={jest.fn()} />,
    );
    expect(screen.getByRole('header', { name: 'Dernière porte' })).toBeOnTheScreen();
  });

  then('les 5 pastilles tiennent sur 2 colonnes et 3 rangs', () => {
    const rows = screen.getAllByTestId('loadout-chip-row', hidden);
    expect(rows.map((row) => within(row).getAllByTestId('loadout-chip', hidden).length)).toEqual([
      2, 2, 1,
    ]);
    expect(chipNames()).toEqual(FIVE.map((kind) => BOON_NAMES[kind]));
  });

  and('un nom long passe à la ligne dans sa pastille, sans être coupé', () => {
    const name = screen.getByText('Cœur de braise', hidden);
    expect(name.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(name.parent?.props.style)).toMatchObject({ flex: 1 });
  });

  and('la porte du boss reste visible sans défilement', () => {
    // Vérifié sur la capture end-to-end 2D (barrière 10 bis) ; ici, la porte suit les pastilles.
    expect(screen.getByRole('button', { name: 'Affronter le boss' })).toBeOnTheScreen();
  });

  given('Écho parfait a une icône de 16 × 16 et Givre persistant une icône de 24 × 24', () => {
    expect([BOON_ICONS.perfectEcho.w, BOON_ICONS.perfectEcho.h]).toEqual([16, 16]);
    expect([BOON_ICONS.lingeringFrost.w, BOON_ICONS.lingeringFrost.h]).toEqual([24, 24]);
  });

  then("les deux s'affichent à 48 dp, à ×3 et à ×2", async () => {
    await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
    const [echo, frost] = [wellOf(card('Écho parfait')), wellOf(card('Givre persistant'))];
    expect([echo.scale, echo.width, frost.scale, frost.width]).toEqual([3, 48, 2, 48]);
  });

  and('à 96 dp, à ×6 et à ×4', () => {
    expect([
      iconScale(BOON_ICONS.perfectEcho, 96),
      iconScale(BOON_ICONS.lingeringFrost, 96),
    ]).toEqual([6, 4]);
  });

  and(
    "chaque pixel d'art reste entier et carré : jamais rogné, jamais étiré, jamais d'échelle fractionnaire",
    () => {
      [...Object.values(BOON_ICONS), ...Object.values(BLESSING_ICONS)].forEach((image) => {
        expect(image.w).toBe(image.h);
        for (const dp of [48, 96]) {
          expect(Number.isInteger(iconScale(image, dp))).toBe(true);
        }
        expect(() => iconScale(image, 32 + image.w / 8)).toThrow();
      });
      for (const density of [2, 2.625, 2.75]) {
        atDensity(density);
        for (const scale of [2, 3, 4, 6] as const) {
          const physical = artPixelSize(scale) * density;
          expect(physical).toBeCloseTo(Math.round(physical), 9);
        }
      }
    },
  );

  given("les 12 icônes au statut « validé » dans l'Atelier de l'ascension le 30/10/2026", () => {
    expect(Object.keys(mockupIcons())).toHaveLength(12);
  });

  then(
    'les 7 icônes de bienfait et les 5 icônes de bénédiction du jeu sont identiques, pixel pour pixel, à leurs données validées',
    () => {
      const validated = mockupIcons();
      BOON_KINDS.forEach((kind) => expect(BOON_ICONS[kind]).toEqual(validated[kind]));
      BLESSING_FAMILIES.forEach((family) =>
        expect(BLESSING_ICONS[family]).toEqual(validated[ATELIER_BLESSINGS[family]]),
      );
    },
  );

  and("les 3 raretés d'une même famille de bénédiction partagent la même icône", () => {
    // Une seule entrée par famille, dans le jeu comme dans les données validées : la rareté n'y
    // entre pas.
    expect(Object.keys(BLESSING_ICONS).sort()).toEqual([...BLESSING_FAMILIES].sort());
    const validated = Object.keys(mockupIcons()).filter(
      (id) => !(BOON_KINDS as readonly string[]).includes(id),
    );
    expect(validated.sort()).toEqual(Object.values(ATELIER_BLESSINGS).sort());
  });

  given("une carte de bienfait ou une pastille d'équipement", async () => {
    await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
  });

  then("l'icône est cachée au lecteur d'écran", async () => {
    expect(screen.queryAllByTestId('icon-well')).toEqual([]);
    expect(screen.getAllByTestId('icon-well', hidden)).toHaveLength(3);
    await act(async () => {
      screen.unmount();
    });
    await render(
      <ExitChoice boons={['perfectEcho', 'lingeringFrost']} exits={DOORS} onChoose={jest.fn()} />,
    );
    expect(screen.queryAllByTestId('icon-well')).toEqual([]);
    expect(screen.getAllByTestId('icon-well', hidden)).toHaveLength(2);
  });

  and(
    "le texte lu de la carte ne change pas : « Givre persistant, Givre, Rare » suivi de l'effet",
    async () => {
      await act(async () => {
        screen.unmount();
      });
      await render(<BoonChoicePanel offer={OFFER} onChoose={jest.fn()} />);
      expect(card('Givre persistant')).toHaveAccessibleName(
        'Givre persistant, Givre, Rare. Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
      );
    },
  );

  and(
    "la grille des sorties est lue d'un trait : « Bienfaits : Écho parfait, Commun ; Givre persistant, Rare »",
    async () => {
      await act(async () => {
        screen.unmount();
      });
      await render(
        <ExitChoice boons={['perfectEcho', 'lingeringFrost']} exits={DOORS} onChoose={jest.fn()} />,
      );
      expect(
        screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
      ).toBeOnTheScreen();
      expect(screen.queryByText('Écho parfait')).toBeNull();
    },
  );

  given('le joueur a agrandi le texte de son téléphone', () => {
    setFontScale(1.3);
  });

  when("l'écran des sorties montre plusieurs bienfaits", async () => {
    await render(<ExitChoice boons={FIVE} exits={DOORS} onChoose={jest.fn()} />);
  });

  then('les noms passent à la ligne dans la pastille', () => {
    screen
      .getAllByTestId('loadout-chip', hidden)
      .forEach((chip) =>
        expect(within(chip).getAllByText(/./, hidden)[0]!.props.numberOfLines).toBeUndefined(),
      );
  });

  and("si le texte ne tient plus, la grille passe à 1 colonne et l'écran défile", () => {
    expect(screen.getAllByTestId('loadout-chip-row', hidden)).toHaveLength(FIVE.length);
    // La grille est dans le défilement des sorties.
    let node: Element | null = screen.getByTestId('loadout-chip-grid');
    while (node !== null && node.type !== 'RCTScrollView') node = node.parent;
    expect(node).not.toBeNull();
  });

  and("l'icône reste à 48 dp", () => {
    screen
      .getAllByTestId('loadout-chip', hidden)
      .forEach((chip) => expect(wellOf(chip).width).toBe(48));
  });
};

autoBindSteps([loadFeature('features/icones-bienfaits.feature')], [steps]);
