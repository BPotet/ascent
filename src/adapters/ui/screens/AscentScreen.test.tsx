import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { ItemKind } from '../../../domain/ascent/items';
import { artPalette } from '../pixelArt/artPalette';
import { MIN_TARGET_SIZE } from '../pixelArt/PixelButton';
import { ITEM_IMAGES } from '../pixelArt/sprites/atelier/data/itemImages';
import type { AssetImage } from '../pixelArt/sprites/atelier/fullAnimation';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
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
    const elite = screen.getByRole('button', { name: 'Élite · objet Rare garanti' });
    expect(elite).toHaveTextContent('Élite · objet Rare garanti', { exact: true });
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

    expect(screen.getByRole('header', { name: 'Chute' })).toBeOnTheScreen();
    expect(screen.getByText("Tombé à l'étage 3.")).toBeOnTheScreen();
    expect(screen.getByText('Or gagné : 30 Or')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));

    expect(session.current()).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows a victory over the boss', async () => {
    await show({ ...startAscent(42), outcome: 'victory', encounter: null, gold: 80 });

    expect(screen.getByRole('header', { name: 'Victoire !' })).toBeOnTheScreen();
    expect(screen.getByText('Le boss des Catacombes est vaincu.')).toBeOnTheScreen();
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
