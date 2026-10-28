import {
  startTrialBattle,
  type Battle,
  type BattlePhase,
  type EnemyState,
} from '../../../domain/battle/Battle';
import { DEFAULT_TRIAL_TUNING } from '../../../domain/battle/TrialTuning';
import { battleView } from './battleView';

const started = startTrialBattle({
  seed: 1,
  tuning: DEFAULT_TRIAL_TUNING,
  defenseHint: false,
  at: 0,
}).battle;

function inPhase(phase: BattlePhase, change: Partial<Battle> = {}): Battle {
  return { ...started, phase, ...change };
}

function withEnemy(battle: Battle, enemy: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((current, index) =>
      index === enemy ? { ...current, ...change } : current,
    ),
  };
}

const hero = { kind: 'hero', since: 0, announced: false } as const;
const bulwark = { power: 'bulwark', cost: 1, missing: 0 } as const;

const attack = (attackKind: 'basic' | 'perilous') =>
  ({
    kind: 'enemy',
    step: {
      kind: 'attack',
      enemy: 1,
      attack: attackKind,
      damage: 6,
      startedAt: 0,
      feintAt: null,
      feintShown: false,
      impacts: [{ at: 1_000, landed: false, lost: false, outcome: null }],
      resolvedAt: 1_160,
      counter: null,
    },
  }) as const;

/** En phase ennemie : un ennemi a déjà joué une action. */
const inEnemyPhase = { lastPlayed: 'enemy' } as const;

describe('battleView', () => {
  it('shows Pouvoir on the left, « Attaquer » on the right and the target in the hero phase', () => {
    expect(battleView(inPhase(hero))).toMatchObject({
      phase: 'hero',
      banner: null,
      pad: { kind: 'hero', locked: false, lock: null, power: bulwark },
      line: { before: 'Cible : ', strong: 'Goule', after: '' },
      sealed: null,
      defenseHint: false,
      heroActions: true,
      trimmed: false,
    });
  });

  it('tells the momentum the power misses', () => {
    const view = battleView(inPhase(hero, { hero: { ...started.hero, momentum: 0 } }));

    expect(view.pad).toMatchObject({ power: { power: 'bulwark', cost: 1, missing: 1 } });
  });

  it('marks a stunned target ×1.5 on the line', () => {
    const view = battleView(
      withEnemy(inPhase(hero), 0, { guard: 0, stun: { actionLost: true, heroAction: 1 } }),
    );

    expect(view.line).toEqual({ before: 'Cible : ', strong: 'Goule', after: ' · ×1,5' });
  });

  it('announces « À toi » when the hero phase starts without transition', () => {
    expect(battleView(inPhase({ kind: 'hero', since: 3_000, announced: true })).banner).toEqual({
      to: 'hero',
      since: 3_000,
      until: 3_800,
    });
  });

  it('turns « Attaquer » into « Frapper » during the timed strike', () => {
    const view = battleView(
      inPhase({
        kind: 'heroStrike',
        enemy: 0,
        since: 1_000,
        impactAt: 1_700,
        press: null,
        resolved: false,
        until: 2_180,
      }),
    );

    expect(view).toMatchObject({
      phase: 'hero',
      pad: { kind: 'strike', since: 1_000, impactAt: 1_700, resolved: false },
      line: { before: 'Touche ', strong: 'Frapper', after: ' quand la barre atteint le trait.' },
      heroActions: false,
    });
  });

  it('locks the hero buttons while a power is resolved', () => {
    const view = battleView(
      inPhase({ kind: 'heroPower', power: 'bulwark', since: 0, until: 500 }, { target: 1 }),
    );

    expect(view.pad).toEqual({ kind: 'hero', locked: true, lock: null, power: bulwark });
    expect(view.line).toEqual({ before: 'Cible : ', strong: 'Spectre', after: '' });
    expect(view.heroActions).toBe(false);
  });

  it('locks the defense buttons under the defense hint, the enemy phase trimmed', () => {
    const view = battleView(inPhase({ kind: 'defenseHint', since: 0 }));

    expect(view).toMatchObject({
      phase: 'enemy',
      defenseHint: true,
      pad: { kind: 'defense', locked: true, lock: null, offBalance: false },
      line: null,
      trimmed: true,
    });
  });

  it.each([
    [
      'enemy',
      { kind: 'defense', locked: true, lock: { since: 500, until: 1_300 }, offBalance: false },
      true,
    ],
    [
      'hero',
      { kind: 'hero', locked: true, lock: { since: 500, until: 1_300 }, power: bulwark },
      false,
    ],
  ] as const)(
    'announces the phase transition to the %s phase, buttons locked',
    (to, pad, trimmed) => {
      const view = battleView(inPhase({ kind: 'transition', to, since: 500, until: 1_300 }));

      expect(view).toMatchObject({
        phase: to,
        banner: { to, since: 500, until: 1_300 },
        pad,
        line: null,
        trimmed,
      });
    },
  );

  it('puts the enemy that steps in to the front, the others faded, nothing written', () => {
    const view = battleView(
      inPhase(
        { kind: 'enemy', step: { kind: 'stepIn', enemy: 0, since: 0, until: 400 } },
        inEnemyPhase,
      ),
    );

    expect(view).toMatchObject({
      phase: 'enemy',
      pad: { kind: 'defense', locked: false, lock: null, offBalance: false },
      line: null,
      sealed: null,
      trimmed: true,
    });
    expect(view.enemies.map(({ active, dimmed }) => ({ active, dimmed }))).toEqual([
      { active: true, dimmed: false },
      { active: false, dimmed: true },
      { active: false, dimmed: true },
    ]);
  });

  it('never writes the attack, and puts the seal on a perilous attack', () => {
    expect(battleView(inPhase(attack('basic'), inEnemyPhase))).toMatchObject({
      line: null,
      sealed: null,
    });
    expect(battleView(inPhase(attack('perilous'), inEnemyPhase)).sealed).toBe(1);
  });

  it('hatches the defense buttons during off-balance', () => {
    expect(
      battleView(inPhase(attack('basic'), { ...inEnemyPhase, offBalanceUntil: 900 })).pad,
    ).toEqual({ kind: 'defense', locked: false, lock: null, offBalance: true });
  });

  it('keeps the hero buttons locked and hides the pill while an enemy loses its action after the hero (C5.4)', () => {
    const view = battleView(
      withEnemy(
        inPhase(
          { kind: 'enemy', step: { kind: 'lostAction', enemy: 0, since: 0, until: 250 } },
          { lastPlayed: 'hero' },
        ),
        0,
        { guard: 0, stun: { actionLost: true, heroAction: 1 } },
      ),
    );

    expect(view).toMatchObject({
      phase: null,
      pad: { kind: 'hero', locked: true, lock: null, power: bulwark },
      line: null,
      trimmed: false,
    });
    expect(view.enemies[0]).toMatchObject({ losingAction: true, active: false, stunned: true });
    // Ce n'est pas une action : les autres ennemis ne sont pas estompés.
    expect(view.enemies.some((enemy) => enemy.dimmed)).toBe(false);
  });

  it('keeps the defense buttons during a lost action inside the enemy phase', () => {
    const view = battleView(
      inPhase(
        { kind: 'enemy', step: { kind: 'guardRestore', enemy: 2, since: 0, until: 400 } },
        inEnemyPhase,
      ),
    );

    expect(view).toMatchObject({
      phase: 'enemy',
      pad: { kind: 'defense', locked: false },
      trimmed: true,
    });
    expect(view.enemies[2]).toMatchObject({ active: false, losingAction: false });
  });

  describe('the plate of an enemy', () => {
    it('shows its HP, its name, its guard and its intent in the hero phase', () => {
      const [ghoul] = battleView(inPhase(hero)).enemies;

      expect(ghoul).toEqual({
        kind: 'ghoul',
        name: 'Goule',
        standing: true,
        target: true,
        hpRatio: 1,
        hpText: '50/50 PV',
        guardRatio: 1,
        guardText: 'Garde 15/15',
        stunned: false,
        losingAction: false,
        rising: null,
        intent: { category: 'attack' },
        active: false,
        dimmed: false,
        tag: null,
        label: expect.stringMatching(/^Goule, cible, 50 PV sur 50, garde 15 sur 15/),
      });
    });

    it('tags an enemy that has revived by itself « Relevé », even in the enemy phase (#106)', () => {
      const revived = withEnemy(inPhase(attack('basic'), inEnemyPhase), 0, { selfRevives: 1 });

      expect(battleView(revived).enemies[0]).toMatchObject({ tag: 'Relevée' });
      expect(battleView(revived).enemies[0]!.label).toMatch(/^Goule, relevée, /);
    });

    it('hides the names and the HP figures in the enemy phase, but not the screen reader label', () => {
      const [ghoul] = battleView(inPhase(attack('basic'), inEnemyPhase)).enemies;

      expect(ghoul).toMatchObject({ name: null, hpText: null, guardText: null, target: false });
      expect(ghoul!.label).toMatch(/^Goule, 50 PV sur 50/);
    });

    it('turns the guard into « Étourdie ×1,5 » and shows the barred circle while the action is to lose', () => {
      const [ghoul] = battleView(
        withEnemy(inPhase(attack('basic'), inEnemyPhase), 0, {
          guard: 0,
          stun: { actionLost: false, heroAction: 1 },
        }),
      ).enemies;

      expect(ghoul).toMatchObject({
        stunned: true,
        guardRatio: 0,
        guardText: 'Étourdie ×1,5',
        intent: { category: 'skip', reason: 'stunned' },
      });
    });

    it('exposes the guard restore for the rising pose', () => {
      const [ghoul] = battleView(
        withEnemy(inPhase(hero), 0, { guardRestore: { since: 100, until: 500 } }),
      ).enemies;

      expect(ghoul!.rising).toEqual({ since: 100, until: 500 });
    });

    it('shows a fallen enemy without intent', () => {
      const [ghoul] = battleView(withEnemy(inPhase(hero), 0, { hp: 0 })).enemies;

      expect(ghoul).toMatchObject({ standing: false, intent: null, label: 'Goule, tombée' });
    });
  });

  it('shows no button at the end of the battle', () => {
    expect(battleView(inPhase({ kind: 'over', outcome: 'victory', at: 0 }))).toMatchObject({
      phase: null,
      pad: { kind: 'none' },
      line: null,
    });
  });
});
