import { act, fireEvent, screen, within } from '@testing-library/react-native';

import type { ManualBattleClock } from '../../../application/testing/ManualBattleClock';
import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { Ascent } from '../../../domain/ascent/Ascent';
import type { Battle } from '../../../domain/battle/Battle';
import { RESUME_COUNTDOWN_S } from './AscentScreen';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { BOARD_WIND_UP_MS, IconBoardScreen, type BoardAscent } from './IconBoardScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hidden = { includeHiddenElements: true } as const;

/** Les ascensions ouvertes par la planche, chacune dans sa session en mémoire. */
let opened: {
  saved: Ascent | null;
  shards: number | undefined;
  battle: Battle | undefined;
  session: AscentSession;
  clock: ManualBattleClock;
}[] = [];

async function openAscent(
  saved: Ascent | null,
  shards?: number,
  battle?: Battle,
): Promise<BoardAscent> {
  const { session, camp, clock } = ascentSetUp({
    ...(saved !== null && { saved }),
    ...(shards !== undefined && { shards }),
    ...(battle !== undefined && { battle }),
  });
  await session.load();
  opened.push({ saved, shards, battle, session, clock });
  return { session, camp };
}

async function renderBoard(onClose: () => void = jest.fn()) {
  opened = [];
  await renderScreen(
    <IconBoardScreen
      onClose={onClose}
      openAscent={openAscent}
      visibility={{ onChange: () => () => {} }}
    />,
    ascentSetUp().dependencies,
  );
}

async function open(entry: string) {
  await renderBoard();
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: entry }));
  });
}

describe('IconBoardScreen (#157)', () => {
  it('lists the screens of the boon icons, as a tool of the preview build', async () => {
    await renderBoard();

    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
    expect(screen.getByText('Outil du build de preview')).toBeOnTheScreen();
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      "Choix d'un bienfait",
      'Sorties · aucun bienfait',
      'Sorties · deux bienfaits',
      'Dernière porte · 5 bienfaits',
      'Bénédictions · 3 sur 3',
      'Bénédiction · 1 sur 1',
      'Offre · palier 2',
      'Offre · Second souffle',
      'Offre · Second souffle seule',
      'Coffre · fermé et ouvert',
      'Coffre scellé · clé et Fortune',
      'Équipement · 1 · pied de la tour',
      'Équipement · 3 · pied de la tour',
      'Équipement · 8 · pied de la tour',
      'Équipement · 8 · combat',
      'Équipement · 8 · sorties',
      "Équipement · 3 · choix d'un bienfait",
      'Boss vaincu · palier 1',
      'Palier 2 · Les Jardins de cendre',
      'Chute · 10 Éclats',
      'Sommet atteint',
      'Pied de la tour · 22 Éclats',
      'Frise · manche et aperçu',
      'Frise · deux Goules',
      'Frise · boss en phase 2',
      'Voile · coup imparable · palier 1',
      'Voile · coup imparable · palier 3',
      'Beffroi · Novice, Sonneuse, Jaquemart',
      "Choix d'un bienfait · Veillée d'hiver",
      'Objet trouvé · Flamberge',
      'Fermer',
    ]);
  });

  it('closes the board', async () => {
    const onClose = jest.fn();
    await renderBoard(onClose);

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

  it('shows an offer of tier 2 with Gelée blanche and its tier mark (#212)', async () => {
    await open('Offre · palier 2');

    expect(screen.getAllByRole('radio').map((card) => card.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Écho parfait, /),
      expect.stringMatching(/^Gelée blanche, Givre, Rare, palier 2\. /),
      expect.stringMatching(/^Givre persistant, /),
    ]);
    expect(screen.getByText('· Palier 2')).toBeOnTheScreen();
  });

  it('shows Second souffle after two tier 3 boons, then the HP given back (#212)', async () => {
    await open('Offre · Second souffle');

    expect(screen.getAllByRole('radio').map((card) => card.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Heure juste, /),
      expect.stringMatching(/^Givre du clocher, /),
      "Second souffle : rend 8 PV, de 40 à 48 PV sur 88. Ce n'est pas un bienfait.",
    ]);
    await fireEvent.press(screen.getByRole('radio', { name: /^Second souffle/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    expect(screen.getByText('PV rendus.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });

  it('shows Second souffle alone, already checked, under « Reprends ton souffle » (#212)', async () => {
    await open('Offre · Second souffle seule');

    expect(screen.getByRole('header', { name: 'Reprends ton souffle' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Second souffle/ })).toBeChecked();
  });

  it('shows the Chest closed and open, then the found item opening from it, replayed on demand (#227)', async () => {
    jest.useFakeTimers();
    try {
      await open('Coffre · fermé et ouvert');

      const stills = screen.getAllByTestId('chest-board-still', hidden);
      expect(
        stills.map(
          (still) => within(still).getByTestId(/^chest-(closed|open)$/, hidden).props.sprite,
        ),
      ).toEqual(['chest-closed', 'chest-open']);
      const opening = () => screen.getByTestId('chest-board-opening', hidden);
      expect(within(opening()).getByTestId('chest-stage', hidden)).toBeTruthy();
      for (let step = 0; step < 7; step += 1) {
        await act(async () => {
          jest.advanceTimersByTime(100);
        });
      }
      expect(within(opening()).queryByTestId('chest-stage', hidden)).toBeNull();
      expect(screen.getByRole('button', { name: 'Équiper' })).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: "Rejouer l'ouverture" }));
      expect(within(opening()).getByTestId('chest-stage', hidden)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: "Passer l'ouverture du coffre" }));
      await fireEvent.press(screen.getByRole('button', { name: 'Équiper' }));
      expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the sealed chest closed and open, the key, Fortune, and the sealed chest panel (#226)', async () => {
    jest.useFakeTimers();
    try {
      await open('Coffre scellé · clé et Fortune');

      const stills = screen.getAllByTestId('sealed-chest-board-still', hidden);
      expect(
        stills.map(
          (still) => within(still).getByTestId(/^chest-(closed|open)$/, hidden).props.sprite,
        ),
      ).toEqual(['sealed-chest-closed', 'sealed-chest-open']);
      expect(screen.getByTestId('sealed-chest-board-key', hidden)).toHaveProp('sprite', 'key');
      expect(
        within(screen.getByTestId('sealed-chest-board-fortune', hidden)).getByTestId(
          'icon-well',
          hidden,
        ),
      ).toBeTruthy();
      await fireEvent.press(
        screen.getByRole('button', { name: "Ouvrir avec une clé, il t'en reste 2" }),
      );
      expect(screen.getByText("Le coffre s'ouvre…")).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: "Passer l'ouverture du coffre" }));
      expect(
        screen.getByRole('button', { name: "Ouvrir avec une clé, il t'en reste 2" }),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
      expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
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

describe('IconBoardScreen with the loadout (#159)', () => {
  const loadoutOf = (ascent: Ascent) => [ascent.blessings, ascent.hero.boons];

  it('opens the real tower foot on a fixed ascent with a loadout of 3, in memory', async () => {
    await open('Équipement · 3 · pied de la tour');

    expect(await screen.findByTestId('tower-foot')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('loadout-section')).getByText('Équipement · 3'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Bénédictions de départ : Hâte, Rare')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Bienfaits : Écho parfait, Commun ; Givre persistant, Rare'),
    ).toBeOnTheScreen();
    expect(loadoutOf(opened[0]!.saved!)).toEqual([
      [{ family: 'haste', rarity: 'rare' }],
      ['perfectEcho', 'lingeringFrost'],
    ]);
  });

  it('opens the camp of the fixed ascent from the tower foot, and comes back to it (#40)', async () => {
    await open('Équipement · 1 · pied de la tour');

    await fireEvent.press(await screen.findByRole('button', { name: 'Le camp' }));
    expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(await screen.findByTestId('tower-foot')).toBeOnTheScreen();
  });

  it('opens the real tower foot with a single starting blessing (4C)', async () => {
    await open('Équipement · 1 · pied de la tour');

    expect(await screen.findByText('Équipement · 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bénédictions de départ : Hâte, Rare')).toBeOnTheScreen();
    expect(screen.getByText('Aucun bienfait')).toBeOnTheScreen();
  });

  it('opens the longest build at the tower foot, then the ascent, and comes back to the board on « Pause »', async () => {
    await open('Équipement · 8 · pied de la tour');

    expect(await screen.findByTestId('tower-foot-more', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Équipement · 8')).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "Reprendre l'ascension" }));
    });
    expect(await screen.findByTestId('ascent-loadout')).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    });
    expect(screen.getByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  });

  it('opens the real battle with the longest build, the button pausing it', async () => {
    await open('Équipement · 8 · combat');

    expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-loadout')).toHaveAccessibleName(
      'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste. Met le combat en pause',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('ascent-loadout'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Combat en pause');
  });

  it('opens the real last door with the longest build', async () => {
    await open('Équipement · 8 · sorties');

    expect(await screen.findByRole('header', { name: 'Dernière porte' })).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-loadout')).toHaveAccessibleName(
      'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste',
    );
  });

  it('opens the real boon choice with a loadout of 3', async () => {
    await open("Équipement · 3 · choix d'un bienfait");

    expect(await screen.findByRole('header', { name: 'Choisis un bienfait' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((card) => card.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Braise brisante, /),
      expect.stringMatching(/^Lame juste, /),
      expect.stringMatching(/^Braise ardente, /),
    ]);
    expect(within(screen.getByTestId('ascent-loadout')).getByText('3', hidden)).toBeTruthy();
  });

  it("opens the real boon choice with Veillée d'hiver (#195)", async () => {
    await open("Choix d'un bienfait · Veillée d'hiver");

    expect(await screen.findByRole('header', { name: 'Choisis un bienfait' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((card) => card.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Écho parfait, /),
      expect.stringMatching(/^Givre persistant, /),
      expect.stringMatching(/^Veillée d'hiver, /),
    ]);
  });

  it('opens the real found item screen with the Flamberge (#195)', async () => {
    await open('Objet trouvé · Flamberge');

    expect(await screen.findByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
    expect(screen.getByText('◆◆◆ Épique')).toBeOnTheScreen();
  });

  it('opens each ascent in a session of its own', async () => {
    await open('Équipement · 8 · sorties');
    await screen.findByTestId('ascent-loadout');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Équipement · 8 · combat' }));
    });

    expect(opened).toHaveLength(2);
    expect(opened[0]!.session).not.toBe(opened[1]!.session);
  });
});

describe('IconBoardScreen with the tiers and the Shards (#38)', () => {
  it('opens the real defeated boss screen of tier 1, with its 8 Shards (X3)', async () => {
    await open('Boss vaincu · palier 1');

    expect(await screen.findByTestId('ascent-boss-defeated')).toBeOnTheScreen();
    expect(screen.getByLabelText('8 Éclats gagnés, gardés pour toujours')).toBeOnTheScreen();
    expect(screen.getByText('+40 Or')).toBeOnTheScreen();
  });

  it('opens the real transition screen to the Ash gardens (C4)', async () => {
    await open('Palier 2 · Les Jardins de cendre');

    expect(await screen.findByRole('header', { name: 'Les Jardins de cendre' })).toBeOnTheScreen();
  });

  it('opens the real end of the ascent after a fall at tier 2, with 10 Shards (X6)', async () => {
    await open('Chute · 10 Éclats');

    expect(await screen.findByRole('header', { name: "Fin de l'ascension" })).toBeOnTheScreen();
    expect(screen.getByLabelText('10 Éclats gagnés')).toBeOnTheScreen();
    expect(screen.getByText('La Sentinelle est tombée au palier 2, étage 4.')).toBeOnTheScreen();
  });

  it('opens the real Summit reached (X7)', async () => {
    await open('Sommet atteint');

    expect(await screen.findByRole('header', { name: 'Sommet atteint' })).toBeOnTheScreen();
    expect(screen.getByLabelText('54 Éclats gagnés')).toBeOnTheScreen();
    expect(screen.getByText('Dont 10 pour le Sommet · Total : 54 Éclats')).toBeOnTheScreen();
  });

  it('opens the real tower foot with 22 Shards and no ascent, in memory', async () => {
    await open('Pied de la tour · 22 Éclats');

    expect(await screen.findByTestId('tower-foot-shards')).toHaveTextContent('22 Éclats');
    expect(opened[0]).toMatchObject({ saved: null, shards: 22 });
  });
});

describe('IconBoardScreen with the portraits of the action track (#175)', () => {
  /** Le nom du portrait de chaque case de la frise, et sa taille. */
  function track() {
    return screen.getAllByTestId('track-portrait', hidden).map((portrait) => ({
      sprite: portrait.props.sprite as string,
      big: portrait.props.scale === 2,
    }));
  }

  it('opens the real battle of the Wanderer, her turn first, then the preview (F1)', async () => {
    await open('Frise · manche et aperçu');

    expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
    expect(track()).toEqual([
      { sprite: 'portrait:wanderer', big: true },
      { sprite: 'portrait:skeleton', big: false },
      { sprite: 'portrait:ghoul', big: false },
      { sprite: 'portrait:wanderer', big: false },
      { sprite: 'portrait:skeleton', big: false },
      { sprite: 'portrait:ghoul', big: false },
    ]);
    expect(screen.getByTestId('battle-action-track')).toHaveProp(
      'accessibilityLabel',
      "Ordre d'action. Manche 1 : toi, Squelette, Goule. Manche suivante : toi, Squelette, Goule.",
    );
  });

  it('opens a full track of 4 + 4 entries with two Ghouls (F2)', async () => {
    await open('Frise · deux Goules');

    expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
    const sprites = track().map(({ sprite }) => sprite);
    expect(sprites).toHaveLength(8);
    expect(sprites.filter((sprite) => sprite === 'portrait:ghoul')).toHaveLength(4);
    expect(screen.getByText('suiv.')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-action-track')).toHaveProp(
      'accessibilityLabel',
      "Ordre d'action. Manche 1 : toi, Squelette, Goule, Goule. Manche suivante : toi, Squelette, Goule, Goule.",
    );
  });

  it('resumes a battle against the Ash gardener in phase 2, her phase 2 portrait in every entry (F4)', async () => {
    jest.useFakeTimers();
    try {
      await open('Frise · boss en phase 2');
      expect(opened[0]!.battle?.enemies[0]).toMatchObject({ kind: 'ashGardener', phase2: true });
      for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1_000);
        });
      }
      expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
      expect(track()).toEqual([
        { sprite: 'portrait:sentinel', big: true },
        { sprite: 'portrait:ashGardener:phase2', big: false },
        { sprite: 'portrait:ashGardener:phase2', big: false },
        { sprite: 'portrait:sentinel', big: false },
      ]);
      expect(screen.getByTestId('battle-action-track')).toHaveProp(
        'accessibilityLabel',
        "Ordre d'action. Manche 1 : toi, Jardinière des cendres. Manche suivante : Jardinière des cendres, toi.",
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('IconBoardScreen with the veil of the enemy phase (#188)', () => {
  it.each([
    ['Voile · coup imparable · palier 1', 1, 'specter', 'perilous'],
    ['Voile · coup imparable · palier 3', 3, 'bronzeWarden', 'delayedPerilous'],
    // Les trois ennemis du Beffroi (#214), le Jaquemart préparant Heure pleine.
    ['Beffroi · Novice, Sonneuse, Jaquemart', 3, 'clockJack', 'perilous'],
  ] as const)(
    '« %s » resumes the wind-up of a perilous attack, under the veil (C1, C3)',
    async (entry, tier, kind, attack) => {
      jest.useFakeTimers();
      try {
        await open(entry);
        const { battle, saved } = opened[0]!;
        expect(saved).toMatchObject({ tier });
        expect(battle?.phase).toMatchObject({ kind: 'enemy', step: { kind: 'attack', attack } });
        const { step } = battle!.phase as {
          step: { enemy: number; startedAt: number; impacts: readonly { at: number }[] };
        };
        expect(battle!.enemies[step.enemy]!.kind).toBe(kind);
        // Une préparation de 20 s : le sceau reste assez longtemps pour la capture end-to-end.
        expect(step.impacts[0]!.at - step.startedAt).toBe(BOARD_WIND_UP_MS);
        expect(BOARD_WIND_UP_MS).toBe(20_000);
        for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
          await act(async () => {
            jest.advanceTimersByTime(1_000);
          });
        }

        expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase ennemie');
        expect(screen.getByTestId('enemy-phase-veil', hidden)).toBeTruthy();
        expect(screen.getByLabelText('Sceau rouge : coup imparable')).toBeOnTheScreen();
        const [acting] = screen.getAllByTestId('track-portrait', hidden);
        expect(acting).toHaveProp('sprite', `portrait:${kind}`);
        expect(acting).toHaveProp('scale', 2);
        expect(screen.getAllByTestId('track-shade', hidden).length).toBeGreaterThan(0);

        // Reprise : la préparation repart du début et dure toujours 20 s sur l'horloge de combat.
        const { clock } = opened[0]!;
        const resumedAt = clock.now();
        await act(async () => {
          clock.advanceTo(resumedAt + BOARD_WIND_UP_MS - 1_000);
        });
        expect(screen.getByLabelText('Sceau rouge : coup imparable')).toBeOnTheScreen();
        expect(screen.getByTestId('enemy-phase-veil', hidden)).toBeTruthy();
        await act(async () => {
          clock.advanceTo(resumedAt + BOARD_WIND_UP_MS + 1_000);
        });
        expect(screen.queryByLabelText('Sceau rouge : coup imparable')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    },
  );
});
