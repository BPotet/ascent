// L'Élite escortée dans la vue du combat (#257, maquette 245, E2, E3, E6, E7, E8) : la mise en page
// de l'Élite qui mène, la couronne d'Élite sur sa plaque et sur sa case de frise, les étiquettes
// qui s'y ajoutent, et les libellés du lecteur d'écran.
import { startBattle, type Battle, type EnemyState } from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { TIERS } from '../../../domain/ascent/tiers';
import { actionTrackView, battleView } from './battleView';

function escorted(enemies: readonly EnemyKind[], cursed?: number): Battle {
  const battle = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies,
    tierMultiplier: TIERS[3].eliteMultiplier,
    escortMultiplier: TIERS[3].multiplier,
    ...(cursed !== undefined && { cursed }),
  }).battle;
  return { ...battle, phase: { kind: 'hero', since: 0, announced: false } };
}

function alone(enemies: readonly EnemyKind[]): Battle {
  const { battle } = startBattle({ seed: 1, defenseHint: false, at: 0, initiative: true, enemies });
  return { ...battle, phase: { kind: 'hero', since: 0, announced: false } };
}

function withEnemies(battle: Battle, change: (enemy: EnemyState, index: number) => EnemyState) {
  return { ...battle, enemies: battle.enemies.map(change) };
}

const trackEntries = (battle: Battle) => {
  const { current, next } = actionTrackView(battle);
  return [...current, ...next].filter((entry) => entry.actor !== 'hero');
};

describe('the lead layout of an escorted Elite (#257, E2, E7)', () => {
  it('lays an Elite escorted by 2, or by 1, in the lead layout', () => {
    expect(battleView(escorted(['firstPilgrim', 'bellNovice', 'clockJack']))).toMatchObject({
      leadLayout: true,
      columns: 3,
    });
    expect(battleView(escorted(['scarecrow', 'mothkin']))).toMatchObject({
      leadLayout: true,
      columns: 2,
    });
  });

  it('keeps the layout of a lone Elite and of an ordinary battle', () => {
    expect(battleView(alone(['firstPilgrim'])).leadLayout).toBe(false);
    expect(battleView(alone(['ghoul', 'ghoul', 'ghoul'])).leadLayout).toBe(false);
    expect(battleView(alone(['ghoul', 'ghoul'])).leadLayout).toBe(false);
  });

  it('keeps the lead layout of the boss that summons (#172)', () => {
    expect(battleView(alone(['mothQueen', 'mothkin', 'mothkin'])).leadLayout).toBe(true);
  });
});

describe('the crown of the Elite (#257, E2, E8)', () => {
  it('crowns the plate of the Elite, never its escort', () => {
    const { enemies } = battleView(escorted(['firstPilgrim', 'bellNovice', 'clockJack']));

    expect(enemies.map((enemy) => enemy.elite === true)).toEqual([true, false, false]);
    expect(enemies.map((enemy) => enemy.escort === true)).toEqual([false, true, true]);
  });

  it('crowns the track entry of the Elite while an escort enemy stands', () => {
    const entries = trackEntries(escorted(['firstPilgrim', 'bellNovice', 'clockJack']));

    expect(entries.filter((entry) => entry.crowned)).not.toHaveLength(0);
    for (const entry of entries) expect(entry.crowned === true).toBe(entry.actor === 0);
  });

  it('keeps the crown on the plate but takes it off the track once the escort has fallen (E8)', () => {
    const battle = withEnemies(escorted(['firstPilgrim', 'bellNovice']), (enemy, index) =>
      index === 0 ? enemy : { ...enemy, hp: 0 },
    );

    expect(battleView(battle).enemies[0]!.elite).toBe(true);
    expect(trackEntries(battle).some((entry) => entry.crowned)).toBe(false);
  });

  it('crowns no lone Elite', () => {
    const view = battleView(alone(['firstPilgrim']));

    expect(view.enemies[0]!.elite).toBeUndefined();
    expect(trackEntries(alone(['firstPilgrim'])).some((entry) => entry.crowned)).toBe(false);
  });

  it('adds the curse tag to the crown of a cursed Elite, without taking it (E6)', () => {
    const battle = escorted(['firstPilgrim', 'bellNovice', 'clockJack'], 0);
    const [elite] = battleView(battle).enemies;

    expect(elite).toMatchObject({ elite: true, curse: 'Maudit' });
    expect(trackEntries(battle).find((entry) => entry.actor === 0)).toMatchObject({
      crowned: true,
      cursed: true,
    });
  });
});

describe('the escorted Elite read by the screen reader (#257, E2, E3)', () => {
  it('reads the Elite as « Élite », then target, HP, guard and intent', () => {
    const [elite] = battleView(escorted(['firstPilgrim', 'bellNovice', 'clockJack'])).enemies;

    expect(elite!.label).toMatch(
      /^Premier Pèlerin, Élite, cible, 237 PV sur 237, garde 82 sur 82/u,
    );
  });

  it('reads an escort enemy that is not the target with « Touche pour viser »', () => {
    const battle = escorted(['firstPilgrim', 'bellNovice', 'clockJack']);
    const [, novice] = battleView(battle).enemies;

    expect(novice!.label).toMatch(/^Novice des cloches, 45 PV sur 45, garde 24 sur 24/u);
    expect(novice!.label).toMatch(/\. Touche pour viser$/u);
    const targeted = battleView({ ...battle, target: 1 }).enemies[1]!;
    expect(targeted.label).toMatch(/^Novice des cloches, cible, /u);
    expect(targeted.label).not.toMatch(/Touche pour viser/u);
  });
});
