// Les pouvoirs de #235 dans l'état d'affichage (maquette 232, K12) : Tenir bon lève l'arme qui
// brille et garde l'instant du soin pour le halo ; la contre-attaque de Représailles garde son
// instant et son ennemi pour l'éclat d'or.
import type { BattleSnapshot } from '../../../application/useCases/BattleSession';
import { startBattle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { INITIAL_DISPLAY, displayOf } from './useBattleDisplay';

const battle = startBattle({
  seed: 1,
  defenseHint: false,
  at: 0,
  heroMaxHp: 80,
  enemies: ['ghoul', 'specter'],
}).battle;

function snapshot(events: readonly BattleEvent[]): BattleSnapshot {
  return { battle, events, heroHint: false, powersHint: false };
}

const holdFast: readonly BattleEvent[] = [
  { type: 'powerUsed', at: 3_000, power: 'holdFast', until: 3_500 },
  { type: 'heroHealed', at: 3_000, power: 'holdFast', heal: 16, heroHp: 46 },
];

describe('the powers in the display state (#235)', () => {
  it('starts without a heal nor a counter of Retaliation', () => {
    expect(INITIAL_DISPLAY.healedAt).toBeNull();
    expect(INITIAL_DISPLAY.retaliation).toBeNull();
  });

  it('raises the glowing weapon for Hold Fast and keeps the instant of the heal (K12)', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot(holdFast), false);

    expect(shown).toMatchObject({ heroPose: 'cast', heroPoseSince: 3_000, healedAt: 3_000 });
    expect(shown.heroFloat?.float).toEqual({ at: 'hero', text: '+16', big: false, kind: 'heal' });
  });

  it('keeps the Bulwark on its own pose', () => {
    const shown = displayOf(
      INITIAL_DISPLAY,
      snapshot([{ type: 'powerUsed', at: 3_000, power: 'bulwark', until: 3_500 }]),
      false,
    );

    expect(shown.heroPose).toBe('idle');
  });

  it('keeps the counter of Retaliation, not an ordinary counter', () => {
    const counter = (retaliation: boolean): BattleEvent => ({
      type: 'counterAttacked',
      at: 4_000,
      enemy: 1,
      damage: 8,
      guardDamage: 6,
      until: 4_400,
      ...(retaliation && { retaliation: true as const }),
    });

    expect(displayOf(INITIAL_DISPLAY, snapshot([counter(false)]), false).retaliation).toBeNull();
    expect(displayOf(INITIAL_DISPLAY, snapshot([counter(true)]), false).retaliation).toEqual({
      at: 4_000,
      enemy: 1,
    });
  });
});

describe('the scene word of a kindled power (#237, S12)', () => {
  it('writes « Attisé · 1 Élan » under « Représailles »', () => {
    const kindled = {
      ...battle,
      powers: ['bulwark', 'retaliation'] as const,
      kindled: ['retaliation'] as const,
    };
    const used: readonly BattleEvent[] = [
      { type: 'powerUsed', at: 1_000, power: 'retaliation', until: 1_500, instant: true },
    ];

    const shown = displayOf(
      INITIAL_DISPLAY,
      { battle: kindled, events: used, heroHint: false, powersHint: false },
      false,
    );

    expect(shown.feedback?.texts).toEqual([
      { tone: 'perfect', title: 'Représailles', sub: 'Attisé · 1 Élan' },
    ]);
  });
});

describe('the power strikes in the display state (#236)', () => {
  const started = (power: 'shieldBash' | 'crushingBlow' | 'flurry' | 'ambush', hit?: number) =>
    ({
      type: 'strikeStarted',
      at: 3_000,
      enemy: 0,
      impactAt: 3_700,
      until: 4_180,
      power,
      ...(hit !== undefined && { hit }),
    }) satisfies BattleEvent;
  const resolved = (power: 'shieldBash' | 'crushingBlow' | 'flurry' | 'ambush') =>
    ({
      type: 'strikeResolved',
      at: 3_700,
      enemy: 0,
      judgement: null,
      delta: null,
      damage: 5,
      guardDamage: 24,
      power,
    }) satisfies BattleEvent;
  const pose = (event: BattleEvent) =>
    displayOf(INITIAL_DISPLAY, snapshot([event]), false).heroPose;

  it('holds the charged blade during the wind-up of Crushing Blow, then brings it down', () => {
    expect(pose(started('crushingBlow'))).toBe('crushRaise');
    expect(pose(resolved('crushingBlow'))).toBe('crush');
  });

  it('raises the shield, then bashes, for Shield Bash', () => {
    expect(pose(started('shieldBash'))).toBe('raise');
    expect(pose(resolved('shieldBash'))).toBe('bash');
  });

  it('strikes with the blades of the Wanderer at each hit of Flurry', () => {
    expect(pose(started('flurry', 2))).toBe('raise');
    expect(pose(resolved('flurry'))).toBe('strike');
  });

  it('dodges into the shadow before the first hit of Ambush, then strikes', () => {
    const shown = displayOf(INITIAL_DISPLAY, snapshot([started('ambush', 1)]), false);

    expect(shown).toMatchObject({ heroPose: 'ambushRaise', shadowStepAt: 3_000 });
    expect(pose(started('ambush', 2))).toBe('raise');
    expect(pose(resolved('ambush'))).toBe('strike');
  });
});
