// La Brûlure dans le combat (#171) : prise (1), effet au début de manche (2), contre-jeu (3), ni
// réduction ni Rempart (4), plancher, fin du combat et reprise (5), soins (6), ennemis (7),
// Saignement d'abord (8).
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
import type { EnemyKind } from './combatants';
import { NO_MODIFIERS, type HeroModifiers } from './heroModifiers';

/** La Torche du Brûleur de ronces : 2 charges. */
const TORCH = 2;

function start(
  enemies: readonly EnemyKind[],
  hero: Partial<HeroState> = {},
  modifiers?: HeroModifiers,
): Battle {
  const { battle } = startBattle({
    seed: 7,
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

/**
 * Les ennemis à partir de `from` restent étourdis tout le combat : ils perdent leur action à chaque
 * manche, sans jamais frapper. Derrière un coup du 1er, la manche ne recommence pas aussitôt.
 */
function idle(battle: Battle, from = 0): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) =>
      index < from ? enemy : { ...enemy, stun: { actionLost: false, heroAction: 999 } },
    ),
  };
}

/** L'intention du 1er ennemi : un coup de 5, qui brûle de `burn` charges s'il est donné. */
function intending(battle: Battle, attack: AttackKind = 'basic', burn?: number): Battle {
  const intent = {
    category: 'attack' as const,
    attack,
    damage: 5,
    windUpMs: ATTACKS[attack].windUpMs,
    feintFraction: 0.5,
    ...(burn !== undefined && { burn }),
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

const ofType = <Type extends BattleEvent['type']>(events: readonly BattleEvent[], type: Type) =>
  events.filter((event): event is Extract<BattleEvent, { type: Type }> => event.type === type);
const blowsResolved = (count: number) => (events: readonly BattleEvent[]) =>
  ofType(events, 'blowResolved').length >= count;
const roundStarted = (round: number) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === 'roundStarted' && event.round === round);
const perfect: Defense = { button: 'parry', offset: 0 };
const dodge: Defense = { button: 'dodge', offset: 0 };

describe('Burn trigger (1)', () => {
  it.each([
    ['a suffered blow', 'basic', null, 'suffered'],
    ['a good parry', 'basic', { button: 'parry', offset: 100 }, 'parry'],
    ['a parry on a perilous blow', 'perilous', { button: 'parry', offset: 0 }, 'perilousParry'],
  ] as const)('burns on %s', (_, attack, defense, outcome) => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul']), 1), attack, TORCH),
      blowsResolved(1),
      defense,
    );

    expect(ofType(events, 'blowResolved')[0]?.outcome).toBe(outcome);
    expect(ofType(events, 'heroBurning')).toEqual([
      { type: 'heroBurning', at: ofType(events, 'blowResolved')[0]!.at, added: 2, stacks: 2 },
    ]);
    expect(battle.hero.burn).toBe(2);
  });

  it.each([
    ['a perfect parry', perfect],
    ['a dodge', dodge],
  ])('never burns on %s', (_, defense) => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul']), 1), 'basic', TORCH),
      blowsResolved(1),
      defense,
    );

    expect(ofType(events, 'heroBurning')).toEqual([]);
    expect(battle.hero).not.toHaveProperty('burn');
  });

  it('copies the stacks of the intent into the attack, and nothing for a blow that does not burn', () => {
    const attackOf = (battle: Battle) => {
      const { phase } = play(
        battle,
        (_, current) => current.phase.kind === 'enemy' && current.phase.step.kind === 'attack',
      ).battle;
      return phase.kind === 'enemy' ? phase.step : null;
    };

    expect(attackOf(intending(idle(start(['ghoul', 'ghoul']), 1), 'basic', TORCH))).toMatchObject({
      burn: 2,
    });
    expect(attackOf(intending(idle(start(['ghoul', 'ghoul']), 1)))).not.toHaveProperty('burn');
  });

  it('never burns on a blow that does not burn', () => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul']), 1)),
      blowsResolved(1),
    );

    expect(ofType(events, 'heroBurning')).toEqual([]);
    expect(battle.hero).not.toHaveProperty('burn');
  });

  it('adds the stacks: 1 and the Torch make 3', () => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul'], { burn: 1 }), 1), 'basic', TORCH),
      blowsResolved(1),
    );

    expect(ofType(events, 'heroBurning')[0]).toMatchObject({ added: 2, stacks: 3 });
    expect(battle.hero.burn).toBe(3);
  });

  it('stops at 5 stacks: 4 and the Torch make 5', () => {
    const { events } = play(
      intending(idle(start(['ghoul', 'ghoul'], { burn: 4 }), 1), 'basic', TORCH),
      blowsResolved(1),
    );

    expect(ofType(events, 'heroBurning')[0]).toMatchObject({ added: 1, stacks: 5 });
  });

  it('still says the blow at 5 stacks, without lighting anything', () => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul'], { burn: 5 }), 1), 'basic', TORCH),
      blowsResolved(1),
    );

    expect(ofType(events, 'heroBurning')[0]).toMatchObject({ added: 0, stacks: 5 });
    expect(battle.hero.burn).toBe(5);
  });

  it('counts each impact of a double strike', () => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul']), 1), 'double', 1),
      blowsResolved(2),
    );

    expect(ofType(events, 'heroBurning').map(({ stacks }) => stacks)).toEqual([1, 2]);
    expect(battle.hero.burn).toBe(2);
  });

  it('never burns when the blow takes the hero down, and clears the stacks', () => {
    const { battle, events } = play(
      intending(start(['ghoul'], { hp: 1, burn: 2 }), 'basic', TORCH),
      blowsResolved(1),
    );

    const types = events.map((event) => event.type);
    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'defeat' });
    expect(ofType(events, 'heroBurning')).toEqual([]);
    expect(ofType(events, 'burnCleared')).toHaveLength(1);
    expect(types.indexOf('burnCleared')).toBeLessThan(types.indexOf('battleEnded'));
    expect(battle.hero).not.toHaveProperty('burn');
  });
});

describe('Burn counter-play (3)', () => {
  it('puts out a stack on each impact parried perfectly: 2 of 3 on a double strike', () => {
    const { battle, events } = play(
      intending(start(['ghoul'], { burn: 3 }), 'double'),
      blowsResolved(2),
      perfect,
    );

    const blows = ofType(events, 'blowResolved');
    expect(ofType(events, 'burnExtinguished')).toEqual([
      { type: 'burnExtinguished', at: blows[0]!.at, stacks: 2, cause: 'blow' },
      { type: 'burnExtinguished', at: blows[1]!.at, stacks: 1, cause: 'blow' },
    ]);
    expect(battle.hero.burn).toBe(1);
  });

  it('puts out a stack on a perilous blow dodged in the window', () => {
    const { battle, events } = play(
      intending(start(['ghoul'], { burn: 2 }), 'perilous'),
      blowsResolved(1),
      dodge,
    );

    expect(ofType(events, 'burnExtinguished')).toEqual([
      expect.objectContaining({ stacks: 1, cause: 'blow' }),
    ]);
    expect(battle.hero.burn).toBe(1);
  });

  it('puts out the last stack and the Burn ends', () => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul'], { burn: 1 }), 1), 'basic', TORCH),
      blowsResolved(1),
      perfect,
    );

    expect(ofType(events, 'burnExtinguished')[0]).toMatchObject({ stacks: 0 });
    expect(ofType(events, 'heroBurning')).toEqual([]);
    expect(battle.hero).not.toHaveProperty('burn');
  });

  it('puts out nothing on a good parry', () => {
    const { battle, events } = play(
      intending(idle(start(['ghoul', 'ghoul'], { burn: 2 }), 1), 'basic'),
      blowsResolved(1),
      { button: 'parry', offset: 100 },
    );

    expect(ofType(events, 'burnExtinguished')).toEqual([]);
    expect(battle.hero.burn).toBe(2);
  });

  it('puts out nothing on a hero who does not burn', () => {
    const { events } = play(intending(start(['ghoul']), 'basic'), blowsResolved(1), perfect);

    expect(ofType(events, 'burnExtinguished')).toEqual([]);
  });

  it('still heals with the Watchman shield on a perfect parry (6)', () => {
    const shielded = start(
      ['ghoul'],
      { hp: 40, burn: 2 },
      { ...NO_MODIFIERS, healOnPerfectParry: 3 },
    );

    const { battle } = play(intending(shielded, 'basic'), blowsResolved(1), perfect);

    expect(battle.hero).toMatchObject({ hp: 43, burn: 1 });
  });
});

describe('Burn at the start of a round (2, 4, 5, 8)', () => {
  it('takes 2 HP then puts out a stack, then 1 HP and the last stack, then nothing', () => {
    const { battle, events } = play(idle(start(['ghoul'], { burn: 2 })), roundStarted(4));

    const ticks = ofType(events, 'burnTicked');
    const outs = ofType(events, 'burnExtinguished');
    expect(ticks).toEqual([
      expect.objectContaining({ loss: 2, heroHp: 48, stacks: 2 }),
      expect.objectContaining({ loss: 1, heroHp: 47, stacks: 1 }),
    ]);
    expect(outs).toEqual([
      { type: 'burnExtinguished', at: ticks[0]!.at, stacks: 1, cause: 'round' },
      { type: 'burnExtinguished', at: ticks[1]!.at, stacks: 0, cause: 'round' },
    ]);
    expect(battle.hero.hp).toBe(47);
    expect(battle.hero).not.toHaveProperty('burn');
  });

  it('comes after the Bleed and before the reinforcement and the draws', () => {
    const group = start(['ghoul', 'ghoul', 'ghoul', 'ghoul'], {
      burn: 2,
      bleed: { damage: 2, rounds: 3 },
    });
    const twoDown = {
      ...group,
      enemies: group.enemies.map((enemy, index) => (index < 2 ? { ...enemy, hp: 0 } : enemy)),
      target: 2,
    };

    const { events } = play(idle(twoDown), roundStarted(2));

    const types = events.map((event) => event.type);
    expect(types.indexOf('bleedTicked')).toBeLessThan(types.indexOf('burnTicked'));
    expect(types.indexOf('burnTicked')).toBeLessThan(types.indexOf('burnExtinguished'));
    expect(types.indexOf('burnExtinguished')).toBeLessThan(types.indexOf('reinforcementEntered'));
    expect(types.indexOf('reinforcementEntered')).toBeLessThan(types.indexOf('roundStarted'));
    expect(ofType(events, 'burnTicked')[0]).toMatchObject({ loss: 2, heroHp: 46 });
  });

  it('is reduced neither by the damage reduction nor by the Bulwark, which stays (4)', () => {
    const guarded = start(
      ['ghoul'],
      { bulwark: true, burn: 3 },
      { ...NO_MODIFIERS, damageReductionPoints: 20 },
    );

    const { battle, events } = play(idle(guarded), roundStarted(2));

    expect(ofType(events, 'burnTicked')[0]).toMatchObject({ loss: 3, heroHp: 47 });
    expect(ofType(events, 'bulwarkWorn')).toEqual([]);
    expect(battle.hero.bulwark).toBe(true);
  });

  it('never takes the hero below 1 HP (5)', () => {
    const { battle, events } = play(idle(start(['ghoul'], { hp: 2, burn: 3 })), roundStarted(2));

    expect(ofType(events, 'burnTicked')[0]).toMatchObject({ loss: 1, heroHp: 1, stacks: 3 });
    expect(battle.hero).toMatchObject({ hp: 1, burn: 2 });
  });

  it('takes nothing at 1 HP, and still puts out a stack (5)', () => {
    const { battle, events } = play(idle(start(['ghoul'], { hp: 1, burn: 2 })), roundStarted(2));

    expect(ofType(events, 'burnTicked')[0]).toMatchObject({ loss: 0, heroHp: 1, stacks: 2 });
    expect(ofType(events, 'burnExtinguished')[0]).toMatchObject({ stacks: 1, cause: 'round' });
    expect(battle.hero).toMatchObject({ hp: 1, burn: 1 });
  });

  it('touches neither the guard nor the HP of an enemy, and starts no counter (7)', () => {
    const { events } = play(idle(start(['ghoul'], { burn: 3 })), roundStarted(2));

    const { at } = ofType(events, 'burnTicked')[0]!;
    const onEnemies = ['strikeResolved', 'counterAttacked', 'guardBroken', 'enemyDefeated'];
    expect(events.filter((event) => event.at === at && onEnemies.includes(event.type))).toEqual([]);
  });

  it('ticks nothing for a hero who does not burn', () => {
    const { events } = play(idle(start(['ghoul'])), roundStarted(2));

    expect(ofType(events, 'burnTicked')).toEqual([]);
    expect(ofType(events, 'burnExtinguished')).toEqual([]);
  });
});

describe('Burn and the end of the battle (5, 6)', () => {
  it('goes out at the victory, before the respite, without losing HP', () => {
    const burning = start(['ghoul'], { burn: 2 });
    const weak = { ...burning, enemies: [{ ...burning.enemies[0]!, hp: 1 }] };

    const { battle, events } = play(weak, () => false);

    const types = events.map((event) => event.type);
    expect(battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(ofType(events, 'burnCleared')).toHaveLength(1);
    expect(types.indexOf('burnCleared')).toBeLessThan(types.indexOf('respite'));
    expect(types.indexOf('respite')).toBeLessThan(types.indexOf('battleEnded'));
    expect(ofType(events, 'respite')[0]).toMatchObject({ gain: 8, heroHp: 58 });
    expect(battle.hero).not.toHaveProperty('burn');
  });

  it('clears nothing at the victory of a hero who does not burn', () => {
    const calm = start(['ghoul']);
    const weak = { ...calm, enemies: [{ ...calm.enemies[0]!, hp: 1 }] };

    const { events } = play(weak, () => false);

    expect(ofType(events, 'burnCleared')).toEqual([]);
  });

  it('is saved with the battle and goes on after a resume', () => {
    const saved = JSON.parse(JSON.stringify(idle(start(['ghoul'], { burn: 3 })))) as Battle;

    const { events } = play(resumeBattle(saved, 5_000), roundStarted(2));

    expect(ofType(events, 'burnTicked')[0]).toMatchObject({ loss: 3, stacks: 3 });
  });
});
