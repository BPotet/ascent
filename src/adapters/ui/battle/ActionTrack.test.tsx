// La Frise d'action à portraits (#175, maquette v2, F1 à F5) : le portrait de chaque case, à 48 dp
// pour celui qui agit et à 24 dp pour les autres, le repli sur « Toi » et l'initiale, la phrase du
// lecteur d'écran inchangée, la sortie d'un ennemi tombé et l'entrée d'un renfort.
import { act, render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { PORTRAITS } from '../pixelArt/sprites/atelier/data/portraits';
import type { ActionTrackView, TrackEntry } from '../state/battleView';
import { ActionTrack } from './ActionTrack';

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

  describe('when a fighter leaves or enters', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

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
