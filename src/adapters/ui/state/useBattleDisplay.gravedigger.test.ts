// L'Exhumation dans l'état d'affichage (#258, maquette 245, F3) : l'annonce « Il exhume un
// Squelette » (1 600 ms, elle ne bloque rien), la sortie de terre du Squelette à sa place, et le
// lecteur d'écran.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { INITIAL_DISPLAY, announcementsOf, displayOf } from './useBattleDisplay';

const digger: Battle = startBattle({
  seed: 1,
  defenseHint: false,
  at: 0,
  enemies: ['gravedigger', 'skeleton'],
}).battle;

function snapshot(events: readonly BattleEvent[], battle: Battle = digger): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const exhumed = (slot = 1, at = 3_000): BattleEvent => ({
  type: 'enemyExhumed',
  at,
  enemy: 0,
  slot,
  kind: 'skeleton',
});

describe('the exhumation in the display state (#258, F3)', () => {
  it('starts without any exhumed Skeleton', () => {
    expect(INITIAL_DISPLAY.exhumeFx).toEqual({});
  });

  it('announces « Il exhume un Squelette », in bone colours', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot([exhumed()]), false);

    expect(shown.summonBanner).toEqual({
      key: 1,
      at: 3_000,
      title: 'Il exhume un Squelette',
      line: 'Première place libre · il n’agit pas cette manche',
      tone: 'grave',
    });
  });

  it('brings the Skeleton out of the ground at its place, standing, at the action', () => {
    const fallen = { ...INITIAL_DISPLAY, downSince: { 1: 1_000 } };
    const shown = displayOf(fallen, snapshot([exhumed()]), false);

    expect(shown.exhumeFx).toEqual({ 1: 3_000 });
    expect(shown.downSince).toEqual({});
    expect(shown.arrivals[1]).toBe(1);
  });

  it('keeps the place of each exhumation', () => {
    const first = displayOf(INITIAL_DISPLAY, snapshot([exhumed(1, 3_000)]), false);
    const second = displayOf(first, snapshot([exhumed(2, 9_000)]), false);

    expect(second.exhumeFx).toEqual({ 1: 3_000, 2: 9_000 });
    expect(second.summonBanner?.key).toBe(2);
  });

  it('reads « Le Fossoyeur exhume un Squelette. Squelette, invoqué, n’agit pas cette manche »', () => {
    expect(announcementsOf(snapshot([exhumed()]))).toContain(
      'Le Fossoyeur exhume un Squelette. Squelette, invoqué, n’agit pas cette manche',
    );
  });
});
