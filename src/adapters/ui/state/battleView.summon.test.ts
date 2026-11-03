// L'Invocation dans la vue du combat (#172, maquette 170, I2, I3, I6, I8) : les places de
// poussière, la disposition du boss qui invoque, l'étiquette « Invoquée » et l'aperçu de la frise
// d'action en pointillé.
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { TIERS } from '../../../domain/ascent/tiers';
import { actionTrackView, battleView } from './battleView';

function battleOf(kinds: readonly EnemyKind[]): Battle {
  return startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: kinds,
    summonMultiplier: TIERS[2].multiplier,
  }).battle;
}

/** La Reine en phase 2, son Invocation annoncée aux places `slots`. */
function announced(kinds: readonly EnemyKind[], slots: readonly number[]): Battle {
  const battle = battleOf(kinds);
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) =>
      index === 0 ? { ...enemy, hp: 190, phase2: true } : { ...enemy, hp: 0 },
    ),
    summon: { summoner: 0, kind: 'mothkin', slots },
  };
}

describe('the dust of an announced summon in the view (#172)', () => {
  it('has no dust and one column per enemy without a summon', () => {
    const view = battleView(battleOf(['mothQueen']));

    expect(view.dust).toEqual([]);
    expect(view.columns).toBe(1);
    expect(view.summonerLayout).toBe(false);
  });

  it('lays a column of dust on each empty slot right of the Queen, in the boss layout', () => {
    const view = battleView(announced(['mothQueen'], [1, 2]));

    expect(view.dust).toEqual([1, 2]);
    expect(view.columns).toBe(3);
    expect(view.enemies).toHaveLength(1);
    expect(view.summonerLayout).toBe(true);
  });

  it('lays the dust on the slot of a fallen enemy, which keeps its column (I6)', () => {
    const view = battleView(announced(['mothQueen', 'mothkin', 'ghoul'], [1]));

    expect(view.dust).toEqual([1]);
    expect(view.columns).toBe(3);
    expect(view.enemies).toHaveLength(3);
  });

  it('keeps the boss layout once the Mothkin are in, for the whole battle', () => {
    const battle = battleOf(['mothQueen', 'mothkin', 'mothkin']);

    expect(battleView(battle).summonerLayout).toBe(true);
    expect(battleView(battleOf(['ghoul', 'ghoul', 'ghoul'])).summonerLayout).toBe(false);
  });
});

describe('the tag « Invoquée » in the view (#172)', () => {
  it('tags a summoned Mothkin, never one drawn in an ordinary group', () => {
    const battle = battleOf(['mothQueen', 'mothkin', 'mothkin']);
    const summoned: Battle = {
      ...battle,
      enemies: battle.enemies.map((enemy, index) =>
        index === 1 ? { ...enemy, summoned: true } : enemy,
      ),
    };
    const view = battleView(summoned);

    expect(view.enemies.map((enemy) => [enemy.tag, enemy.summoned])).toEqual([
      [null, undefined],
      ['Invoquée', true],
      [null, undefined],
    ]);
    expect(view.enemies[1]!.label).toMatch(/^Phalénide, invoquée, /u);
  });
});

describe('the action track with an announced summon (#172)', () => {
  it('shows the announced Mothkin in the next round preview, pending, at their Initiative', () => {
    const track = actionTrackView(announced(['mothQueen'], [1, 2]));

    expect(track.next).toEqual([
      { actor: 0, fighter: 'mothQueen', phase2: true },
      { actor: 1, fighter: 'mothkin', phase2: false, pending: true },
      { actor: 2, fighter: 'mothkin', phase2: false, pending: true },
      { actor: 'hero', fighter: 'sentinel', phase2: false },
    ]);
  });

  it('shows the Mothkin instead of the fallen enemy whose slot it takes', () => {
    const track = actionTrackView(announced(['mothQueen', 'ghoul', 'ghoul'], [2]));

    expect(track.next).toEqual([
      { actor: 0, fighter: 'mothQueen', phase2: true },
      { actor: 2, fighter: 'mothkin', phase2: false, pending: true },
      { actor: 'hero', fighter: 'sentinel', phase2: false },
    ]);
  });

  it('never marks an entered Mothkin pending', () => {
    const track = actionTrackView(battleOf(['mothQueen', 'mothkin']));

    expect(track.next.some((entry) => entry.pending === true)).toBe(false);
  });
});
