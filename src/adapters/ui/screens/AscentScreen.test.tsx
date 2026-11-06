import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions } from 'react-native';

import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { ItemKind } from '../../../domain/ascent/items';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import type { AssetImage } from '../pixelArt/sprites/atelier/fullAnimation';
import { ascentSetUp } from '../testing/ascent';
import { lootState } from '../testing/lootState';
import { renderScreen } from '../testing/renderScreen';
import { spyBattles, winShownBattle } from '../testing/winShownBattle';
import { AscentScreen, RESUME_COUNTDOWN_S } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));
// Les images validées, dans une copie qu'un test peut vider : tous les objets ont aujourd'hui leur
// image, mais un objet futur du Codex peut arriver sans (#137).
jest.mock('../pixelArt/sprites/atelier/data/itemImages', () => ({
  ITEM_IMAGES: {
    ...jest.requireActual<{ ITEM_IMAGES: object }>('../pixelArt/sprites/atelier/data/itemImages')
      .ITEM_IMAGES,
  },
}));

function visibility() {
  let listener: ((visible: boolean) => void) | null = null;
  return {
    onChange: (next: (visible: boolean) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
    set: async (visible: boolean) => {
      await act(async () => {
        listener?.(visible);
      });
    },
  };
}

async function show(
  saved: Ascent,
  prepare?: (session: ReturnType<typeof ascentSetUp>['session']) => Promise<void>,
) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await prepare?.(setUp.session);
  const onLeave = jest.fn();
  const app = visibility();
  const rendered = await renderScreen(
    <AscentScreen session={setUp.session} visibility={app} onLeave={onLeave} />,
    setUp.dependencies,
  );
  return { ...setUp, onLeave, app, rendered };
}

const between = (ascent: Ascent, exits: Ascent['exits'], lastGold = 0): Ascent => ({
  ...ascent,
  encounter: null,
  exits,
  lastGold,
  gold: lastGold,
});

describe('AscentScreen', () => {
  it('shows the floor battle, with the floor, HP and Gold', async () => {
    await show(startAscent(42));

    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(
      'Palier 1 · Étage 1 sur 6 · 80/80 PV · 0 Or',
    );
  });

  it('offers the exits after a floor, the Combat door announcing the group size', async () => {
    const { session } = await show(
      between(
        startAscent(42),
        [
          { kind: 'combat', groupSize: 4 },
          { kind: 'campfire', groupSize: null },
        ],
        9,
      ),
    );

    expect(screen.getByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
    expect(screen.getByText('Étage franchi · +9 Or')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Combat · 4 ennemis' }));

    expect(session.current()?.encounter?.enemies).toHaveLength(4);
    expect(await screen.findByRole('header', { name: 'Étage 2' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/\+1 en réserve$/);
  });

  it('announces the Rare item behind the Elite door, then enters the Elite battle (#120)', async () => {
    const { session } = await show(
      between(startAscent(42), [
        { kind: 'combat', groupSize: 3 },
        { kind: 'elite', groupSize: null },
      ]),
    );

    expect(screen.getByTestId('ascent-exits')).toHaveStyle({
      backgroundColor: artPalette.roles.night,
    });
    const elite = screen.getByRole('button', {
      name: 'Élite · objet Rare garanti · coffre scellé',
    });
    expect(elite).toHaveTextContent('Élite · objet Rare garanti · coffre scellé', { exact: true });
    expect(screen.queryByText(/Chevalier déchu|Jumeaux/u)).toBeNull();
    fireEvent.press(elite);

    expect(session.current()?.encounter?.kind).toBe('elite');
    expect(await screen.findByRole('header', { name: 'Étage 2' })).toBeOnTheScreen();
  });

  it('shows « Pause » as a pixel button of 48 dp at least (#120)', async () => {
    await show(between(startAscent(42), [{ kind: 'campfire', groupSize: null }]));

    const pause = screen.getByTestId('ascent-pause');
    expect(pause).toHaveAccessibleName('Pause');
    expect(pause).toHaveStyle({ minHeight: MIN_TARGET_SIZE });
  });

  it('shows the last door before the boss', async () => {
    await show(between({ ...startAscent(42), floor: 5 }, [{ kind: 'boss', groupSize: null }]));

    expect(screen.getByRole('header', { name: 'Dernière porte' })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Affronter le boss' }));
    expect(await screen.findByRole('header', { name: 'Le boss' })).toBeOnTheScreen();
  });

  it('pauses on Pause, and when the app goes to the background, then counts down 3 s before resuming', async () => {
    jest.useFakeTimers();
    try {
      const { session, app, onLeave } = await show(startAscent(42), async (current) => {
        await current.battleSession().start();
      });

      expect(screen.getByTestId('ascent-countdown')).toHaveTextContent(
        `Reprise dans${RESUME_COUNTDOWN_S}`,
      );
      for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
        });
      }
      expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();

      await app.set(false);
      expect(screen.queryByRole('header', { name: 'Étage 1' })).not.toBeOnTheScreen();
      await app.set(true);
      expect(screen.getByTestId('ascent-countdown')).toBeOnTheScreen();

      fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(session.resuming()).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the end of the ascent, the Gold being lost, and goes back to the tower foot', async () => {
    const { session, onLeave } = await show({ ...startAscent(42), gold: 30, floor: 3 });
    await act(async () => {
      session.abandon();
    });

    expect(screen.getByRole('header', { name: "Fin de l'ascension" })).toBeOnTheScreen();
    expect(screen.getByText('La Sentinelle est tombée au palier 1, étage 3.')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-end-lost')).toHaveTextContent(/^L'Or \(30 Or\)/);
    fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));

    expect(session.current()).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows the Summit reached for a victory (#38)', async () => {
    await show({ ...startAscent(42), outcome: 'victory', encounter: null, gold: 80 });

    expect(screen.getByRole('header', { name: 'Sommet atteint' })).toBeOnTheScreen();
  });

  it('offers 3 boons after a won battle, then the exits with the owned boons (#92)', async () => {
    const offered = {
      ...between(startAscent(42), [{ kind: 'campfire', groupSize: null }], 8),
      boonOffer: ['perfectEcho', 'frostSkin', 'emberHeart'] as const,
    };
    const { session } = await show(offered);

    expect(await screen.findByText('Étage franchi · +8 Or')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /^Peau de givre/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    });

    expect(session.current()?.hero.boons).toEqual(['frostSkin']);
    expect(await screen.findByLabelText('Bienfaits : Peau de givre, Commun')).toBeOnTheScreen();
  });

  it('rerolls the offer with a reroll of the favor, and shows the new offer (#42)', async () => {
    const ascent = startAscent(42, { gauge: 2 });
    const { session } = await show({
      ...between(ascent, [{ kind: 'campfire', groupSize: null }], 8),
      boonOffer: ['perfectEcho', 'frostSkin', 'trueEdge'],
    });

    await act(async () => {
      fireEvent.press(await screen.findByRole('button', { name: "Relancer l'offre, 2 relances" }));
    });

    const rerolled = session.current()!;
    expect(rerolled.rerolls).toBe(1);
    expect(rerolled.boonOffer).not.toContain('perfectEcho');
    expect(screen.getByRole('button', { name: "Relancer l'offre, 1 relance" })).toBeEnabled();
    expect(screen.getByText('Nouvelle offre. Il te reste 1 relance.')).toBeOnTheScreen();
  });

  it('offers Second souffle alone with the HP of the hero, then heals him (#212)', async () => {
    const ascent = startAscent(42);
    const { session } = await show({
      ...between(ascent, [{ kind: 'campfire', groupSize: null }], 8),
      hero: { ...ascent.hero, hp: 40, maxHp: 80 },
      boonOffer: ['secondBreath'],
    });

    expect(await screen.findByRole('header', { name: 'Reprends ton souffle' })).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', {
        name: "Second souffle : rend 8 PV, de 40 à 48 PV sur 80. Ce n'est pas un bienfait.",
      }),
    ).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    expect(screen.getByLabelText('PV rendus : Second souffle, 8 PV. PV 48 sur 80.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    });

    expect(session.current()?.hero).toMatchObject({ hp: 48, boons: [] });
    expect(await screen.findByTestId('ascent-exit-0')).toBeOnTheScreen();
  });

  it('shows the owned boons in chips at the exits, in the order won, without the starting blessings (#157)', async () => {
    const ascent = startAscent(42);
    await show({
      ...between(ascent, [{ kind: 'combat', groupSize: 2 }]),
      blessings: [{ family: 'haste', rarity: 'rare' }],
      hero: { ...ascent.hero, boons: ['perfectEcho', 'lingeringFrost'] },
    });

    expect(
      await screen.findByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId('loadout-chip', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByText('Hâte', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('ascent-exit-0')).toBeOnTheScreen();
  });

  it('writes « Aucun bienfait » at the exits, without an empty chip (#157)', async () => {
    await show(between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]));

    expect(await screen.findByText('Aucun bienfait')).toBeOnTheScreen();
    expect(screen.queryByTestId('loadout-chip', { includeHiddenElements: true })).toBeNull();
  });
});

describe('AscentScreen with blessings and found items (#93)', () => {
  it('offers the starting blessings one after the other, before the first battle', async () => {
    const { session } = await show(startAscent(42, { gauge: -1, blessings: ['epic', 'rare'] }));

    expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 2' })).toBeOnTheScreen();
    const family = session.current()!.blessingOffer![0]!;
    fireEvent.press(screen.getByTestId('blessing-0'));

    expect(session.current()!.blessings).toEqual([{ family, rarity: 'epic' }]);
    expect(await screen.findByRole('header', { name: 'Bénédiction 2 sur 2' })).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('blessing-2'));

    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
  });

  it('shows the blessing already chosen in a chip on the next choice (#158)', async () => {
    const { session } = await show(startAscent(42, { gauge: -1, blessings: ['epic', 'rare'] }));
    const family = session.current()!.blessingOffer![1]!;

    fireEvent.press(screen.getByTestId('blessing-1'));

    expect(await screen.findByRole('header', { name: 'Bénédiction 2 sur 2' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Déjà choisie, 1 sur 2')).toBeOnTheScreen();
    const chip = screen.getByTestId('loadout-chip', { includeHiddenElements: true });
    expect(
      within(chip).getByTestId('icon-well-icon', { includeHiddenElements: true }).props.sprite,
    ).toBe(`blessing-icon:${family}`);
    expect(within(chip).getByText('◆◆◆ Épique', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('ascent-status')).toBeOnTheScreen();
  });

  it('shows a found item compared to the worn one, and equips it', async () => {
    const { session } = await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'axe',
    });

    expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
    expect(
      screen.getByText('Hache rouillée · Arme · Commun · Brise-garde ×1,1 · Initiative −1'),
    ).toBeOnTheScreen();
    // L'image validée dans l'Atelier (#119), 24 × 24 pixels d'art à 3 dp : 72 dp.
    const image = screen.getByTestId('item-image', { includeHiddenElements: true });
    expect(image).toHaveProp('sprite', 'item-axe');
    expect(image).toHaveProp('scale', 3);
    expect(image).toHaveProp('pixelWidth', 24);
    expect(image).toHaveProp('pixelHeight', 24);
    expect(screen.queryByTestId('item-silhouette', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Tu portes : Épée courte · Initiative 0')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Équiper' }));

    expect(session.current()!.equipment.weapon).toBe('axe');
    expect(await screen.findByRole('header', { name: 'Choisis ta sortie' })).toBeOnTheScreen();
  });

  it('shows the validated image of the Crossbow, with its name and numbers (#119)', async () => {
    await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'crossbow',
    });

    expect(screen.getByTestId('item-image', { includeHiddenElements: true })).toHaveProp(
      'sprite',
      'item-crossbow',
    );
    expect(screen.getByText('Arbalète · Arme · Rare · Initiative +1')).toBeOnTheScreen();
  });

  it('shows the Flamberge with its image, its description and « ◆◆◆ Épique » in the Epic colour (#195)', async () => {
    await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'flamberge',
    });

    expect(screen.getByTestId('item-image', { includeHiddenElements: true })).toHaveProp(
      'sprite',
      'item-flamberge',
    );
    expect(screen.getByText('◆◆◆ Épique')).toHaveStyle({ color: artPalette.roles.rarityEpic });
    expect(
      screen.getByText(
        'Flamberge · Arme · Épique · Attaque +10 %, Frappe parfaite +0,3 · Initiative 0',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Une épée à lame ondulée, trempée dans la flamme du camp. Le Gardien dit qu'elle a appartenu à quelqu'un qui est monté très haut. Elle ne pèse rien quand le geste est juste.",
      ),
    ).toBeOnTheScreen();
  });

  it('has no rarity line for a Common or a Rare item (#195)', async () => {
    await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'watchBell',
    });

    expect(screen.getByTestId('item-image', { includeHiddenElements: true })).toHaveProp(
      'sprite',
      'item-watchBell',
    );
    expect(screen.queryByText(/◆/)).toBeNull();
  });

  it('shows the validated image of the Fallen knight armor, with its description and its numbers (#137, #152)', async () => {
    await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'blackKnightArmor',
    });

    const image = screen.getByTestId('item-image', { includeHiddenElements: true });
    expect(image).toHaveProp('sprite', 'item-blackKnightArmor');
    expect(image).toHaveProp('scale', 3);
    expect(image).toHaveProp('pixelWidth', 24);
    expect(image).toHaveProp('pixelHeight', 24);
    expect(screen.queryByTestId('item-silhouette', { includeHiddenElements: true })).toBeNull();
    expect(
      screen.getByText(
        "L'armure d'un chevalier déchu. Trouvée dans une salle jadis emplie d'écuyers.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Armure de chevalier déchu · Armure · Rare · Réduction des dégâts +20 points, Attaque +5 % · Initiative −2',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Tu portes : Cuirasse cabossée · Initiative 0')).toBeOnTheScreen();
  });

  it('shows an item without a validated image in the silhouette of its slot', async () => {
    const images = ITEM_IMAGES as Partial<Record<ItemKind, AssetImage>>;
    const armor = images.blackKnightArmor!;
    delete images.blackKnightArmor;
    try {
      await show({
        ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
        foundItem: 'blackKnightArmor',
      });

      expect(screen.getByTestId('item-silhouette', { includeHiddenElements: true })).toHaveProp(
        'sprite',
        'item-silhouette-armor',
      );
      expect(screen.queryByTestId('item-image', { includeHiddenElements: true })).toBeNull();
      expect(
        screen.getByText(
          "L'armure d'un chevalier déchu. Trouvée dans une salle jadis emplie d'écuyers.",
        ),
      ).toBeOnTheScreen();
    } finally {
      images.blackKnightArmor = armor;
    }
  });

  it('loses a left item and keeps the equipment', async () => {
    const { session } = await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'hasteAmulet',
    });

    expect(screen.getByText('Tu portes : Aucun accessoire')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));

    expect(session.current()).toMatchObject({ foundItem: null, equipment: { accessory: null } });
  });
});

describe('AscentScreen with the loadout button (#159)', () => {
  const MAX_BLESSINGS: Ascent['blessings'] = [
    { family: 'protection', rarity: 'epic' },
    { family: 'haste', rarity: 'rare' },
    { family: 'vigor', rarity: 'common' },
  ];
  const MAX_BOONS: Ascent['hero']['boons'] = [
    'perfectEcho',
    'lingeringFrost',
    'shatteringEmber',
    'blazingEmber',
    'emberHeart',
  ];
  const MAX_LABEL = 'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste';

  function withLoadout(
    ascent: Ascent,
    blessings: Ascent['blessings'],
    boons: Ascent['hero']['boons'],
  ): Ascent {
    return { ...ascent, blessings, hero: { ...ascent.hero, boons } };
  }

  const exits = (ascent: Ascent) => between(ascent, [{ kind: 'combat', groupSize: 2 }]);

  it.each([
    [
      'the choice of a blessing',
      'ascent-blessing',
      withLoadout(startAscent(42, { gauge: -1, blessings: ['epic'] }), MAX_BLESSINGS, MAX_BOONS),
    ],
    [
      'the choice of a boon',
      'ascent-boons',
      {
        ...exits(withLoadout(startAscent(42), MAX_BLESSINGS, MAX_BOONS)),
        boonOffer: ['frostSkin', 'trueEdge', 'emberHeart'] as const,
      },
    ],
    [
      'the found item',
      'ascent-item',
      {
        ...exits(withLoadout(startAscent(42), MAX_BLESSINGS, MAX_BOONS)),
        foundItem: 'axe' as const,
      },
    ],
    ['the exits', 'ascent-exits', exits(withLoadout(startAscent(42), MAX_BLESSINGS, MAX_BOONS))],
  ])('shows « Équipement » and its number next to « Pause » on %s', async (_, testID, saved) => {
    await show(saved);

    expect(screen.getByTestId(testID)).toBeOnTheScreen();
    const button = screen.getByTestId('ascent-loadout');
    expect(button).toHaveAccessibleName(MAX_LABEL);
    expect(button).toHaveStyle({ minHeight: MIN_TARGET_SIZE });
    expect(within(button).getByText('8', { includeHiddenElements: true })).toBeTruthy();
    const header = screen.getAllByRole('button').map((element) => element.props.testID);
    expect(header.indexOf('ascent-loadout')).toBe(header.indexOf('ascent-pause') - 1);
  });

  it('has no loadout button on the end of the ascent', async () => {
    await show({ ...startAscent(42), outcome: 'victory', encounter: null });

    expect(screen.queryByTestId('ascent-loadout')).toBeNull();
  });

  it('opens the sheet out of combat without pausing, the chosen card staying chosen, and gives the focus back', async () => {
    const { session } = await show({
      ...exits(withLoadout(startAscent(42), [{ family: 'haste', rarity: 'rare' }], [])),
      boonOffer: ['perfectEcho', 'frostSkin', 'emberHeart'],
    });
    const pause = jest.spyOn(session, 'pause');
    await fireEvent.press(screen.getByRole('radio', { name: /^Peau de givre/ }));

    await fireEvent.press(screen.getByTestId('ascent-loadout'));

    expect(screen.getByRole('header', { name: 'Équipement' })).toBeOnTheScreen();
    expect(screen.queryByText('Combat en pause')).toBeNull();
    expect(pause).not.toHaveBeenCalled();
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    focus.mockClear();

    await fireEvent(screen.getByTestId('loadout-sheet'), 'requestClose');

    expect(screen.queryByRole('header', { name: 'Équipement' })).toBeNull();
    expect(screen.queryByTestId('ascent-countdown')).toBeNull();
    expect(screen.getByRole('radio', { name: /^Peau de givre/ })).toBeChecked();
    expect(focus.mock.calls[0]?.[0]).toMatchObject({ props: { testID: 'ascent-loadout' } });
    expect(pause).not.toHaveBeenCalled();
  });

  it('counts one more on the screen after the boon is taken', async () => {
    await show({
      ...exits(
        withLoadout(
          startAscent(42),
          [{ family: 'haste', rarity: 'rare' }],
          ['perfectEcho', 'lingeringFrost'],
        ),
      ),
      boonOffer: ['frostSkin', 'trueEdge', 'emberHeart'],
    });
    const count = () =>
      within(screen.getByTestId('ascent-loadout')).getByTestId('loadout-count', {
        includeHiddenElements: true,
      });
    expect(count()).toHaveTextContent('3');

    await fireEvent.press(screen.getByRole('radio', { name: /^Peau de givre/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    expect(count()).toHaveTextContent('3');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    });

    expect(await screen.findByTestId('ascent-exits')).toBeOnTheScreen();
    expect(count()).toHaveTextContent('4');
    await fireEvent.press(screen.getByTestId('ascent-loadout'));
    expect(screen.getAllByTestId('loadout-row').map((row) => row.props.accessibilityLabel)).toEqual(
      [
        expect.stringMatching(/^Hâte/u),
        expect.stringMatching(/^Écho parfait/u),
        expect.stringMatching(/^Givre persistant/u),
        expect.stringMatching(/^Peau de givre/u),
      ],
    );
  });
});

describe('AscentScreen pausing the battle with the loadout sheet (#159)', () => {
  const COMBAT_LABEL =
    'Équipement : 1 bénédiction de départ. Ouvre la liste. Met le combat en pause';
  const hasted = (): Ascent => ({
    ...startAscent(42),
    blessings: [{ family: 'haste', rarity: 'rare' }],
  });

  /** Une ascension dont le combat a commencé : l'écran s'ouvre sur le compte à rebours. */
  async function showStartedBattle() {
    return show(hasted(), async (current) => {
      await current.battleSession().start();
    });
  }

  async function wait(seconds: number) {
    for (let second = 0; second < seconds; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
    }
  }

  const countdown = () => screen.queryByTestId('ascent-countdown');
  const sheetTitle = () => screen.queryByRole('header', { name: 'Équipement' });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows « Équipement » in the header of the battle, read as pausing the battle', async () => {
    await showStartedBattle();
    expect(screen.getByTestId('ascent-loadout')).toHaveAccessibleName(COMBAT_LABEL);
    await wait(RESUME_COUNTDOWN_S);

    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
    const button = screen.getByTestId('ascent-loadout');
    expect(button).toHaveAccessibleName(COMBAT_LABEL);
    expect(button).toHaveStyle({ minHeight: MIN_TARGET_SIZE });
  });

  it('pauses the battle like « Pause » when opened, then counts down 3 s on close before resuming', async () => {
    const { session } = await showStartedBattle();
    await wait(RESUME_COUNTDOWN_S);
    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
    const pause = jest.spyOn(session, 'pause');

    await fireEvent.press(screen.getByTestId('ascent-loadout'));

    expect(pause).toHaveBeenCalledTimes(1);
    expect(session.resuming()).toBe(true);
    expect(screen.queryByRole('header', { name: 'Étage 1' })).toBeNull();
    expect(countdown()).toBeNull();
    expect(sheetTitle()).toBeOnTheScreen();
    expect(screen.getByRole('status')).toHaveTextContent('Combat en pause');
    // L'en-tête reste derrière le voile, rendu au niveau de l'écran.
    expect(screen.getByTestId('ascent-status')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-loadout')).toBeOnTheScreen();
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    focus.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(sheetTitle()).toBeNull();
    expect(countdown()).toHaveTextContent(`Reprise dans${RESUME_COUNTDOWN_S}`);
    expect(focus.mock.calls.at(-1)?.[0]).toMatchObject({ props: { testID: 'ascent-loadout' } });
    await wait(RESUME_COUNTDOWN_S);
    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
  });

  it('closes with the back gesture first, without leaving the screen', async () => {
    const { onLeave } = await showStartedBattle();
    await wait(RESUME_COUNTDOWN_S);
    await fireEvent.press(await screen.findByTestId('ascent-loadout'));

    await fireEvent(screen.getByTestId('loadout-sheet'), 'requestClose');

    expect(sheetTitle()).toBeNull();
    expect(countdown()).toBeOnTheScreen();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('waits for the sheet to close before counting down, when the app comes back from the background', async () => {
    const { app } = await showStartedBattle();
    await wait(RESUME_COUNTDOWN_S);
    await fireEvent.press(await screen.findByTestId('ascent-loadout'));

    await app.set(false);
    await app.set(true);

    expect(sheetTitle()).toBeOnTheScreen();
    expect(countdown()).toBeNull();
    expect(screen.queryByRole('header', { name: 'Étage 1' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(countdown()).toHaveTextContent(`Reprise dans${RESUME_COUNTDOWN_S}`);
    await wait(RESUME_COUNTDOWN_S);
    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
  });

  it('starts the countdown again from 3 when opened during the countdown', async () => {
    await showStartedBattle();
    await wait(RESUME_COUNTDOWN_S - 1);
    expect(countdown()).toHaveTextContent('Reprise dans1');

    await fireEvent.press(screen.getByTestId('ascent-loadout'));

    expect(sheetTitle()).toBeOnTheScreen();
    expect(screen.getByRole('status')).toHaveTextContent('Combat en pause');
    expect(countdown()).toBeNull();
    await wait(RESUME_COUNTDOWN_S);
    expect(screen.queryByRole('header', { name: 'Étage 1' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

    expect(countdown()).toHaveTextContent(`Reprise dans${RESUME_COUNTDOWN_S}`);
    await wait(RESUME_COUNTDOWN_S);
    expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
  });

  it('pauses nothing from the choice of a blessing, before the first battle', async () => {
    const { session } = await show(startAscent(42, { gauge: -1, blessings: ['rare'] }));
    const pause = jest.spyOn(session, 'pause');

    await fireEvent.press(screen.getByTestId('ascent-loadout'));

    expect(screen.getByTestId('ascent-loadout')).toHaveAccessibleName(
      'Équipement : vide. Ouvre la liste',
    );
    expect(sheetTitle()).toBeOnTheScreen();
    expect(screen.queryByText('Combat en pause')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Bénédiction 1 sur 1' })).toBeOnTheScreen();
  });

  it('keeps « Pause » leaving to the tower foot', async () => {
    const { onLeave, session } = await showStartedBattle();
    await wait(RESUME_COUNTDOWN_S);

    await fireEvent.press(await screen.findByRole('button', { name: 'Pause' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(session.resuming()).toBe(true);
  });
});

describe('AscentScreen header on a narrow phone (#159)', () => {
  const initial = Dimensions.get('window');

  function windowWidth(width: number) {
    Dimensions.set({
      window: { ...Dimensions.get('window'), width },
      screen: { ...Dimensions.get('screen'), width },
    });
  }

  afterEach(() => {
    windowWidth(initial.width);
  });

  it('puts the status on its own line above « Équipement » and « Pause » under 375 dp, the battle keeping its place', async () => {
    windowWidth(320);
    await show(startAscent(42));

    expect(await screen.findByTestId('battle-pad')).toBeOnTheScreen();
    const buttons = screen.getByTestId('ascent-header-buttons');
    expect(within(buttons).getByTestId('ascent-loadout')).toHaveStyle({
      minHeight: MIN_TARGET_SIZE,
    });
    expect(within(buttons).getByTestId('ascent-pause')).toHaveStyle({ minHeight: MIN_TARGET_SIZE });
    expect(within(buttons).queryByTestId('ascent-status')).toBeNull();
    expect(screen.getByTestId('ascent-header')).toHaveStyle({ flexDirection: 'column' });
    expect(screen.getByTestId('ascent-status')).not.toHaveStyle({ flex: 1 });
  });

  it('puts the status on its own line in large text too', async () => {
    windowWidth(390);
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale: 1.3 },
      screen: { ...Dimensions.get('screen'), fontScale: 1.3 },
    });
    await show(between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]));

    expect(screen.getByTestId('ascent-header-buttons')).toBeOnTheScreen();
  });

  it('keeps the status beside the buttons from 375 dp', async () => {
    windowWidth(390);
    await show(between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]));

    expect(screen.queryByTestId('ascent-header-buttons')).toBeNull();
    expect(screen.getByTestId('ascent-header')).toHaveStyle({ flexDirection: 'row' });
    expect(screen.getByTestId('ascent-status')).toHaveStyle({ flex: 1 });
  });
});

describe('AscentScreen with the Chest of the found item (#227)', () => {
  const hidden = { includeHiddenElements: true } as const;
  const chest = () => screen.queryByTestId('chest-stage', hidden);
  const equip = () => screen.queryByRole('button', { name: 'Équiper' });

  /** Le combat `kind` de l'étage 3 du palier 1, le flux du butin donnant un objet ou rien. */
  function before(kind: 'combat' | 'elite', found: boolean): Ascent {
    const ascent: Ascent = {
      ...startAscent(42),
      floor: 3,
      encounter: { kind, enemies: ['ghoul'], battleSeed: 3 },
    };
    return { ...ascent, lootRandom: lootState(ascent, found) };
  }

  /** L'écran sur le combat de `saved`, mené jusqu'à la victoire. */
  async function win(saved: Ascent) {
    let battles: ReturnType<typeof spyBattles> | null = null;
    const shown = await show(saved, async (session) => {
      battles = spyBattles(session);
    });
    await screen.findByTestId('battle-screen');
    await winShownBattle(battles!, shown.clock);
    return shown;
  }

  async function advance(ms: number): Promise<void> {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens the Chest after an ordinary battle won with an item, then offers « Équiper »', async () => {
    const { session } = await win(before('combat', true));
    const found = session.current()!.foundItem!;

    expect(screen.getByTestId('ascent-item')).toBeOnTheScreen();
    expect(screen.getByText(/^Étage franchi · \+\d+ Or$/)).toBeOnTheScreen();
    expect(chest()).toBeOnTheScreen();
    expect(screen.getByTestId('chest-closed', hidden)).toBeTruthy();
    expect(equip()).toBeNull();
    // L'en-tête reste actif pendant l'ouverture.
    expect(screen.getByTestId('ascent-pause')).toBeEnabled();
    expect(screen.getByTestId('ascent-loadout')).toBeEnabled();

    await advance(700);

    expect(chest()).toBeNull();
    expect(screen.getByTestId('item-image', hidden)).toHaveProp('sprite', `item-${found}`);
    await fireEvent.press(equip()!);
    expect(session.current()!.foundItem).toBeNull();
    expect(Object.values(session.current()!.equipment)).toContain(found);
  });

  it('shows the guaranteed item of an Elite in the Chest too', async () => {
    const { session } = await win(before('elite', true));

    expect(session.current()!.foundItem).not.toBeNull();
    expect(chest()).toBeOnTheScreen();
    expect(equip()).toBeNull();
    await advance(700);
    expect(equip()).toBeOnTheScreen();
  });

  it('shows no Chest after a battle won without an item: the offer of boons, as before', async () => {
    const { session } = await win(before('combat', false));

    expect(session.current()!.foundItem).toBeNull();
    expect(screen.getByTestId('ascent-boons')).toBeOnTheScreen();
    expect(chest()).toBeNull();
  });

  it('shows no Chest after the boss', async () => {
    await show({
      ...startAscent(42),
      floor: 6,
      encounter: null,
      lastGold: 30,
      passage: { to: 2, step: 'bossDefeated' },
    });

    expect(screen.getByTestId('ascent-boss-defeated')).toBeOnTheScreen();
    expect(chest()).toBeNull();
  });

  it('shows a pending item at once, without the Chest opening again, on a resume', async () => {
    await show({
      ...between(startAscent(42), [{ kind: 'combat', groupSize: 2 }]),
      foundItem: 'axe',
    });

    expect(chest()).toBeNull();
    expect(screen.getByTestId('item-image', hidden)).toHaveProp('sprite', 'item-axe');
    expect(equip()).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Coffre ouvert. Hache rouillée, Commun, Brise-garde ×1,1, Initiative −1.',
    );
  });

  it('shows the item at once when coming back after a Pause during the opening', async () => {
    const { session, dependencies, onLeave } = await win(before('combat', true));
    expect(chest()).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('ascent-pause'));
    expect(onLeave).toHaveBeenCalled();
    screen.unmount();
    await renderScreen(
      <AscentScreen session={session} visibility={visibility()} onLeave={jest.fn()} />,
      dependencies,
    );

    expect(chest()).toBeNull();
    expect(equip()).toBeOnTheScreen();
  });
});
