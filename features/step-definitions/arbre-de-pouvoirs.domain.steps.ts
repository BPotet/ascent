/**
 * Scénarios `@domain` de « L'arbre de pouvoirs » (#235) : le verrou et le pouvoir de base dans
 * l'arbre, la règle d'un seul pouvoir instantané par phase du héros, et les effets de Représailles,
 * Tenir bon, Entaille et Brume, sur le combat de test.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { EMPTY_CAMP, availableShards } from '../../src/domain/ascent/camp';
import {
  POWER_TREES,
  powerNodeState,
  powerPrice,
  unlockPowerAtCamp,
} from '../../src/domain/ascent/powerTree';
import {
  advance,
  powerAvailability,
  pressDefense,
  type Battle,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import { basePower } from '../../src/domain/battle/powers';
import { counterBlow, strikeBlow } from '../../src/domain/battle/strike';
import { act, atRoundEnd, cast, eventsOf, powerBattle, underAttack } from '../support/powersStory';

let battle: Battle;
let update: BattleUpdate;
let updates: BattleUpdate[];

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- L'arbre ---

  given(/^le joueur a 200 Éclats disponibles et n'a pas débloqué Représailles$/u, () => undefined);

  then(/^Tenir bon est affiché verrouillé, ne peut pas être débloqué$/u, () => {
    expect(powerNodeState(EMPTY_CAMP, 200, null, 'holdFast')).toEqual({
      kind: 'locked',
      after: 'retaliation',
    });
    expect(unlockPowerAtCamp(EMPTY_CAMP, 200, 'holdFast')).toEqual({
      kind: 'locked',
      after: 'retaliation',
    });
  });

  and(/^il indique qu'il faut d'abord débloquer Représailles$/u, () => {
    const state = powerNodeState(EMPTY_CAMP, 200, null, 'holdFast');
    expect(state.kind === 'locked' && state.after).toBe('retaliation');
  });

  given(/^n'importe quel nombre d'Éclats disponibles$/u, () => undefined);

  then(
    /^le Rempart et Pas de l'ombre sont possédés d'office, sans prix, et ne peuvent être ni achetés ni vendus$/u,
    () => {
      for (const hero of ['sentinel', 'wanderer'] as const) {
        const base = POWER_TREES[hero].base;
        expect(base).toBe(basePower(hero));
        expect(powerPrice(base)).toBe(0);
        for (const shards of [0, 30, 1_000]) {
          expect(powerNodeState(EMPTY_CAMP, shards, null, base)).toEqual({ kind: 'base' });
          expect(unlockPowerAtCamp(EMPTY_CAMP, shards, base)).toEqual({ kind: 'notForSale' });
          expect(availableShards(shards, EMPTY_CAMP)).toBe(shards);
        }
      }
      expect(EMPTY_CAMP.powers).toEqual([]);
    },
  );

  // --- Un seul pouvoir instantané par phase du héros (PW2) ---

  given(/^l'Errante équipée de Pas de l'ombre, Entaille et Brume, avec 5 Élan$/u, () => {
    battle = powerBattle('wanderer', { momentum: 5 });
  });

  when(/^elle lance Entaille$/u, () => {
    update = act(battle, cast('rend'), 1_000);
  });

  then(
    /^Pas de l'ombre et Brume sont indisponibles jusqu'à la fin de cette phase du héros$/u,
    () => {
      expect(powerAvailability(update.battle, 'shadowStep')).toEqual({ kind: 'instantUsed' });
      expect(powerAvailability(update.battle, 'mist')).toEqual({ kind: 'instantUsed' });
      expect(eventsOf(act(update.battle, cast('mist'), 1_100).events, 'pressIgnored')).toHaveLength(
        1,
      );
      const next: Battle = {
        ...update.battle,
        phase: { kind: 'hero', since: 9_000, announced: false },
      };
      expect(powerAvailability(next, 'shadowStep')).toEqual({ kind: 'available' });
      expect(powerAvailability(next, 'mist')).toEqual({ kind: 'available' });
    },
  );

  and(/^le joueur choisit son action, « Attaquer »$/u, () => {
    expect(update.battle.phase.kind).toBe('hero');
    const attacked = act(update.battle, { kind: 'attack' }, 1_200);
    expect(eventsOf(attacked.events, 'strikeStarted')).toHaveLength(1);
  });

  // --- Représailles ---

  given(/^la Sentinelle avec 2 Élan lance Représailles, un pouvoir instantané$/u, () => {
    update = act(powerBattle('sentinel', { momentum: 2 }), cast('retaliation'), 1_000);
    expect(update.battle.hero).toMatchObject({ momentum: 0, retaliation: true });
    expect(update.battle.phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
  });

  when(/^elle pare parfaitement tous les impacts d'un coup ennemi$/u, () => {
    const attacked = underAttack(update.battle, [2_000]);
    update = advance(pressDefense(attacked, { button: 'parry', at: 2_000 }).battle, 3_000);
  });

  then(
    /^sa contre-attaque retire 200 % des PV et 200 % de la garde d'une contre-attaque ordinaire, en un seul calcul$/u,
    () => {
      const ordinary = { attackPower: 10, guardDamage: 12, counterPercent: 130, stunned: false };
      const once = counterBlow({ ...ordinary, hpPercent: 200, guardPercent: 200 });
      expect(eventsOf(update.events, 'counterAttacked')).toEqual([
        expect.objectContaining({ damage: once.hp, guardDamage: once.guard, retaliation: true }),
      ]);
      // Un seul calcul : pas le double arrondi d'une contre-attaque ordinaire.
      const plain = counterBlow(ordinary);
      expect([once.hp, once.guard]).toEqual([13, 24]);
      expect(once.hp).not.toBe(plain.hp * 2);
    },
  );

  and(/^Représailles est consommé$/u, () => {
    expect(update.battle.hero).not.toHaveProperty('retaliation');
  });

  given(/^Représailles est actif$/u, () => {
    battle = powerBattle('sentinel', { retaliation: true, momentum: 5 });
  });

  when(
    /^le Rempart s'use et déclenche la Riposte du Rempart, ou qu'une double frappe n'est parée parfaitement qu'à moitié$/u,
    () => {
      const worn = advance(
        underAttack({ ...battle, hero: { ...battle.hero, bulwark: true } }, [2_000]),
        4_000,
      );
      expect(eventsOf(worn.events, 'bulwarkCountered')).toHaveLength(1);
      const half = underAttack(battle, [2_000, 2_420]);
      const halved = advance(pressDefense(half, { button: 'parry', at: 2_000 }).battle, 4_000);
      updates = [worn, halved];
    },
  );

  then(/^Représailles reste actif$/u, () => {
    for (const after of updates) {
      expect(eventsOf(after.events, 'counterAttacked')).toEqual([]);
      expect(after.battle.hero.retaliation).toBe(true);
    }
  });

  and(/^sa touche reste indisponible tant qu'il est actif$/u, () => {
    for (const after of updates) {
      const heroPhase: Battle = {
        ...after.battle,
        phase: { kind: 'hero', since: 9_000, announced: true },
      };
      expect(powerAvailability(heroPhase, 'retaliation')).toEqual({ kind: 'active' });
    }
  });

  given(/^Représailles ou Brume est encore actif quand le combat est gagné$/u, () => {
    updates = [
      { battle: powerBattle('sentinel', { retaliation: true }), events: [] },
      { battle: powerBattle('wanderer', { mist: true }), events: [] },
    ];
  });

  then(/^il est perdu et n'est pas actif au combat suivant$/u, () => {
    // Chaque combat de l'ascension part d'un combat neuf, avec les mêmes pouvoirs équipés.
    for (const { battle: won } of updates) {
      const next = powerBattle(won.heroKind, { momentum: 5 });
      expect(next.hero).not.toHaveProperty('retaliation');
      expect(next.hero).not.toHaveProperty('mist');
      const charge = won.heroKind === 'sentinel' ? 'retaliation' : 'mist';
      expect(powerAvailability(next, charge)).toEqual({ kind: 'available' });
    }
  });

  // --- Tenir bon ---

  given(
    /^la Sentinelle a 80 PV max, 30 PV, 3 Élan, 2 charges de Brûlure et un Saignement$/u,
    () => {
      battle = powerBattle('sentinel', {
        hp: 30,
        momentum: 3,
        burn: 2,
        bleed: { damage: 3, rounds: 2 },
      });
      expect(battle.hero.maxHp).toBe(80);
    },
  );

  given(/^la Sentinelle a 80 PV max et 75 PV$/u, () => {
    battle = powerBattle('sentinel', { hp: 75, momentum: 3 });
    expect(battle.hero.maxHp).toBe(80);
  });

  when(/^elle lance Tenir bon$/u, () => {
    update = act(battle, cast('holdFast'), 1_000);
  });

  then(/^elle a 46 PV et 0 Élan$/u, () => {
    expect(update.battle.hero).toMatchObject({ hp: 46, momentum: 0 });
  });

  and(/^la Brûlure est éteinte et le Saignement arrêté$/u, () => {
    expect(update.battle.hero).not.toHaveProperty('burn');
    expect(update.battle.hero).not.toHaveProperty('bleed');
    expect(eventsOf(update.events, 'burnCleared')).toHaveLength(1);
    expect(eventsOf(update.events, 'bleedStopped')).toHaveLength(1);
  });

  and(/^c'est son action de la phase du héros$/u, () => {
    expect(update.battle.phase).toMatchObject({ kind: 'heroPower', power: 'holdFast' });
    expect(update.battle.heroActions).toBe(battle.heroActions + 1);
  });

  then(/^elle a 80 PV$/u, () => {
    expect(update.battle.hero.hp).toBe(80);
  });

  given(/^la Sentinelle a déjà lancé Tenir bon dans ce combat, même à PV max$/u, () => {
    update = act(powerBattle('sentinel', { momentum: 3 }), cast('holdFast'), 1_000);
    expect(eventsOf(update.events, 'heroHealed')).toEqual([
      expect.objectContaining({ heal: 0, heroHp: 80 }),
    ]);
  });

  then(
    /^la touche de Tenir bon reste indisponible jusqu'à la fin du combat, quel que soit son Élan$/u,
    () => {
      for (const momentum of [0, 3, 5]) {
        const later: Battle = {
          ...update.battle,
          hero: { ...update.battle.hero, momentum },
          phase: { kind: 'hero', since: 9_000, announced: true },
        };
        expect(powerAvailability(later, 'holdFast')).toEqual({ kind: 'usedThisBattle' });
      }
    },
  );

  and(/^au combat suivant, elle peut de nouveau le lancer$/u, () => {
    expect(powerAvailability(powerBattle('sentinel', { momentum: 3 }), 'holdFast')).toEqual({
      kind: 'available',
    });
  });

  // --- Entaille ---

  given(/^l'Errante avec 1 Élan lance Entaille$/u, () => {
    update = act(powerBattle('wanderer', { momentum: 1 }), cast('rend'), 1_000);
    expect(update.battle.hero).toMatchObject({ momentum: 0, rend: true });
  });

  when(/^elle attaque ensuite$/u, () => {
    const attacked = act(update.battle, { kind: 'attack' }, 1_100);
    battle = attacked.battle;
    update = advance(attacked.battle, 4_000);
  });

  then(
    /^chacun des coups de sa frappe en rythme retire 150 % de son Brise-garde, en un seul calcul$/u,
    () => {
      const once = strikeBlow({
        attackPower: 6,
        guardDamage: 5,
        judgement: null,
        stunned: false,
        guardPercents: [150],
      });
      const resolved = eventsOf(update.events, 'strikeResolved');
      expect(resolved).toHaveLength(2);
      expect(resolved[0]).toMatchObject({ guardDamage: once.guard, rend: true, hit: 1 });
      expect(once.guard).toBe(7);
      expect(resolved[1]).toMatchObject({ rend: true, hit: 2 });
    },
  );

  and(/^Entaille est consommée par cette frappe$/u, () => {
    expect(battle.hero).not.toHaveProperty('rend');
    expect(update.battle.hero).not.toHaveProperty('rend');
  });

  // « Entaille entre deux phases » ne se produit pas en jeu : l'état est construit (décision 4).
  given(/^Entaille est active$/u, () => {
    battle = powerBattle('wanderer', { rend: true });
  });

  when(
    /^une contre-attaque ou une contre-attaque de Pas de l'ombre frappe avant la prochaine frappe en rythme$/u,
    () => {
      const parried = underAttack(battle, [2_000]);
      const dodged = underAttack(
        { ...battle, hero: { ...battle.hero, shadowStep: true } },
        [2_000],
      );
      updates = [
        advance(pressDefense(parried, { button: 'parry', at: 2_000 }).battle, 3_000),
        advance(pressDefense(dodged, { button: 'dodge', at: 2_000 }).battle, 3_000),
      ];
    },
  );

  then(/^cette contre-attaque retire sa garde habituelle et Entaille reste active$/u, () => {
    for (const after of updates) {
      const [counter] = eventsOf(after.events, 'counterAttacked');
      expect(counter).toMatchObject({ damage: 6, guardDamage: 5 });
      expect(counter).not.toHaveProperty('rend');
      expect(after.battle.hero.rend).toBe(true);
    }
  });

  // --- Brume ---

  given(/^l'Errante avec 2 Élan lance Brume, un pouvoir instantané$/u, () => {
    update = act(powerBattle('wanderer', { momentum: 2 }), cast('mist'), 1_000);
    expect(update.battle.hero).toMatchObject({ momentum: 0, mist: true });
    expect(update.battle.phase).toMatchObject({ kind: 'hero', instantPowerUsed: true });
  });

  when(/^un impact ennemi de 10 lui fait des dégâts$/u, () => {
    update = advance(underAttack(update.battle, [2_000], { damage: 10 }), 2_300);
  });

  then(/^cet impact ne lui retire que 5 PV$/u, () => {
    expect(eventsOf(update.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered', damage: 5 }),
    ]);
  });

  and(/^Brume est consommée, sans riposte$/u, () => {
    expect(eventsOf(update.events, 'mistWorn')).toHaveLength(1);
    expect(update.battle.hero).not.toHaveProperty('mist');
    const later = advance(update.battle, 5_000).events;
    expect(eventsOf(later, 'counterAttacked')).toEqual([]);
    expect(eventsOf(later, 'bulwarkCountered')).toEqual([]);
  });

  given(/^Brume est active$/u, () => {
    battle = powerBattle('wanderer', { mist: true });
  });

  when(/^l'Errante esquive ou pare parfaitement un impact$/u, () => {
    const attacked = underAttack(battle, [2_000, 2_420]);
    const dodged = pressDefense(attacked, { button: 'dodge', at: 2_000 });
    const parried = pressDefense(dodged.battle, { button: 'parry', at: 2_420 });
    update = { battle: parried.battle, events: [...dodged.events, ...parried.events] };
  });

  then(/^Brume reste active$/u, () => {
    expect(eventsOf(update.events, 'mistWorn')).toEqual([]);
    expect(update.battle.hero.mist).toBe(true);
  });

  given(/^Brume est active et l'Errante a 2 charges de Brûlure$/u, () => {
    battle = atRoundEnd(powerBattle('wanderer', { mist: true, burn: 2, hp: 40 }));
  });

  when(/^la manche commence$/u, () => {
    update = advance(battle, 1_250);
  });

  then(/^l'Errante perd 2 PV et Brume reste active$/u, () => {
    expect(eventsOf(update.events, 'burnTicked')).toEqual([expect.objectContaining({ loss: 2 })]);
    expect(update.battle.hero).toMatchObject({ hp: 38, mist: true });
    expect(eventsOf(update.events, 'mistWorn')).toEqual([]);
  });
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/arbre-de-pouvoirs.feature');
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
