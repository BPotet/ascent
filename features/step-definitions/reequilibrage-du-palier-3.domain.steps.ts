/**
 * Les règles du domaine de « Rééquilibrage du palier 3 » (#244), sans écran : le Brise-garde d'une
 * frappe (G1), joué dans le moteur du combat ; le Coup de bouclier (#236), pas encore en jeu, est
 * vérifié sur le calcul de la garde retirée (`strikeBlow`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  heroAction,
  pressStrike,
  startBattle,
  type Battle,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { SENTINEL, type HeroKind } from '../../src/domain/battle/combatants';
import { NO_MODIFIERS, type HeroModifiers } from '../../src/domain/battle/heroModifiers';
import { bulwarkCounterBlow, counterBlow, strikeBlow } from '../../src/domain/battle/strike';

/** Lame juste (`trueEdge`) et Heure juste : des bonus de frappe parfaite, en %. */
const TRUE_EDGE = 50;
const RIGHT_HOUR = 30;
/** Braise brisante : un pourcentage de Brise-garde. */
const SHATTERING_EMBER = 130;

type Resolved = Extract<BattleEvent, { type: 'strikeResolved' }>;

interface World {
  battle: Battle;
  resolved: Resolved[];
  shieldBashGuard: number;
}

let world: World;

const fresh = (battle: Battle): World => ({ battle, resolved: [], shieldBashGuard: 0 });

function start(hero: HeroKind, modifiers: Partial<HeroModifiers>, powers?: Battle['powers']) {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies: ['ghoul'],
    modifiers: { ...NO_MODIFIERS, ...modifiers },
    ...(powers && { powers }),
  }).battle;
}

const act = (battle: Battle, action: Parameters<typeof heroAction>[1]['action'], at: number) =>
  heroAction(battle, { action, touchStartedAt: at - 50, releasedAt: at });

const impactOf = (battle: Battle) => (battle.phase as { readonly impactAt: number }).impactAt;

/** Chaque coup de la frappe en rythme, appuyé à `offset` ms de son impact, jusqu'à la fin. */
function strikeAll(battle: Battle, offset: number): Resolved[] {
  const resolved: Resolved[] = [];
  let current: BattleUpdate = act(battle, { kind: 'attack' }, battle.now + 100);
  while (current.battle.phase.kind === 'heroStrike' && !current.battle.phase.resolved) {
    current = pressStrike(current.battle, { at: impactOf(current.battle) + offset });
    resolved.push(
      ...current.events.filter((event): event is Resolved => event.type === 'strikeResolved'),
    );
  }
  return resolved;
}

const steps: StepDefinitions = ({ given, when, then }) => {
  // --- G1 : Brise-garde d'une frappe ---

  given(/^la Sentinelle avec Lame juste et Heure juste$/u, () => {
    world = fresh(start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE, RIGHT_HOUR] }));
  });

  given(/^la Sentinelle avec Lame juste, Heure juste et Braise brisante$/u, () => {
    world = fresh(
      start('sentinel', {
        perfectStrikeBonusPercents: [TRUE_EDGE, RIGHT_HOUR],
        guardDamagePercents: [SHATTERING_EMBER],
      }),
    );
  });

  given(/^la Sentinelle avec Lame juste$/u, () => {
    world = fresh(start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE] }));
  });

  given(/^l'Errante avec Lame juste et Entaille$/u, () => {
    const wanderer = start('wanderer', { perfectStrikeBonusPercents: [TRUE_EDGE] }, [
      'shadowStep',
      'rend',
    ]);
    const cast = act(
      { ...wanderer, hero: { ...wanderer.hero, momentum: 1 } },
      { kind: 'power', power: 'rend' },
      1_000,
    );
    expect(cast.battle.hero.rend).toBe(true);
    world = fresh(cast.battle);
  });

  given(/^un ennemi étourdi$/u, () => {
    const battle = start('sentinel', { perfectStrikeBonusPercents: [TRUE_EDGE] });
    world = fresh({
      ...battle,
      enemies: battle.enemies.map((enemy) => ({
        ...enemy,
        guard: 0,
        stun: { actionLost: false, heroAction: 0 },
      })),
    });
  });

  when(/^elle fait une frappe parfaite sur un ennemi non étourdi$/u, () => {
    expect(world.battle.enemies[0]!.stun).toBeNull();
    world.resolved = strikeAll(world.battle, 0);
  });

  when(/^le héros fait une frappe parfaite sur lui$/u, () => {
    world.resolved = strikeAll(world.battle, 0);
  });

  when(/^elle fait une bonne frappe sur un ennemi non étourdi$/u, () => {
    world.resolved = strikeAll(world.battle, 100);
  });

  when(/^elle fait un Coup de bouclier parfait sur un ennemi non étourdi$/u, () => {
    // Le Coup de bouclier (#236) : une frappe de pouvoir à 200 % de Brise-garde.
    world.shieldBashGuard = strikeBlow({
      attackPower: SENTINEL.attackPower,
      guardDamage: SENTINEL.guardDamage,
      judgement: 'perfect',
      perfectBonusPercents: [TRUE_EDGE],
      stunned: false,
      guardPercents: [200],
    }).guard;
  });

  when(
    /^elle contre-attaque après une parade parfaite, ou que sa Riposte du Rempart frappe$/u,
    () => {
      // Ni la contre-attaque ni la Riposte ne prennent le multiplicateur de frappe (C6.6).
    },
  );

  then(/^elle retire 23 PV et 18 de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', damage: 23, guardDamage: 18 }),
    ]);
  });

  then(/^elle retire 23 de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', guardDamage: 23 }),
    ]);
  });

  then(/^elle retire 36 de garde \(12 × 150 % × 200 %\)$/u, () => {
    expect(world.shieldBashGuard).toBe(36);
  });

  then(/^elle retire 11 \+ 11 de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', damage: 12, guardDamage: 11, rend: true }),
      expect.objectContaining({ judgement: 'perfect', damage: 12, guardDamage: 11, rend: true }),
    ]);
  });

  then(/^elle retire 14 de garde, comme aujourd'hui$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'good', guardDamage: 14 }),
    ]);
  });

  then(/^il ne perd aucun point de garde$/u, () => {
    expect(world.resolved).toEqual([
      expect.objectContaining({ judgement: 'perfect', guardDamage: 0 }),
    ]);
  });

  then(/^la garde retirée est la même qu'avant le rééquilibrage$/u, () => {
    const counter = { ...SENTINEL, stunned: false };
    // Avant #244 : 12 (100 % du Brise-garde) et 3 (25 %).
    expect(counterBlow(counter).guard).toBe(12);
    expect(bulwarkCounterBlow({ ...counter, ...SENTINEL.bulwarkCounter }).guard).toBe(3);
  });
};

// Les règles du domaine seules : `@session` passe par la session.
const feature = loadFeature('features/reequilibrage-du-palier-3.feature');
const ofDomain = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@domain');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofDomain),
      scenarioOutlines: feature.scenarioOutlines.filter(ofDomain),
    },
  ],
  [steps],
);
