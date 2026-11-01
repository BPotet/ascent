// Les écrans des paliers et des Éclats (#38, maquette 30) : le boss vaincu (X3), la transition de
// palier (C4), la fin de l'ascension (X6) et le Sommet atteint (X7), sur une vraie session.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { ManualBattleClock } from '../../../application/testing/ManualBattleClock';
import type { BattleSession } from '../../../application/useCases/BattleSession';
import type { ShardAward } from '../../../domain/ascent/shards';
import { artPalette } from '../pixelArt/artPalette';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { AscentScreen, RESUME_COUNTDOWN_S } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
beforeEach(() => announce.mockClear());

type MeasureInWindow = (
  callback: (x: number, y: number, width: number, height: number) => void,
) => void;

async function show(
  saved: Ascent,
  prepare?: (session: ReturnType<typeof ascentSetUp>['session']) => Promise<void>,
  shards?: number,
) {
  const setUp = ascentSetUp({ saved, ...(shards !== undefined && { shards }) });
  await setUp.session.load();
  await prepare?.(setUp.session);
  const onLeave = jest.fn();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={onLeave}
    />,
    setUp.dependencies,
  );
  return { ...setUp, onLeave };
}

const award = (id: string, amount: number): ShardAward => ({ id: `42:${id}`, amount });

/** Le boss du palier `tier` vaincu : l'écran du boss vaincu, ou celui de la transition. */
function passage(tier: 1 | 2, step: 'bossDefeated' | 'announce', lastGold: number): Ascent {
  return {
    ...startAscent(42),
    tier,
    floor: 6,
    encounter: null,
    lastGold,
    gold: 60 + lastGold,
    shardAwards: [award('1:6:boss', 8), ...(tier === 2 ? [award('2:6:boss', 12)] : [])],
    passage: { to: (tier + 1) as 2 | 3, step },
  };
}

describe('the defeated boss screen (X3, #38)', () => {
  it('shows the Shards in large, kept for ever, and the Gold of the boss', async () => {
    await show(passage(1, 'bossDefeated', 40));

    expect(screen.getByTestId('ascent-boss-defeated')).toBeOnTheScreen();
    expect(screen.getByText('Boss vaincu')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Palier 1 franchi' })).toBeOnTheScreen();
    expect(screen.getByLabelText('8 Éclats gagnés, gardés pour toujours')).toHaveTextContent('+8');
    expect(screen.getByText('Éclats · gardés pour toujours, même si tu tombes.')).toBeOnTheScreen();
    expect(screen.getByText('+40 Or')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('8 Éclats gagnés, gardés pour toujours');
  });

  it('shows the 12 Shards of the boss of tier 2, and goes on to tier 3', async () => {
    await show(passage(2, 'bossDefeated', 50));

    expect(screen.getByRole('header', { name: 'Palier 2 franchi' })).toBeOnTheScreen();
    expect(screen.getByLabelText('12 Éclats gagnés, gardés pour toujours')).toHaveTextContent(
      '+12',
    );
    expect(screen.getByRole('button', { name: 'Continuer vers le palier 3' })).toBeOnTheScreen();
  });

  it('pauses on « Faire une pause », the ascent saved on this screen', async () => {
    const { onLeave, session } = await show(passage(1, 'bossDefeated', 40));

    fireEvent.press(screen.getByRole('button', { name: 'Faire une pause' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(session.current()?.passage).toEqual({ to: 2, step: 'bossDefeated' });
  });
});

describe('the transition screen (C4, #38)', () => {
  it('announces tier 2, the Ash gardens, after the defeated boss screen', async () => {
    const { session } = await show(passage(1, 'bossDefeated', 40));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer vers le palier 2' }));
    });

    expect(session.current()?.passage).toEqual({ to: 2, step: 'announce' });
    expect(screen.getByTestId('ascent-tier')).toBeOnTheScreen();
    expect(screen.getByText('Palier 1 franchi')).toBeOnTheScreen();
    expect(screen.getByText('Palier 2')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Les Jardins de cendre' })).toBeOnTheScreen();
    expect(screen.getByText('Les ennemis y sont plus forts.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Palier 2, les Jardins de cendre');
  });

  it('announces tier 3, the Belfry', async () => {
    await show(passage(2, 'announce', 50));

    expect(screen.getByRole('header', { name: 'Le Beffroi' })).toBeOnTheScreen();
    expect(screen.getByText('Palier 3')).toBeOnTheScreen();
  });

  it('enters floor 1 of tier 2, on its forced battle', async () => {
    const { session } = await show(passage(1, 'announce', 40));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrer' }));
    });

    expect(session.current()).toMatchObject({ tier: 2, floor: 1, passage: null });
    expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-status')).toHaveTextContent(/^Palier 2 · Étage 1 sur 6/);
  });
});

describe('the end of the ascent (X6, X7, #38)', () => {
  it('shows a fall with the Shards won among what is kept, in green, and the Gold lost, in red', async () => {
    const fallen: Ascent = {
      ...startAscent(42),
      tier: 2,
      floor: 4,
      gold: 23,
      encounter: null,
      outcome: 'fall',
      shardAwards: [award('1:6:boss', 8), award('2:3:elite', 2)],
    };

    await show(fallen, undefined, 34);

    expect(screen.getByTestId('ascent-end')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: "Fin de l'ascension" })).toBeOnTheScreen();
    expect(screen.getByText('La Sentinelle est tombée au palier 2, étage 4.')).toBeOnTheScreen();
    expect(screen.getByText('Éclats gagnés')).toBeOnTheScreen();
    expect(screen.getByLabelText('10 Éclats gagnés')).toHaveTextContent('+10');
    expect(screen.getByText('Total : 44 Éclats')).toBeOnTheScreen();
    expect(screen.getByTestId('ascent-end-kept')).toHaveTextContent('Tu gardes tes Éclats.');
    expect(screen.getByTestId('ascent-end-lost')).toHaveTextContent(
      "L'Or (23 Or), l'équipement et les bienfaits de cette ascension sont perdus.",
    );
  });

  it('shows the Summit reached, with the 10 Shards of the Summit', async () => {
    const summit: Ascent = {
      ...startAscent(42),
      tier: 3,
      floor: 6,
      encounter: null,
      outcome: 'victory',
      shardAwards: [
        award('1:6:boss', 8),
        award('2:6:boss', 12),
        award('3:6:boss', 18),
        { id: '42:summit', amount: 10 },
      ],
    };

    await show(summit);

    expect(screen.getByRole('header', { name: 'Sommet atteint' })).toBeOnTheScreen();
    expect(screen.getByText('Les trois paliers franchis avec la Sentinelle.')).toBeOnTheScreen();
    expect(screen.getByLabelText('48 Éclats gagnés')).toHaveTextContent('+48');
    expect(screen.getByText('Dont 10 pour le Sommet · Total : 48 Éclats')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('28 Éclats gagnés, Sommet atteint');
  });

  it('shows a fall without any Shard, and goes back to the tower foot', async () => {
    const { session, onLeave } = await show({ ...startAscent(42), floor: 3, outcome: 'fall' });

    expect(screen.getByText('La Sentinelle est tombée au palier 1, étage 3.')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 Éclat gagné')).toHaveTextContent('+0');
    fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));

    expect(session.current()).toBeNull();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe('the tier backdrop behind the battle (#176)', () => {
  const hidden = { includeHiddenElements: true } as const;
  const backdrop = () => screen.getByTestId('tier-backdrop', hidden);

  /** L'ascension au palier `tier`, devant un combat de `kind`. */
  function before(tier: 1 | 2 | 3, kind: 'combat' | 'elite' | 'boss' = 'combat'): Ascent {
    const enemies = { 1: 'ghoul', 2: 'ashBramble', 3: 'firstPilgrim' } as const;
    return {
      ...startAscent(42),
      tier,
      floor: kind === 'boss' ? 6 : 3,
      encounter: { kind, enemies: [enemies[tier]], battleSeed: 3 },
    };
  }

  it.each([1, 2, 3] as const)('shows the backdrop of tier %i behind its battle', async (tier) => {
    await show(before(tier));

    expect(await screen.findByTestId('battle-screen')).toBeOnTheScreen();
    expect(backdrop()).toHaveProp('tier', tier);
  });

  it.each(['elite', 'boss'] as const)(
    'keeps the backdrop of the tier for a battle of kind %s',
    async (kind) => {
      await show(before(3, kind));

      await screen.findByTestId('battle-screen');
      expect(backdrop()).toHaveProp('tier', 3);
    },
  );

  it('hides the backdrop from the screen reader and from the touches', async () => {
    await show(before(2));

    expect(backdrop()).toHaveProp('accessibilityElementsHidden', true);
    expect(backdrop()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(backdrop()).toHaveProp('pointerEvents', 'none');
    expect(screen.queryByTestId('tier-backdrop')).toBeNull();
  });

  it('lets the backdrop show through the screen of the ascent, on the night of the container', async () => {
    await show(before(1));

    expect(StyleSheet.flatten(screen.getByTestId('ascent-battle').props.style)).toMatchObject({
      backgroundColor: 'transparent',
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('ascent-battle-backdrop', hidden).props.style),
    ).toMatchObject({ backgroundColor: artPalette.roles.night });
  });

  it('keeps the backdrop during the resume countdown, veiled all over', async () => {
    jest.useFakeTimers();
    try {
      await show(before(2), async (session) => {
        await session.battleSession().start();
      });

      expect(screen.getByTestId('ascent-countdown')).toBeOnTheScreen();
      expect(backdrop()).toHaveProp('tier', 2);
      expect(backdrop()).toHaveProp('scene', null);
    } finally {
      jest.useRealTimers();
    }
  });

  it('veils above and under the scene frame once it is measured', async () => {
    const measure = jest
      .spyOn(
        (View as unknown as { prototype: { measureInWindow: MeasureInWindow } }).prototype,
        'measureInWindow',
      )
      .mockImplementation((callback) => callback(0, 150, 390, 440));
    try {
      await show(before(1));
      expect(backdrop()).toHaveProp('scene', null);

      await fireEvent(await screen.findByTestId('battle-scene-frame'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 440 } },
      });

      expect(backdrop()).toHaveProp('scene', { top: 150, bottom: 590 });
    } finally {
      measure.mockRestore();
    }
  });

  describe('once the scene is measured', () => {
    let measure: jest.SpyInstance;
    let battles: jest.SpyInstance<BattleSession, []>;

    /** Le cadre de la scène mesuré dans la fenêtre : du haut `top` au bas `bottom`. */
    function measuredAt(top: number, bottom: number) {
      measure.mockImplementation((callback: Parameters<MeasureInWindow>[0]) =>
        callback(0, top, 390, bottom - top),
      );
    }

    /** La mise en page du cadre de la scène affiché : il est mesuré. */
    async function layOutScene() {
      await fireEvent(await screen.findByTestId('battle-scene-frame'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 440 } },
      });
    }

    /**
     * Le combat affiché, mené jusqu'à la victoire sur l'horloge de combat : le héros attaque à son
     * tour, sur la dernière session de combat que l'écran a ouverte (`battles`).
     */
    async function win(
      battles: jest.SpyInstance<BattleSession, []>,
      clock: ManualBattleClock,
    ): Promise<void> {
      const battle = battles.mock.results.at(-1)!.value as BattleSession;
      for (let guard = 0; guard < 400; guard += 1) {
        const current = battle.current()!.battle;
        if (current.phase.kind === 'over') break;
        await act(async () => {
          if (current.phase.kind === 'hero') {
            const at = clock.now() + 50;
            clock.advanceTo(at);
            battle.heroAction({ kind: 'attack' }, at - 20, at);
          } else {
            clock.advanceTo(clock.pending()[0]!);
          }
          for (let index = 0; index < 10; index += 1) await Promise.resolve();
        });
      }
      expect(battle.current()!.battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    }

    beforeEach(() => {
      measure = jest.spyOn(
        (View as unknown as { prototype: { measureInWindow: MeasureInWindow } }).prototype,
        'measureInWindow',
      );
      measuredAt(150, 590);
    });

    afterEach(() => measure.mockRestore());

    it('veils all over again while the loadout sheet holds the battle', async () => {
      jest.useFakeTimers();
      try {
        await show({ ...before(1), blessings: [{ family: 'haste', rarity: 'rare' }] });
        await layOutScene();
        expect(backdrop()).toHaveProp('scene', { top: 150, bottom: 590 });

        await fireEvent.press(screen.getByTestId('ascent-loadout'));

        expect(screen.queryByTestId('battle-scene-frame')).toBeNull();
        expect(backdrop()).toHaveProp('scene', null);
      } finally {
        jest.useRealTimers();
      }
    });

    it('veils all over again during the countdown after a pause, then waits for the new frame', async () => {
      jest.useFakeTimers();
      try {
        const app = { listener: (_visible: boolean) => undefined as void };
        const setUp = ascentSetUp({ saved: before(2) });
        await setUp.session.load();
        await renderScreen(
          <AscentScreen
            session={setUp.session}
            visibility={{
              onChange: (listener) => {
                app.listener = listener;
                return () => undefined;
              },
            }}
            onLeave={() => undefined}
          />,
          setUp.dependencies,
        );
        await layOutScene();
        expect(backdrop()).toHaveProp('scene', { top: 150, bottom: 590 });

        await act(async () => app.listener(false));
        expect(backdrop()).toHaveProp('scene', null);
        await act(async () => app.listener(true));
        expect(screen.getByTestId('ascent-countdown')).toBeOnTheScreen();
        expect(backdrop()).toHaveProp('scene', null);

        for (let second = 0; second < RESUME_COUNTDOWN_S; second += 1) {
          await act(async () => {
            jest.advanceTimersByTime(1_000);
          });
        }
        expect(screen.getByTestId('battle-scene-frame')).toBeOnTheScreen();
        expect(backdrop()).toHaveProp('scene', null);
        measuredAt(170, 570);
        await layOutScene();
        expect(backdrop()).toHaveProp('scene', { top: 170, bottom: 570 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('waits for the frame of the next floor battle, the frame of the last one no longer counting', async () => {
      const { session, clock } = await show(before(1), async (current) => {
        battles = jest.spyOn(current, 'battleSession');
      });
      await layOutScene();
      expect(backdrop()).toHaveProp('scene', { top: 150, bottom: 590 });

      await win(battles, clock);
      await act(async () => {
        if (session.current()!.boonOffer !== null) session.chooseBoon(0);
        if (session.current()!.foundItem !== null) session.leaveItem();
        session.chooseExit(session.current()!.exits.findIndex((exit) => exit.kind === 'combat'));
      });

      expect(session.current()).toMatchObject({ tier: 1, floor: 4 });
      expect(await screen.findByTestId('battle-scene-frame')).toBeOnTheScreen();
      expect(backdrop()).toHaveProp('scene', null);
      measuredAt(160, 580);
      await layOutScene();
      expect(backdrop()).toHaveProp('scene', { top: 160, bottom: 580 });
    });

    it('waits for the frame of the first battle of the next tier, on its own backdrop', async () => {
      const { session, clock } = await show(before(1, 'boss'), async (current) => {
        battles = jest.spyOn(current, 'battleSession');
      });
      await layOutScene();
      expect(backdrop()).toHaveProp('scene', { top: 150, bottom: 590 });

      await win(battles, clock);
      await act(async () => {
        session.acknowledgeBossVictory();
        session.enterNextTier();
      });

      expect(session.current()).toMatchObject({ tier: 2, floor: 1 });
      expect(await screen.findByTestId('battle-scene-frame')).toBeOnTheScreen();
      expect(backdrop()).toHaveProp('tier', 2);
      expect(backdrop()).toHaveProp('scene', null);
      measuredAt(160, 580);
      await layOutScene();
      expect(backdrop()).toHaveProp('scene', { top: 160, bottom: 580 });
    });
  });
});
