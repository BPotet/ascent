import type { Actor } from '../../../domain/battle/actionOrder';
import {
  startBattle,
  type Battle,
  type BattlePhase,
  type EnemyState,
} from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { startTestBattle } from '../../../domain/battle/testing/testBattle';
import { actionTrackView, battleView } from './battleView';

const started = startTestBattle({
  seed: 1,
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
const bulwark = { power: 'bulwark', cost: 1, missing: 0, availability: 'available' } as const;

const attack = (attackKind: 'basic' | 'perilous' | 'delayedPerilous') =>
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
      pad: { kind: 'hero', locked: false, lock: null, powers: [bulwark] },
      line: { before: 'Cible : ', strong: 'Goule', after: '' },
      sealed: null,
      defenseHint: false,
      heroActions: true,
      trimmed: false,
    });
  });

  it('tells the momentum the power misses', () => {
    const view = battleView(inPhase(hero, { hero: { ...started.hero, momentum: 0 } }));

    expect(view.pad).toMatchObject({
      powers: [{ power: 'bulwark', cost: 1, missing: 1, availability: 'missing' }],
    });
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

    expect(view.pad).toEqual({ kind: 'hero', locked: true, lock: null, powers: [bulwark] });
    expect(view.line).toEqual({ before: 'Cible : ', strong: 'Spectre', after: '' });
    expect(view.heroActions).toBe(false);
  });

  it('locks the defense buttons during the rise of the second chance, then frees them (#206)', () => {
    const rising = (now: number) =>
      inPhase(
        {
          ...attack('basic'),
          step: { ...attack('basic').step, secondChance: { since: 1_160, until: 3_160 } },
        },
        { ...inEnemyPhase, now },
      );

    expect(battleView(rising(1_160)).pad).toEqual({
      kind: 'defense',
      locked: true,
      lock: { since: 1_160, until: 3_160 },
      offBalance: false,
    });
    expect(battleView(rising(3_160)).pad).toMatchObject({ kind: 'defense', locked: false });
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
      { kind: 'hero', locked: true, lock: { since: 500, until: 1_300 }, powers: [bulwark] },
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
    // Le coup retardé imparable : le sceau, toute l'étape, hésitation comprise (D2).
    expect(battleView(inPhase(attack('delayedPerilous'), inEnemyPhase)).sealed).toBe(1);
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
      pad: { kind: 'hero', locked: true, lock: null, powers: [bulwark] },
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
        phase2: false,
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

    it('tags a cursed enemy « Maudite » apart from « Relevé », and names it « Goule maudite » (#209)', () => {
      const cursed = withEnemy(inPhase(hero), 0, { cursed: true, selfRevives: 1 });
      const [ghoul] = battleView(cursed).enemies;

      expect(ghoul).toMatchObject({ name: 'Goule', curse: 'Maudite', tag: 'Relevée' });
      expect(ghoul!.label).toMatch(/^Goule maudite, relevée, cible, /);
      expect(battleView(cursed).line).toMatchObject({ strong: 'Goule maudite' });
      expect(battleView(inPhase(hero)).enemies[0]).not.toHaveProperty('curse');
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

      expect(ghoul!.rising).toEqual({ since: 100, until: 500, selfRevive: false });
    });

    it('says when the rising is a Self revive, for its rising poses (#38)', () => {
      const [ghoul] = battleView(
        withEnemy(inPhase(hero), 0, {
          guardRestore: { since: 100, until: 500, cause: 'selfRevive' },
        }),
      ).enemies;

      expect(ghoul!.rising).toEqual({ since: 100, until: 500, selfRevive: true });
    });

    it('says when a boss has shifted to phase 2, for its phase 2 aspect (#38)', () => {
      const [ghoul] = battleView(withEnemy(inPhase(hero), 0, { phase2: true })).enemies;

      expect(ghoul!.phase2).toBe(true);
    });

    it('shows a fallen enemy without intent', () => {
      const [ghoul] = battleView(withEnemy(inPhase(hero), 0, { hp: 0 })).enemies;

      expect(ghoul).toMatchObject({ standing: false, intent: null, label: 'Goule, tombée' });
    });
  });

  describe('the instant Shadow Step of the Wanderer (#173)', () => {
    const wanderer = (phase: BattlePhase, hero: Partial<Battle['hero']> = {}): Battle =>
      inPhase(phase, { heroKind: 'wanderer', hero: { ...started.hero, ...hero } });

    it('marks the power slot instant, never the Bulwark', () => {
      expect(battleView(wanderer(hero, { momentum: 3 })).pad).toMatchObject({
        kind: 'hero',
        powers: [{ power: 'shadowStep', cost: 3, missing: 0, instant: true }],
      });
      expect(battleView(wanderer(hero, { momentum: 2 })).pad).toMatchObject({
        powers: [{ missing: 1, instant: true }],
      });
      const sentinel = battleView(inPhase(hero)).pad;
      expect(sentinel.kind === 'hero' && sentinel.powers[0]!.instant).toBeFalsy();
    });

    it('keeps the hero phase after the cast: active, unlocked, and « Toujours à toi : attaque. »', () => {
      const view = battleView(
        wanderer({ ...hero, instantPowerUsed: true }, { momentum: 0, shadowStep: true }),
      );

      expect(view).toMatchObject({
        phase: 'hero',
        banner: null,
        pad: {
          kind: 'hero',
          locked: false,
          lock: null,
          instantCast: true,
          powers: [{ availability: 'active', instant: true }],
        },
        line: { before: '', strong: 'Toujours à toi', after: ' : attaque.' },
        heroActions: true,
      });
    });

    it('keeps the target line when the Shadow Step was cast in an earlier phase', () => {
      const view = battleView(wanderer(hero, { momentum: 3, shadowStep: true }));

      expect(view.pad).toMatchObject({ powers: [{ availability: 'active' }] });
      expect(view.pad).not.toHaveProperty('instantCast');
      expect(view.line).toEqual({ before: 'Cible : ', strong: 'Goule', after: '' });
    });
  });

  describe('the equipped powers (#235)', () => {
    it('gives one key per equipped power, in the order of the battle, with its availability', () => {
      const battle = inPhase(
        { ...hero, instantPowerUsed: true },
        {
          heroKind: 'wanderer',
          powers: ['shadowStep', 'rend', 'mist'],
          hero: { ...started.hero, momentum: 1, rend: true },
        },
      );

      expect(battleView(battle).pad).toMatchObject({
        kind: 'hero',
        instantCast: true,
        powers: [
          { power: 'shadowStep', cost: 3, availability: 'instantUsed', instant: true },
          { power: 'rend', cost: 1, availability: 'active', instant: true },
          { power: 'mist', cost: 2, availability: 'instantUsed', instant: true },
        ],
      });
    });

    it('says a power used this battle and the momentum it misses', () => {
      const battle = inPhase(hero, {
        powers: ['bulwark', 'retaliation', 'holdFast'],
        hero: { ...started.hero, momentum: 2, spent: ['holdFast'], bulwark: true },
      });

      expect(battleView(battle).pad).toMatchObject({
        powers: [
          { power: 'bulwark', availability: 'active' },
          { power: 'retaliation', availability: 'available', missing: 0 },
          { power: 'holdFast', availability: 'usedThisBattle' },
        ],
      });
      const poor = inPhase(hero, {
        powers: ['bulwark', 'holdFast'],
        hero: { ...started.hero, momentum: 2 },
      });
      expect(battleView(poor).pad).toMatchObject({
        powers: [{}, { power: 'holdFast', availability: 'missing', missing: 1 }],
      });
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

describe('actionTrackView: the cursed enemy (#209)', () => {
  it('marks the entries of the cursed enemy, and only them', () => {
    const battle = startBattle({
      seed: 1,
      defenseHint: false,
      at: 0,
      initiative: true,
      enemies: ['ghoul', 'specter'],
      cursed: 1,
    }).battle;
    const track = actionTrackView({ ...battle, turn: { order: [1, 'hero', 0], position: 0 } });

    expect(track.current).toEqual([
      { actor: 1, fighter: 'specter', phase2: false, cursed: true },
      { actor: 'hero', fighter: 'sentinel', phase2: false },
      { actor: 0, fighter: 'ghoul', phase2: false },
    ]);
    expect(track.next.filter((entry) => entry.cursed === true)).toHaveLength(1);
  });
});

describe('actionTrackView (#175)', () => {
  const battleOf = (hero: 'sentinel' | 'wanderer', enemies: readonly EnemyKind[]) =>
    startBattle({ seed: 1, defenseHint: false, at: 0, hero, initiative: true, enemies }).battle;

  /** Le combat avec l'ordre de la manche en cours `order`, au début de la manche. */
  const withOrder = (battle: Battle, order: readonly Actor[]): Battle => ({
    ...battle,
    turn: { order, position: 0 },
  });

  it('gives each entry its fighter: the hero kind, or the code name of the enemy', () => {
    const battle = withOrder(battleOf('wanderer', ['ghoul', 'specter']), [1, 'hero', 0]);
    const track = actionTrackView(battle);
    expect(track.current).toEqual([
      { actor: 1, fighter: 'specter', phase2: false },
      { actor: 'hero', fighter: 'wanderer', phase2: false },
      { actor: 0, fighter: 'ghoul', phase2: false },
    ]);
    expect(track.next.map((entry) => entry.fighter).sort()).toEqual(
      ['ghoul', 'specter', 'wanderer'].sort(),
    );
    expect(actionTrackView(battleOf('sentinel', ['ghoul'])).next).toContainEqual({
      actor: 'hero',
      fighter: 'sentinel',
      phase2: false,
    });
  });

  it('marks the entries of a boss in phase 2, in the round and in the preview', () => {
    const battle = withEnemy(withOrder(battleOf('sentinel', ['ashGardener']), [0, 'hero']), 0, {
      phase2: true,
    });
    const track = actionTrackView(battle);
    expect(track.current[0]).toEqual({ actor: 0, fighter: 'ashGardener', phase2: true });
    expect(track.next).toContainEqual({ actor: 0, fighter: 'ashGardener', phase2: true });
    expect(track.current[1]).toEqual({ actor: 'hero', fighter: 'sentinel', phase2: false });
  });

  it('leaves a fallen enemy out of the round', () => {
    const battle = withEnemy(
      withOrder(battleOf('sentinel', ['ghoul', 'ghoul']), [0, 'hero', 1]),
      0,
      { hp: 0 },
    );
    expect(actionTrackView(battle).current.map((entry) => entry.actor)).toEqual(['hero', 1]);
  });

  it('is empty at the end of the battle', () => {
    const battle = { ...battleOf('sentinel', ['ghoul']), phase: { kind: 'over' } } as Battle;
    expect(actionTrackView(battle)).toEqual({ round: battle.round, current: [], next: [] });
  });
});
