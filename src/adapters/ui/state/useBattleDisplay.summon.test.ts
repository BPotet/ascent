// L'Invocation dans l'état d'affichage (#172, maquette 170, I2, I3, I5) : l'annonce, la poussière à
// l'annonce, la sortie des Phalénides et leur chute avec la Reine, et le lecteur d'écran.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import {
  INITIAL_DISPLAY,
  announcementsOf,
  displayOf,
  type BattleDisplay,
} from './useBattleDisplay';

const queen = startBattle({ seed: 1, defenseHint: false, at: 0, enemies: ['mothQueen'] }).battle;

function snapshot(events: readonly BattleEvent[], battle: Battle = queen): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const show = (events: readonly BattleEvent[], from: BattleDisplay = INITIAL_DISPLAY) =>
  displayOf(from, snapshot(events), false);

const called: BattleEvent = {
  type: 'summonCalled',
  at: 1_000,
  enemy: 0,
  kind: 'mothkin',
  slots: [1, 2],
};
const entered = (enemy: number, at = 5_000): BattleEvent => ({
  type: 'summonEntered',
  at,
  enemy,
  kind: 'mothkin',
});

describe('the Summon in the display state (#172)', () => {
  it('starts without banner, dust nor summoned enemy', () => {
    expect(INITIAL_DISPLAY).toMatchObject({
      summonBanner: null,
      summonFx: { calledAt: null, entered: {}, fell: {} },
    });
  });

  it('shows the banner of the Summon and raises the dust at the announcement', () => {
    const shown = show([{ type: 'bossPhaseShifted', at: 1_000, enemy: 0 }, called]);

    expect(shown.summonBanner).toEqual({
      key: 1,
      at: 1_000,
      title: 'Elle appelle les Phalénides',
      line: 'La Reine des phalènes change de phase',
    });
    expect(shown.summonFx.calledAt).toBe(1_000);
  });

  it('says one Mothkin in the banner for a single slot', () => {
    const shown = show([{ ...called, slots: [2] }]);

    expect(shown.summonBanner?.title).toBe('Elle appelle une Phalénide');
  });

  it('brings each Mothkin out of the dust at its entry, in its own column', () => {
    const shown = show([entered(1), entered(2)]);

    expect(shown.summonFx.entered).toEqual({ 1: 5_000, 2: 5_000 });
    expect(shown.arrivals).toEqual({ 1: 1, 2: 1 });
  });

  it('forgets the fall of the enemy whose slot a Mothkin takes', () => {
    const fallen = show([{ type: 'guardBroken', at: 900, enemy: 1, by: 'strike' }]);

    expect(show([entered(1)], fallen).downSince).toEqual({});
  });

  it('brings them out after the drop of the Bleed and the crackle of the Burn, as they sound', () => {
    const bleeding: BattleEvent = {
      type: 'bleedTicked',
      at: 5_000,
      loss: 2,
      heroHp: 40,
      roundsLeft: 1,
    };
    const ticked: BattleEvent = { type: 'burnTicked', at: 5_000, loss: 2, heroHp: 38, stacks: 2 };

    expect(show([bleeding, ticked, entered(1)]).summonFx.entered).toEqual({ 1: 6_700 });
    expect(show([ticked, entered(1)]).summonFx.entered).toEqual({ 1: 6_000 });
  });

  it('drops each Mothkin back into dust when the Queen falls', () => {
    const shown = show([
      { type: 'enemyDefeated', at: 9_000, enemy: 0 },
      { type: 'summonedFell', at: 9_000, enemy: 1 },
      { type: 'summonedFell', at: 9_000, enemy: 2 },
    ]);

    expect(shown.summonFx.fell).toEqual({ 1: 9_000, 2: 9_000 });
  });

  it('keeps the banner and the dust from one update to the next', () => {
    const first = show([called]);
    const later = show([entered(1)], first);

    expect(later.summonBanner).toEqual(first.summonBanner);
    expect(later.summonFx.calledAt).toBe(1_000);
  });

  it('reads the Summon to the screen reader in one sentence', () => {
    const events: BattleEvent[] = [{ type: 'bossPhaseShifted', at: 1_000, enemy: 0 }, called];

    expect(announcementsOf(snapshot(events))).toEqual([
      'La Reine des phalènes change de phase. Elle appelle les Phalénides : deux Phalénides entrent à la prochaine manche.',
    ]);
  });
});
