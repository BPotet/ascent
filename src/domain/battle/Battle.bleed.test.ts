// Le Saignement dans le combat (prototype #107) : déclenchement (B1), perte au début des manches
// (B2), ni réduction ni Rempart (B3), sans cumul (B4), plancher (B5), fin du combat (B6), reprise (B8).
import { ATTACKS, type AttackKind } from './attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  resumeBattle,
  startBattle,
  type Battle,
  type BattleUpdate,
  type HeroState,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import type { Bleed, EnemyKind } from './combatants';
import { NO_MODIFIERS, type HeroModifiers } from './heroModifiers';
import { DEFAULT_TRIAL_TUNING } from './TrialTuning';

const PITCHFORK_BLEED: Bleed = { damage: 2, rounds: 3 };

function start(
  enemies: readonly EnemyKind[],
  hero: Partial<HeroState> = {},
  modifiers?: HeroModifiers,
): Battle {
  const { battle } = startBattle({
    seed: 7,
    tuning: DEFAULT_TRIAL_TUNING,
    defenseHint: false,
    at: 0,
    heroHp: 50,
    enemies,
    ...(modifiers && { modifiers }),
  });
  // Des ennemis increvables, jamais étourdis : le combat dure tant que le test en a besoin.
  return {
    ...battle,
    hero: { ...battle.hero, ...hero },
    enemies: battle.enemies.map((enemy) => ({ ...enemy, hp: 999, guard: 999 })),
  };
}

/** L'intention du 1er ennemi : un coup de 5, la Fourche par défaut. */
function intending(battle: Battle, attack: AttackKind = 'basic', bleed?: Bleed): Battle {
  const intent = {
    category: 'attack' as const,
    attack,
    damage: 5,
    windUpMs: ATTACKS[attack].windUpMs,
    feintFraction: 0.5,
    ...(bleed && { bleed }),
  };
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, i) => (i ? enemy : { ...enemy, intent })),
  };
}

type Defense = { readonly button: DefenseButton; readonly offset: number } | null;

/** Rejoue jusqu'à `done` : le héros attaque à son tour, chaque impact reçoit `defense` (ou rien). */
function play(
  initial: Battle,
  done: (events: readonly BattleEvent[], battle: Battle) => boolean,
  defense: Defense = null,
): { readonly battle: Battle; readonly events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 300; guard += 1) {
    if (done(events, battle) || battle.phase.kind === 'over') return { battle, events };
    const { phase } = battle;
    const impact =
      phase.kind === 'enemy' && phase.step.kind === 'attack'
        ? phase.step.impacts.find((candidate) => candidate.outcome === null)
        : undefined;
    let update: BattleUpdate;
    if (phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else if (defense !== null && impact !== undefined) {
      update = pressDefense(battle, { button: defense.button, at: impact.at + defense.offset });
    } else {
      update = advance(battle, nextDeadline(battle)!.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

const blowResolved = (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'blowResolved');
const roundStarted = (round: number) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);
const ofType = <Type extends BattleEvent['type']>(events: readonly BattleEvent[], type: Type) =>
  events.filter((event): event is Extract<BattleEvent, { type: Type }> => event.type === type);

describe('Bleed trigger (B1, B4)', () => {
  it.each([
    ['a good parry', 'basic', { button: 'parry', offset: 100 }, 'parry'],
    ['a suffered blow', 'basic', null, 'suffered'],
    ['a parry on a perilous blow', 'perilous', { button: 'parry', offset: 0 }, 'perilousParry'],
  ] as const)('bleeds on %s', (_, attack, defense, outcome) => {
    const { battle, events } = play(
      intending(start(['madVillager']), attack, PITCHFORK_BLEED),
      blowResolved,
      defense,
    );

    expect(ofType(events, 'blowResolved')[0]?.outcome).toBe(outcome);
    expect(ofType(events, 'heroBleeding')).toEqual([
      expect.objectContaining({ damage: 2, rounds: 3 }),
    ]);
    // Le combat peut avoir déjà avancé jusqu'à la manche suivante, qui a saigné une fois.
    expect(battle.hero.bleed?.damage).toBe(2);
  });

  it.each(['parry', 'dodge'] as const)('never bleeds on a perfect %s', (button) => {
    const { battle, events } = play(
      intending(start(['madVillager']), 'basic', PITCHFORK_BLEED),
      blowResolved,
      { button, offset: 0 },
    );

    expect(ofType(events, 'heroBleeding')).toEqual([]);
    expect(battle.hero.bleed).toBeUndefined();
  });

  it('never bleeds on the Haft blow', () => {
    const { battle } = play(intending(start(['madVillager'])), blowResolved);

    expect(battle.hero.bleed).toBeUndefined();
  });

  it('keeps the longest duration of a new bleed, without adding it', () => {
    const bleeding = start(['madVillager'], { bleed: { damage: 2, rounds: 1 } });

    const { events } = play(intending(bleeding, 'basic', PITCHFORK_BLEED), blowResolved);

    expect(ofType(events, 'heroBleeding')[0]).toMatchObject({ damage: 2, rounds: 3 });
  });

  it('neither bleeds nor keeps bleeding when the blow takes the hero down (B6)', () => {
    const dying = start(['madVillager'], { hp: 1, bleed: { damage: 2, rounds: 2 } });

    const { battle, events } = play(intending(dying, 'basic', PITCHFORK_BLEED), blowResolved);

    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'defeat' });
    expect(ofType(events, 'heroBleeding')).toEqual([]);
    expect(battle.hero.bleed).toBeUndefined();
  });
});

describe('Bleed loss (B2, B3, B5)', () => {
  const dodge: Defense = { button: 'dodge', offset: 0 };

  it('takes the HP at the start of the next 3 rounds, before the reinforcement and the draws', () => {
    const group = start(['ghoul', 'ghoul', 'ghoul', 'ghoul'], { bleed: PITCHFORK_BLEED });
    const twoDown = {
      ...group,
      enemies: group.enemies.map((enemy, index) => (index < 2 ? { ...enemy, hp: 0 } : enemy)),
      target: 2,
    };

    const round2 = play(twoDown, roundStarted(2), dodge);
    const types = round2.events.map((event) => event.type);
    expect(types.indexOf('bleedTicked')).toBeLessThan(types.indexOf('reinforcementEntered'));
    expect(types.indexOf('reinforcementEntered')).toBeLessThan(types.indexOf('roundStarted'));

    const { battle, events } = play(round2.battle, roundStarted(5), dodge);
    const ticks = [...ofType(round2.events, 'bleedTicked'), ...ofType(events, 'bleedTicked')];
    expect(ticks).toEqual([
      expect.objectContaining({ loss: 2, heroHp: 48, roundsLeft: 2 }),
      expect.objectContaining({ loss: 2, heroHp: 46, roundsLeft: 1 }),
      expect.objectContaining({ loss: 2, heroHp: 44, roundsLeft: 0 }),
    ]);
    expect(battle.hero.hp).toBe(44);
    expect(battle.hero).not.toHaveProperty('bleed');
  });

  it('is reduced neither by the damage reduction nor by the Bulwark, which stays', () => {
    const guarded = start(
      ['ghoul'],
      { bulwark: true, bleed: PITCHFORK_BLEED },
      { ...NO_MODIFIERS, damageReductionPoints: 20 },
    );

    const { battle, events } = play(guarded, roundStarted(2), dodge);

    expect(ofType(events, 'bleedTicked')[0]).toMatchObject({ loss: 2, heroHp: 48 });
    expect(battle.hero.bulwark).toBe(true);
  });

  it('never takes the hero below 1 HP, and still counts down', () => {
    const { battle, events } = play(
      start(['ghoul'], { hp: 1, bleed: { damage: 2, rounds: 2 } }),
      roundStarted(2),
      dodge,
    );

    expect(ofType(events, 'bleedTicked')[0]).toMatchObject({ loss: 0, heroHp: 1, roundsLeft: 1 });
    expect(battle.hero).toMatchObject({ hp: 1, bleed: { damage: 2, rounds: 1 } });
  });
});

describe('Bleed and the end of the battle (B6, B8)', () => {
  it('stops at the victory, before the respite', () => {
    const bleeding = start(['ghoul'], { bleed: PITCHFORK_BLEED });
    const weak = { ...bleeding, enemies: [{ ...bleeding.enemies[0]!, hp: 1 }] };

    const { battle, events } = play(weak, () => false);

    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(ofType(events, 'respite')[0]).toMatchObject({ gain: 8, heroHp: 58 });
    expect(battle.hero).not.toHaveProperty('bleed');
  });

  it('is saved with the battle and goes on after a resume', () => {
    const saved = JSON.parse(
      JSON.stringify(start(['ghoul'], { bleed: PITCHFORK_BLEED })),
    ) as Battle;

    const { events } = play(resumeBattle(saved, 5_000), roundStarted(2), {
      button: 'dodge',
      offset: 0,
    });

    expect(ofType(events, 'bleedTicked')[0]).toMatchObject({ loss: 2, roundsLeft: 2 });
  });
});
