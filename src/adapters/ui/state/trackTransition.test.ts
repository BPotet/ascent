// La sortie d'un ennemi tombé et l'entrée d'un renfort dans la Frise d'action (#175, maquette F3).
import type { ActionTrackView, TrackEntry } from './battleView';
import { placeGhosts, trackTransition } from './trackTransition';

const hero: TrackEntry = { actor: 'hero', fighter: 'sentinel', phase2: false };
const ghoul = (actor: number): TrackEntry => ({ actor, fighter: 'ghoul', phase2: false });
const specter: TrackEntry = { actor: 1, fighter: 'specter', phase2: false };

const track = (
  current: readonly TrackEntry[],
  next: readonly TrackEntry[],
  round = 3,
): ActionTrackView => ({ round, current, next });

describe('trackTransition', () => {
  it('lets nothing leave or enter on the first render', () => {
    expect(trackTransition(null, track([hero, ghoul(0)], [hero, ghoul(0)]))).toEqual({
      leaving: [],
      entering: [],
    });
  });

  it('lets a fallen enemy leave the round and the preview, at its former places', () => {
    const before = track([hero, ghoul(0), specter], [specter, hero, ghoul(0)]);
    const after = track([hero, specter], [specter, hero]);
    expect(trackTransition(before, after)).toEqual({
      leaving: [
        { entry: ghoul(0), row: 'current', index: 1 },
        { entry: ghoul(0), row: 'next', index: 2 },
      ],
      entering: [],
    });
  });

  it('lets nothing leave when a fighter has acted, nor at the next round', () => {
    const before = track([ghoul(0), hero], [hero, ghoul(0)]);
    expect(trackTransition(before, track([hero], [hero, ghoul(0)]))).toEqual({
      leaving: [],
      entering: [],
    });
    expect(
      trackTransition(
        track([hero], [hero, ghoul(0)]),
        track([hero, ghoul(0)], [hero, ghoul(0)], 4),
      ),
    ).toEqual({
      leaving: [],
      entering: [],
    });
  });

  it('keeps an enemy that revives by itself, still in the preview', () => {
    const before = track([ghoul(0), hero], [ghoul(0), hero]);
    expect(trackTransition(before, track([hero], [ghoul(0), hero])).leaving).toEqual([]);
  });

  it('lets a reinforcement enter, even in the place of a fallen enemy', () => {
    const before = track([hero], [hero, specter]);
    const after = track([hero, ghoul(0), specter], [hero, ghoul(0), specter]);
    expect(trackTransition(before, after)).toEqual({ leaving: [], entering: [ghoul(0)] });
    const knight: TrackEntry = { actor: 0, fighter: 'fallenKnight', phase2: false };
    expect(
      trackTransition(
        track([hero, ghoul(0)], [hero, ghoul(0)]),
        track([hero, knight], [hero, knight]),
      ),
    ).toEqual({
      leaving: [
        { entry: ghoul(0), row: 'current', index: 1 },
        { entry: ghoul(0), row: 'next', index: 1 },
      ],
      entering: [knight],
    });
  });

  it('keeps a boss that changes phase: its entries only change their portrait', () => {
    const boss: TrackEntry = { actor: 0, fighter: 'ashGardener', phase2: false };
    const shifted: TrackEntry = { ...boss, phase2: true };
    expect(
      trackTransition(track([boss, hero], [boss, hero]), track([shifted, hero], [shifted, hero])),
    ).toEqual({
      leaving: [],
      entering: [],
    });
  });
});

describe('placeGhosts', () => {
  it('puts ghosts that are apart and given out of order back at their own places', () => {
    const skeleton: TrackEntry = { actor: 2, fighter: 'skeleton', phase2: false };
    // Avant : [Goule, toi, Spectre, Squelette, Goule(3)] ; la 1re et la 4e cases sortent.
    expect(
      placeGhosts(
        [hero, specter, ghoul(3)],
        [
          { entry: skeleton, row: 'current', index: 3 },
          { entry: ghoul(0), row: 'current', index: 0 },
        ],
      ),
    ).toEqual([
      { entry: ghoul(0), ghost: true },
      { entry: hero, ghost: false },
      { entry: specter, ghost: false },
      { entry: skeleton, ghost: true },
      { entry: ghoul(3), ghost: false },
    ]);
  });

  it('puts each ghost back at its former place, the others around it', () => {
    expect(placeGhosts([hero, specter], [{ entry: ghoul(0), row: 'current', index: 1 }])).toEqual([
      { entry: hero, ghost: false },
      { entry: ghoul(0), ghost: true },
      { entry: specter, ghost: false },
    ]);
  });

  it('puts a ghost past the end of a shorter row at its end', () => {
    expect(
      placeGhosts(
        [hero],
        [
          { entry: ghoul(0), row: 'next', index: 1 },
          { entry: ghoul(2), row: 'next', index: 3 },
        ],
      ),
    ).toEqual([
      { entry: hero, ghost: false },
      { entry: ghoul(0), ghost: true },
      { entry: ghoul(2), ghost: true },
    ]);
  });
});
