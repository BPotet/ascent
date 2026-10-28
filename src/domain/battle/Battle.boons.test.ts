// Le moteur du combat avec les modificateurs du héros (prototype #92, règles P18 de #88) : les
// bienfaits entrent dans le combat par `BattleOptions.modifiers`, neutres par défaut.
import {
  advance,
  heroAction,
  nextDeadline,
  pressStrike,
  resumeBattle,
  startBattle,
  type Battle,
  type BattleUpdate,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import type { HeroKind } from './combatants';
import { NO_MODIFIERS, type HeroModifiers } from './heroModifiers';
import { DEFAULT_TRIAL_TUNING } from './TrialTuning';

function start(modifiers: Partial<HeroModifiers> = {}, hero: HeroKind = 'sentinel'): Battle {
  return startBattle({
    seed: 7,
    tuning: DEFAULT_TRIAL_TUNING,
    defenseHint: false,
    at: 0,
    hero,
    heroHp: 50,
    enemies: ['ghoul'],
    modifiers: { ...NO_MODIFIERS, ...modifiers },
  }).battle;
}

/** Rejoue le combat, sans appui de défense ni de frappe, jusqu'à `done` ; le héros attaque à son tour. */
function playUntil(
  initial: Battle,
  done: (events: readonly BattleEvent[]) => boolean,
): { readonly battle: Battle; readonly events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 300; guard += 1) {
    if (done(events)) return { battle, events };
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) throw new Error('The battle is stuck');
      update = advance(battle, deadline.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

const has = (type: BattleEvent['type']) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === type);

function firstOf<Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): Extract<BattleEvent, { type: Type }> {
  return events.find((event) => event.type === type) as Extract<BattleEvent, { type: Type }>;
}

describe('Battle with the hero modifiers (P18)', () => {
  it('Braise brisante: the Sentinel breaks the guard of a Ghoul (15) with her first strike', () => {
    const without = playUntil(start(), has('strikeResolved'));
    const ember = playUntil(start({ guardDamagePercents: [130] }), has('strikeResolved'));

    expect(firstOf(without.events, 'strikeResolved').guardDamage).toBe(12);
    expect(has('guardBroken')(without.events)).toBe(false);
    expect(firstOf(ember.events, 'strikeResolved').guardDamage).toBe(15);
    expect(has('guardBroken')(ember.events)).toBe(true);
  });

  it('Cœur de braise: each broken guard gives +1 Momentum and heals 5 HP, within the maximum', () => {
    const breaker = { guardDamagePercents: [130] };
    const without = playUntil(start(breaker), has('strikeResolved'));
    const heart = playUntil(
      start({ ...breaker, onGuardBreak: { momentum: 1, heal: 5 } }),
      has('strikeResolved'),
    );

    expect(heart.battle.hero.momentum).toBe(without.battle.hero.momentum + 1);
    expect(heart.battle.hero.hp).toBe(without.battle.hero.hp + 5);
    const full = playUntil(
      { ...start({ ...breaker, onGuardBreak: { momentum: 1, heal: 5 } }), hero: fullHero() },
      has('strikeResolved'),
    );
    expect(full.battle.hero.hp).toBe(80);
  });

  it('Peau de givre: +10 points of damage reduction, capped at 40 %', () => {
    const suffered = (modifiers: Partial<HeroModifiers>) =>
      firstOf(playUntil(start(modifiers, 'wanderer'), has('blowResolved')).events, 'blowResolved');
    const raw = suffered({}).damage;

    expect(suffered({ damageReductionPoints: 10 }).damage).toBe(
      Math.max(1, Math.floor((raw * 90) / 100)),
    );
    expect(suffered({ damageReductionPoints: 60 }).damage).toBe(
      Math.max(1, Math.floor((raw * 60) / 100)),
    );
  });

  it('Lame juste: a perfect strike of the Sentinel deals 20 HP instead of 15', () => {
    const perfect = (modifiers: Partial<HeroModifiers>) => {
      const attacked = heroAction(start(modifiers), {
        action: { kind: 'attack' },
        touchStartedAt: 50,
        releasedAt: 100,
      }).battle;
      const { impactAt } = attacked.phase as { readonly impactAt: number };
      return firstOf(pressStrike(attacked, { at: impactAt }).events, 'strikeResolved').damage;
    };

    expect(perfect({})).toBe(15);
    expect(perfect({ perfectStrikeBonusPercents: [50] })).toBe(20);
  });

  it('Givre persistant: a stunned enemy gets back half of its guard, rounded down', () => {
    const { battle } = playUntil(
      start({ guardDamagePercents: [130], guardRestorePercent: 50 }),
      has('guardRestored'),
    );

    expect(battle.enemies[0]!.guard).toBe(7);
  });

  it('resumes a battle saved by #93 alone, without the boon fields, up to a broken guard', () => {
    const {
      counterPercents: _counter,
      stunnedBonusPercent: _stunned,
      guardRestorePercent: _restore,
      onGuardBreak: _break,
      ...itemsOnly
    } = { ...NO_MODIFIERS, guardDamagePercents: [130] };
    const saved = JSON.parse(JSON.stringify({ ...start(), modifiers: itemsOnly })) as Battle;

    const { battle, events } = playUntil(resumeBattle(saved, 0), has('guardRestored'));

    expect(has('guardBroken')(events)).toBe(true);
    expect(battle.hero.momentum).toBeGreaterThan(0);
    expect(battle.enemies[0]!.guard).toBe(15);
  });

  it('keeps the modifiers in the battle, to resume it as it was', () => {
    expect(start({ counterPercents: [150] }).modifiers?.counterPercents).toEqual([150]);
  });
});

function fullHero(): Battle['hero'] {
  return { hp: 80, maxHp: 80, momentum: 1, bulwark: false };
}
