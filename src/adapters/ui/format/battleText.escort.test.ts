// Les textes de l'Élite escortée (#257, maquette 245, E2, E3, E9) : « L'escorte reste » quand
// l'Élite tombe pour de bon devant son escorte debout, et ses phrases au lecteur d'écran.
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { TIERS } from '../../../domain/ascent/tiers';
import { announcementsFor, enemyLabel, feedbackText } from './battleText';

/** Le combat après la chute des ennemis `fallen`, la cible sur `target`. */
function after(
  enemies: readonly EnemyKind[],
  fallen: readonly number[],
  target: number,
  escort = true,
): Battle {
  const { battle } = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies,
    tierMultiplier: TIERS[3].eliteMultiplier,
    ...(escort && { escortMultiplier: TIERS[3].multiplier }),
  });
  return {
    ...battle,
    target,
    enemies: battle.enemies.map((enemy, index) =>
      fallen.includes(index) ? { ...enemy, hp: 0 } : enemy,
    ),
  };
}

const defeated = (enemy: number): BattleEvent => ({ type: 'enemyDefeated', at: 0, enemy });
const targetChanged = (enemy: number): BattleEvent => ({ type: 'targetChanged', at: 0, enemy });

const ESCORTED: readonly EnemyKind[] = ['firstPilgrim', 'bronzeWarden', 'bellNovice'];

describe("« L'escorte reste » (#257, E9)", () => {
  it('says the escort stays when the Elite falls for good, its escort standing', () => {
    expect(feedbackText(defeated(0), after(ESCORTED, [0], 1))).toEqual({
      tone: 'escort',
      title: "L'escorte reste",
      sub: "Le combat continue jusqu'à la chute de tous",
    });
  });

  it('reads the fall of the Elite, the escort that stays and the new target', () => {
    expect(announcementsFor([defeated(0), targetChanged(1)], after(ESCORTED, [0], 1))).toEqual([
      "Premier Pèlerin tombe. L'escorte reste. Cible : Veilleur d'airain",
    ]);
  });

  it('says nothing once the escort has already fallen: the battle is won', () => {
    const battle = after(ESCORTED, [0, 1, 2], 0);

    expect(feedbackText(defeated(0), battle)).toBeNull();
    expect(announcementsFor([defeated(0)], battle)).toEqual([]);
  });

  it('says nothing when an escort enemy falls, nor outside an escorted Elite', () => {
    expect(feedbackText(defeated(1), after(ESCORTED, [1], 0))).toBeNull();
    expect(announcementsFor([defeated(1)], after(ESCORTED, [1], 0))).toEqual([]);
    const ordinary = after(['ghoul', 'specter'], [0], 1, false);
    expect(feedbackText(defeated(0), ordinary)).toBeNull();
    expect(announcementsFor([defeated(0)], ordinary)).toEqual([]);
  });
});

describe('the label of an escorted Elite and of its escort (#257, E2, E3)', () => {
  const [elite, warden] = after(ESCORTED, [], 0).enemies;

  it('names the Elite « Élite » before the target', () => {
    expect(enemyLabel(elite!, null, true, 'elite')).toBe(
      'Premier Pèlerin, Élite, cible, 237 PV sur 237, garde 82 sur 82',
    );
  });

  it('tells how to aim at an escort enemy that is not the target', () => {
    expect(enemyLabel(warden!, null, false, 'escort')).toBe(
      "Veilleur d'airain, 113 PV sur 113, garde 72 sur 72. Touche pour viser",
    );
    expect(enemyLabel(warden!, null, true, 'escort')).toBe(
      "Veilleur d'airain, cible, 113 PV sur 113, garde 72 sur 72",
    );
  });
});
