// La Frise d'action à portraits (#175, maquette v2, F1 à F5) : le portrait de chaque case, à 48 dp
// pour celui qui agit et à 24 dp pour les autres, le repli sur « Toi » et l'initiale, la phrase du
// lecteur d'écran inchangée, la sortie d'un ennemi tombé et l'entrée d'un renfort.
import { act, render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { artPalette } from '../pixelArt/artPalette';
import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import type { ActionTrackView, TrackEntry } from '../state/battleView';
import { ActionTrack, TRACK_LEAVE_MS } from './ActionTrack';

const hiddenToo = { includeHiddenElements: true } as const;

const hero: TrackEntry = { actor: 'hero', fighter: 'wanderer', phase2: false };
const specter: TrackEntry = { actor: 1, fighter: 'specter', phase2: false };
const ghoul = (actor: number): TrackEntry => ({ actor, fighter: 'ghoul', phase2: false });

const F2: ActionTrackView = {
  round: 3,
  current: [specter, hero, ghoul(0), ghoul(2)],
  next: [specter, hero, ghoul(0), ghoul(2)],
};

const NO_PORTRAITS = Object.fromEntries(
  Object.keys(PORTRAITS).map((kind) => [kind, null]),
) as unknown as typeof PORTRAITS;

function portraits() {
  return screen.getAllByTestId('track-portrait', hiddenToo);
}

function entries() {
  return screen.getAllByTestId('track-entry', hiddenToo);
}

async function wait(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
}

describe('ActionTrack', () => {
  it.each([
    [375, 4, 6],
    [360, 2, 4],
  ])(
    'spaces its entries on a screen %i dp wide: %i dp apart, « suiv. » %i dp inside',
    async (width, gap, padding) => {
      jest
        .spyOn(Dimensions, 'get')
        .mockReturnValue({ width, height: 640, scale: 2.625, fontScale: 1 });
      await render(<ActionTrack track={F2} />);

      expect(StyleSheet.flatten(screen.getByTestId('battle-action-track').props.style).gap).toBe(
        gap,
      );
      expect(StyleSheet.flatten(screen.getByText('suiv.').props.style)).toMatchObject({
        paddingHorizontal: padding,
      });
      jest.restoreAllMocks();
    },
  );

  it('shows the portrait of the one who acts at 48 dp, and of the others at 24 dp', async () => {
    await render(<ActionTrack track={F2} />);

    const [first, ...others] = portraits();
    expect(first).toHaveProp('sprite', 'portrait:specter');
    expect(first).toHaveProp('scale', 2);
    expect(first).not.toHaveProp('size');
    expect(others).toHaveLength(7);
    others.forEach((portrait) => expect(portrait).toHaveProp('size', 24));
    expect(portraits().map((portrait) => portrait.props.sprite as string)).toEqual([
      'portrait:specter',
      'portrait:wanderer',
      'portrait:ghoul',
      'portrait:ghoul',
      'portrait:specter',
      'portrait:wanderer',
      'portrait:ghoul',
      'portrait:ghoul',
    ]);
    expect(screen.queryByText('Toi', hiddenToo)).toBeNull();
  });

  it('shows two Ghouls with the same portrait, and nothing else in their entries', async () => {
    await render(<ActionTrack track={F2} />);

    const ghouls = entries().filter(
      (entry) =>
        within(entry).getByTestId('track-portrait', hiddenToo).props.sprite === 'portrait:ghoul',
    );
    expect(ghouls).toHaveLength(4);
    ghouls.forEach((entry) => {
      expect(within(entry).queryAllByText(/./, hiddenToo)).toHaveLength(0);
      expect(within(entry).getAllByTestId('track-portrait', hiddenToo)).toHaveLength(1);
    });
  });

  it('falls back on « Toi » and the initial without a validated portrait, never an empty entry', async () => {
    await render(<ActionTrack track={F2} portraits={NO_PORTRAITS} />);

    expect(screen.queryAllByTestId('track-portrait', hiddenToo)).toHaveLength(0);
    expect(entries()).toHaveLength(8);
    expect(
      entries().map((entry) => within(entry).getByText(/./, hiddenToo).props.children),
    ).toEqual(['S', 'Toi', 'G', 'G', 'S', 'Toi', 'G', 'G']);
  });

  it('is read as one sentence, unchanged, its portraits hidden', async () => {
    await render(<ActionTrack track={F2} />);

    const track = screen.getByTestId('battle-action-track');
    expect(track).toHaveProp('accessible', true);
    expect(track).toHaveProp(
      'accessibilityLabel',
      "Ordre d'action. Manche 3 : Spectre, toi, Goule, Goule. Manche suivante : Spectre, toi, Goule, Goule.",
    );
    portraits().forEach((portrait) =>
      expect(portrait).toHaveProp('accessibilityElementsHidden', true),
    );
  });

  it('gives every entry of a boss its phase 2 portrait at once, in place', async () => {
    const boss: TrackEntry = { actor: 0, fighter: 'hourRinger', phase2: false };
    const before = { round: 2, current: [boss, hero], next: [boss, hero] };
    await render(<ActionTrack track={before} />);
    const [entry] = entries();

    const shifted = { ...boss, phase2: true };
    await screen.rerender(
      <ActionTrack track={{ ...before, current: [shifted, hero], next: [shifted, hero] }} />,
    );

    expect(portraits().map((portrait) => portrait.props.sprite as string)).toEqual([
      'portrait:hourRinger:phase2',
      'portrait:wanderer',
      'portrait:hourRinger:phase2',
      'portrait:wanderer',
    ]);
    expect(entries()[0]).toBe(entry);
    expect(screen.queryAllByTestId('track-ghost', hiddenToo)).toHaveLength(0);
  });

  describe('in the enemy phase (#188, mockup v2 of #174, « .frise.dimf »)', () => {
    /** Le voile d'encre de la case `entry`, s'il y en a un. */
    function shade(entry: ReturnType<typeof entries>[number]) {
      return within(entry).queryByTestId('track-shade', hiddenToo);
    }

    function shadeStyle(entry: ReturnType<typeof entries>[number]) {
      return StyleSheet.flatten(shade(entry)!.props.style);
    }

    /** Le voile couvre la case entière, son cadre de 2 dp compris. */
    const wholeEntry = { top: -2, left: -2, right: -2, bottom: -2 };

    it('keeps the one who acts in full light, with its frames and its golden arrow', async () => {
      await render(<ActionTrack track={F2} enemyPhase />);

      const [acting] = entries();
      expect(shade(acting!)).toBeNull();
      expect(within(acting!).getByTestId('track-portrait', hiddenToo)).not.toHaveProp('saturation');
      expect(within(acting!).getByTestId('track-current-arrow', hiddenToo)).toBeTruthy();
    });

    it('dims the other entries of the round, the hero included, to 45 % brightness and 60 % saturation', async () => {
      await render(<ActionTrack track={F2} enemyPhase />);

      const round = entries().slice(1, 4);
      expect(
        round.map((entry) => within(entry).getByTestId('track-portrait', hiddenToo).props.sprite),
      ).toEqual(['portrait:wanderer', 'portrait:ghoul', 'portrait:ghoul']);
      round.forEach((entry) => {
        expect(shadeStyle(entry)).toMatchObject({
          ...wholeEntry,
          backgroundColor: artPalette.roles.ink,
          opacity: 0.55,
        });
        expect(shade(entry)).toHaveProp('pointerEvents', 'none');
        expect(within(entry).getByTestId('track-portrait', hiddenToo)).toHaveProp(
          'saturation',
          0.6,
        );
      });
    });

    it('dims the preview of the next round to 32 % brightness and 50 % saturation', async () => {
      await render(<ActionTrack track={F2} enemyPhase />);

      const preview = entries().slice(4);
      expect(preview).toHaveLength(4);
      preview.forEach((entry) => {
        expect(shadeStyle(entry)).toMatchObject({ ...wholeEntry, opacity: 0.68 });
        expect(within(entry).getByTestId('track-portrait', hiddenToo)).toHaveProp(
          'saturation',
          0.5,
        );
      });
    });

    it('keeps « suiv. » and the sentence of the screen reader as they are', async () => {
      await render(<ActionTrack track={F2} />);
      const separator = StyleSheet.flatten(screen.getByText('suiv.').props.style);
      const label = screen.getByTestId('battle-action-track').props.accessibilityLabel as string;

      await screen.rerender(<ActionTrack track={F2} enemyPhase />);

      expect(StyleSheet.flatten(screen.getByText('suiv.').props.style)).toEqual(separator);
      expect(screen.getByTestId('battle-action-track')).toHaveProp('accessibilityLabel', label);
    });

    it('only veils an entry without a portrait, « Toi » and the initials', async () => {
      await render(<ActionTrack track={F2} portraits={NO_PORTRAITS} enemyPhase />);

      const [acting, hero, , , next] = entries();
      expect(shade(acting!)).toBeNull();
      expect(shadeStyle(hero!)).toMatchObject({ opacity: 0.55 });
      expect(shadeStyle(next!)).toMatchObject({ opacity: 0.68 });
      expect(within(hero!).getByText('Toi', hiddenToo)).toBeTruthy();
    });

    it('gives back the look of the hero phase: the preview at 62 % brightness inside its frame and 70 % saturation', async () => {
      await render(<ActionTrack track={F2} enemyPhase />);
      await screen.rerender(<ActionTrack track={F2} />);

      const [acting, ...others] = entries();
      expect(shade(acting!)).toBeNull();
      others.slice(0, 3).forEach((entry) => expect(shade(entry)).toBeNull());
      others.slice(3).forEach((entry) => {
        expect(shadeStyle(entry)).toMatchObject({
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: artPalette.roles.ink,
          opacity: 0.38,
        });
        expect(within(entry).getByTestId('track-portrait', hiddenToo)).toHaveProp(
          'saturation',
          0.7,
        );
      });
      [acting, ...others.slice(0, 3)].forEach((entry) =>
        expect(within(entry!).getByTestId('track-portrait', hiddenToo)).not.toHaveProp(
          'saturation',
        ),
      );
    });

    describe('when a fighter leaves or enters', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('dims the ghost entry of a fallen enemy with its row, and the reinforcement that enters', async () => {
        const knight: TrackEntry = { actor: 2, fighter: 'fallenKnight', phase2: false };
        await render(
          <ActionTrack
            track={{
              round: 4,
              current: [specter, hero, ghoul(2)],
              next: [specter, hero, ghoul(2)],
            }}
            enemyPhase
          />,
        );
        await screen.rerender(
          <ActionTrack
            track={{ round: 4, current: [specter, hero, knight], next: [specter, hero, knight] }}
            enemyPhase
          />,
        );

        const [inRound, inPreview] = screen.getAllByTestId('track-ghost', hiddenToo);
        expect(shadeStyle(inRound!)).toMatchObject({ opacity: 0.55 });
        expect(shadeStyle(inPreview!)).toMatchObject({ opacity: 0.68 });
        const knights = entries().filter(
          (entry) =>
            within(entry).getByTestId('track-portrait', hiddenToo).props.sprite ===
            'portrait:fallenKnight',
        );
        expect(knights).toHaveLength(2);
        expect(shadeStyle(knights[0]!)).toMatchObject({ opacity: 0.55 });
        expect(shadeStyle(knights[1]!)).toMatchObject({ opacity: 0.68 });
      });
    });
  });

  describe('when a fighter leaves or enters', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    const before: ActionTrackView = {
      round: 4,
      current: [hero, ghoul(0), ghoul(2)],
      next: [specter, hero, ghoul(0), ghoul(2)],
    };
    const fallen: ActionTrackView = {
      round: 4,
      current: [hero, ghoul(2)],
      next: [specter, hero, ghoul(2)],
    };

    it('greys the fallen enemy at its former places, then closes them within 400 ms', async () => {
      await render(<ActionTrack track={before} />);
      await screen.rerender(<ActionTrack track={fallen} />);

      const ghosts = screen.getAllByTestId('track-ghost', hiddenToo);
      expect(ghosts).toHaveLength(2);
      expect(screen.getByTestId('battle-action-track')).toHaveProp(
        'accessibilityLabel',
        "Ordre d'action. Manche 4 : toi, Goule. Manche suivante : Spectre, toi, Goule.",
      );
      expect(Number(getAnimatedStyle(ghosts[0]!).opacity)).toBe(1);
      await wait(150);
      expect(
        Number(getAnimatedStyle(screen.getAllByTestId('track-ghost', hiddenToo)[0]!).opacity),
      ).toBe(0.6);
      await wait(260);
      expect(screen.queryAllByTestId('track-ghost', hiddenToo)).toHaveLength(0);
    });

    it('draws the next one at 48 dp, in its frame, at once when the acting enemy falls', async () => {
      // La Goule tombe pendant son propre tour (Contre-attaque, Riposte du Rempart).
      await render(
        <ActionTrack
          track={{ round: 4, current: [ghoul(0), hero, specter], next: [specter, hero, ghoul(0)] }}
        />,
      );
      await screen.rerender(
        <ActionTrack track={{ round: 4, current: [hero, specter], next: [specter, hero] }} />,
      );

      expect(screen.getAllByTestId('track-ghost', hiddenToo)).toHaveLength(2);
      const [first] = portraits().filter(
        (portrait) => portrait.props.sprite === 'portrait:wanderer',
      );
      expect(first).toHaveProp('scale', 2);
      expect(first).not.toHaveProp('size');
      expect(StyleSheet.flatten(entries()[0]!.props.style)).toMatchObject({
        width: 52,
        height: 52,
      });
      expect(within(entries()[0]!).getByTestId('track-current-arrow', hiddenToo)).toBeTruthy();
    });

    it.each([
      [375, -4],
      [360, -2],
    ])(
      'closes the ghost entry over the gap of the track (%i dp wide: %i dp)',
      async (width, recoil) => {
        jest
          .spyOn(Dimensions, 'get')
          .mockReturnValue({ width, height: 640, scale: 2.625, fontScale: 1 });
        await render(<ActionTrack track={before} />);
        await screen.rerender(<ActionTrack track={fallen} />);
        // Au 3e palier sur 4 (300 ms), la case a fait les deux tiers de son recul.
        await wait(350);
        const [ghost] = screen.getAllByTestId('track-ghost', hiddenToo);
        expect(Number(getAnimatedStyle(ghost!).marginRight)).toBeCloseTo((recoil * 2) / 3);
        jest.restoreAllMocks();
      },
    );

    it('greys the ghost entry under a veil of ink at 0.4 from its 2nd step', async () => {
      await render(<ActionTrack track={before} />);
      await screen.rerender(<ActionTrack track={fallen} />);
      const veil = () => screen.getAllByTestId('track-ghost-veil', hiddenToo)[0]!;

      expect(Number(getAnimatedStyle(veil()).opacity)).toBe(0);
      expect(StyleSheet.flatten(veil().props.style).backgroundColor).toBe(artPalette.roles.ink);
      await wait(150);
      expect(Number(getAnimatedStyle(veil()).opacity)).toBe(0.4);
    });

    it('clears the timer of a ghost entry when the track is unmounted while it leaves', async () => {
      // Les espions sur les minuteurs simulés sont retirés après le test.
      const set = jest.spyOn(globalThis, 'setTimeout');
      const clear = jest.spyOn(globalThis, 'clearTimeout');
      await render(<ActionTrack track={before} />);
      await screen.rerender(<ActionTrack track={fallen} />);
      const timers = set.mock.calls.flatMap(([, ms], index) =>
        ms === TRACK_LEAVE_MS ? [set.mock.results[index]!.value as unknown] : [],
      );
      expect(timers).toHaveLength(2);

      await screen.unmount();
      timers.forEach((timer) => expect(clear).toHaveBeenCalledWith(timer));
    });

    it('lets a reinforcement enter within 300 ms', async () => {
      await render(<ActionTrack track={fallen} />);
      const knight: TrackEntry = { actor: 0, fighter: 'fallenKnight', phase2: false };
      await screen.rerender(
        <ActionTrack
          track={{ round: 5, current: [knight, hero, ghoul(2)], next: [knight, hero, ghoul(2)] }}
        />,
      );

      const entering = () => screen.getAllByTestId('track-entry', hiddenToo)[0]!;
      expect(Number(getAnimatedStyle(entering()).opacity)).toBe(0);
      await wait(320);
      expect(Number(getAnimatedStyle(entering()).opacity)).toBe(1);
      expect(getAnimatedStyle(entering())).toMatchObject({ transform: [{ translateY: 0 }] });
    });

    it('removes and adds entries at once with reduced motion', async () => {
      await render(<ActionTrack track={before} reducedMotion />);
      await screen.rerender(<ActionTrack track={fallen} reducedMotion />);
      expect(screen.queryAllByTestId('track-ghost', hiddenToo)).toHaveLength(0);

      await screen.rerender(<ActionTrack track={before} reducedMotion />);
      entries().forEach((entry) => expect(Number(getAnimatedStyle(entry).opacity ?? 1)).toBe(1));
    });
  });
});
