// La seconde chance dans l'état d'affichage (#206, maquette 205, S2, S3) : le héros tombe, le
// bandeau et le « +40 » en or attendent la fin du gel, et le lecteur d'écran dit tout en une phrase.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { INITIAL_DISPLAY, announcementsOf, displayOf } from './useBattleDisplay';

const battle = startBattle({
  seed: 1,
  defenseHint: false,
  at: 0,
  heroMaxHp: 80,
  enemies: ['ghoul', 'specter'],
  secondChance: true,
}).battle;

const falling: BattleEvent = {
  type: 'blowResolved',
  at: 5_000,
  enemy: 0,
  index: 0,
  outcome: 'suffered',
  button: null,
  delta: null,
  damage: 5,
  heroHp: 0,
};
const risen: BattleEvent = {
  type: 'secondChanceUsed',
  at: 5_000,
  until: 7_000,
  enemy: 0,
  hp: 40,
  cancelled: 1,
};

function snapshot(events: readonly BattleEvent[]): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

describe('the second chance in the display state (#206)', () => {
  it('starts without a rise', () => {
    expect(INITIAL_DISPLAY.secondChance).toBeNull();
  });

  it('lays the hero down, and keeps the rise with its banner and its « +40 » in gold', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot([falling, risen]), false);

    expect(shown).toMatchObject({ heroPose: 'fallen', heroPoseSince: 5_000 });
    expect(shown.secondChance).toEqual({
      key: 1,
      at: 5_000,
      until: 7_000,
      title: 'Seconde chance',
      lines: ['La Sentinelle se relève avec 40 PV.', 'Le second coup de la Goule est annulé.'],
      float: { at: 'hero', text: '+40', big: false, kind: 'secondChance' },
    });
    // Le « −5 » du coup qui fait tomber reste le chiffre du héros pendant le gel.
    expect(shown.heroFloat?.float.text).toBe('−5');
  });

  it('counts each rise with a new key', () => {
    const once = displayOf(INITIAL_DISPLAY, snapshot([risen]), false);

    expect(displayOf(once, snapshot([risen]), false).secondChance?.key).toBe(2);
  });

  it('says the rise to the screen reader, after the falling blow', () => {
    expect(announcementsOf(snapshot([falling, risen]))).toEqual([
      'Touché, 5 dégâts',
      'Seconde chance : la Sentinelle se relève avec 40 PV. Le second coup de la Goule est annulé.',
    ]);
  });
});
