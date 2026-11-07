/**
 * Scénarios `@domain` des « Frappes de pouvoir » (#236) : le verrou du rang 2 de l'Errante, et les
 * frappes de pouvoir en combat (Coup de bouclier, Fracas, Rafale, Frappe furtive) sur le combat de
 * test, avec les règles d'« Attaquer ».
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { Camp } from '../../src/domain/ascent/camp';
import { powerNodeState, powerPrice, unlockPowerAtCamp } from '../../src/domain/ascent/powerTree';
import {
  advance,
  pressStrike,
  startBattle,
  type Battle,
  type BattleOptions,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { HEROES } from '../../src/domain/battle/combatants';
import { NO_MODIFIERS } from '../../src/domain/battle/heroModifiers';
import type { PowerKind } from '../../src/domain/battle/powers';
import { HIT_STOP_MS } from '../../src/domain/battle/rules';
import { STRIKE_WIND_UP_MS, strikeBlow } from '../../src/domain/battle/strike';
import { TEST_BATTLE_ENEMIES } from '../../src/domain/battle/testing/testBattle';
import { act, cast, eventsOf } from '../support/powersStory';

const CAST_AT = 1_000;

let camp: Camp;
let battle: Battle;
let launched: BattleUpdate;
let events: BattleEvent[];

/** Le combat de test, `powers` équipés, le héros et la Goule (cible) changés. */
function fight(
  powers: readonly PowerKind[],
  hero: Partial<Battle['hero']>,
  options: Partial<BattleOptions> = {},
  ghoul: Partial<Battle['enemies'][0]> = {},
): Battle {
  const started = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: TEST_BATTLE_ENEMIES,
    hero: powers.includes('flurry') || powers.includes('ambush') ? 'wanderer' : 'sentinel',
    powers,
    ...options,
  }).battle;
  return {
    ...started,
    hero: { ...started.hero, ...hero },
    enemies: started.enemies.map((enemy, index) => (index === 0 ? { ...enemy, ...ghoul } : enemy)),
  };
}

/** Lance `code` à 1 000 ms, puis laisse passer tous les impacts sans appuyer. */
function launch(from: Battle, code: PowerKind): void {
  launched = act(from, cast(code), CAST_AT);
  events = [...launched.events, ...advance(launched.battle, CAST_AT + 4_000).events];
}

const impactOf = (state: Battle) => (state.phase as { readonly impactAt: number }).impactAt;
const resolved = () => eventsOf(events, 'strikeResolved');
const stunned = { guard: 0, stun: { actionLost: false, heroAction: 0 } } as const;
const SENTINEL = HEROES.sentinel;
const WANDERER = HEROES.wanderer;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- L'arbre ---

  given(/^le joueur a débloqué Brume mais pas Entaille$/u, () => {
    camp = { unlocks: [], powers: [{ power: 'mist', price: powerPrice('mist') }] };
  });

  then(/^Frappe furtive peut être débloquée \(60 Éclats\)$/u, () => {
    expect(powerNodeState(camp, 90, null, 'ambush')).toEqual({ kind: 'affordable' });
    expect(powerPrice('ambush')).toBe(60);
    expect(unlockPowerAtCamp(camp, 90, 'ambush').kind).toBe('unlocked');
  });

  and(/^Rafale reste verrouillée et indique qu'il faut d'abord débloquer Entaille$/u, () => {
    expect(powerNodeState(camp, 500, null, 'flurry')).toEqual({ kind: 'locked', after: 'rend' });
    expect(unlockPowerAtCamp(camp, 500, 'flurry')).toEqual({ kind: 'locked', after: 'rend' });
  });

  // --- Coup de bouclier ---

  given(
    /^la Sentinelle, Attaque 10 et Brise-garde 12, a 2 Élan et Coup de bouclier équipé$/u,
    () => {
      expect([SENTINEL.attackPower, SENTINEL.guardDamage]).toEqual([10, 12]);
      battle = fight(['bulwark', 'shieldBash'], { momentum: 2 });
    },
  );

  when(
    /^elle lance Coup de bouclier sur un ennemi non étourdi et laisse passer l'impact sans appuyer$/u,
    () => {
      launch(battle, 'shieldBash');
    },
  );

  then(
    /^après une préparation de 700 ms, sa frappe en rythme d'un coup retire 5 PV et 24 de garde$/u,
    () => {
      expect(eventsOf(launched.events, 'strikeStarted')).toEqual([
        expect.objectContaining({ impactAt: CAST_AT + STRIKE_WIND_UP_MS, power: 'shieldBash' }),
      ]);
      expect(resolved()).toEqual([
        expect.objectContaining({ judgement: null, damage: 5, guardDamage: 24 }),
      ]);
    },
  );

  and(/^elle a 0 Élan : une frappe de pouvoir ne rapporte pas le \+1 Élan d'une attaque$/u, () => {
    expect(eventsOf(events, 'momentumChanged').map(({ momentum }) => momentum)).toEqual([0]);
    expect(launched.battle.hero.momentum).toBe(0);
  });

  // --- Fracas ---

  given(/^la Sentinelle a 3 Élan et Fracas équipé$/u, () => {
    battle = fight(['bulwark', 'shieldBash', 'crushingBlow'], { momentum: 3 });
  });

  when(/^elle lance Fracas et touche « Frapper » à 40 ms de l'impact au plus$/u, () => {
    launched = act(battle, cast('crushingBlow'), CAST_AT);
    const pressed = pressStrike(launched.battle, { at: impactOf(launched.battle) - 40 });
    events = [...pressed.events, ...advance(pressed.battle, impactOf(launched.battle)).events];
  });

  then(
    /^c'est une frappe parfaite : les PV \(×200 %\) sont multipliés par le multiplicateur de frappe parfaite, et la garde \(×100 %\) par 150 %, sans les bonus, en un seul calcul$/u,
    () => {
      const blow = strikeBlow({
        attackPower: SENTINEL.attackPower,
        guardDamage: SENTINEL.guardDamage,
        judgement: 'perfect',
        stunned: false,
        attackPercents: [200],
        guardPercents: [100],
      });
      // 10 × 150 % × 200 % = 30 PV ; 12 × 150 % × 100 % = 18 de garde.
      expect([blow.hp, blow.guard]).toEqual([30, 18]);
      expect(resolved()).toEqual([
        expect.objectContaining({ judgement: 'perfect', damage: 30, guardDamage: 18 }),
      ]);
      expect(launched.battle.hero.momentum).toBe(0);
    },
  );

  and(/^l'arrêt sur image et « Frappe parfaite » s'affichent comme pour « Attaquer »$/u, () => {
    expect(eventsOf(events, 'hitStopStarted')).toEqual([
      expect.objectContaining({ until: expect.any(Number) }),
    ]);
    const [stop] = eventsOf(events, 'hitStopStarted');
    expect(stop!.until - stop!.at).toBe(HIT_STOP_MS);
  });

  // --- Rafale ---

  given(/^l'Errante a 2 Élan et Rafale équipée$/u, () => {
    battle = fight(['shadowStep', 'rend', 'flurry'], { momentum: 2 });
  });

  when(/^elle lance Rafale sur un ennemi$/u, () => {
    launch(battle, 'flurry');
  });

  then(
    /^sa frappe en rythme a 4 coups, à 300 ms d'écart, chacun jugé seul, avec 100 % de son Attaque et de son Brise-garde$/u,
    () => {
      const impacts = eventsOf(events, 'strikeStarted').map(({ impactAt }) => impactAt - CAST_AT);
      expect(impacts).toEqual([700, 1_000, 1_300, 1_600]);
      expect(resolved()).toEqual(
        [1, 2, 3, 4].map((hit) =>
          expect.objectContaining({
            hit,
            judgement: null,
            damage: WANDERER.attackPower,
            guardDamage: WANDERER.guardDamage,
          }),
        ),
      );
      // Chaque coup est jugé seul : un appui parfait au 2e coup ne touche que lui.
      const first = advance(launched.battle, impactOf(launched.battle) + 161);
      const second = pressStrike(first.battle, { at: impactOf(first.battle) });
      expect(eventsOf(second.events, 'strikeResolved')).toEqual([
        expect.objectContaining({ hit: 2, judgement: 'perfect', damage: 9 }),
      ]);
    },
  );

  and(/^si la cible tombe avant le 4e coup, les coups restants sont perdus$/u, () => {
    launch(fight(['shadowStep', 'rend', 'flurry'], { momentum: 2 }, {}, { hp: 12 }), 'flurry');
    expect(resolved().map(({ hit }) => hit)).toEqual([1, 2]);
  });

  // --- Frappe furtive ---

  given(/^la cible de l'Errante a encore sa case dans la frise d'action après l'Errante$/u, () => {
    battle = fight(['shadowStep', 'rend', 'ambush'], { momentum: 3 });
    expect(battle.turn.order.indexOf(battle.target, battle.turn.position + 1)).toBeGreaterThan(0);
  });

  given(/^la cible de l'Errante a déjà agi dans la manche$/u, () => {
    battle = {
      ...fight(['shadowStep', 'rend', 'ambush'], { momentum: 3 }),
      turn: { order: [0, 'hero', 1, 2], position: 1 },
    };
  });

  when(/^l'Errante lance Frappe furtive(?: \(3 Élan\))?$/u, () => {
    launch(battle, 'ambush');
    expect(launched.battle.hero.momentum).toBe(0);
  });

  then(
    /^chacun de ses 2 coups fait 250 % de son Attaque en PV et 100 % de son Brise-garde$/u,
    () => {
      // 6 × 250 % = 15 PV ; 5 × 100 % = 5 de garde.
      expect(resolved()).toEqual([
        expect.objectContaining({ hit: 1, damage: 15, guardDamage: 5 }),
        expect.objectContaining({ hit: 2, damage: 15, guardDamage: 5 }),
      ]);
    },
  );

  then(
    /^chacun de ses 2 coups fait 100 % de son Attaque en PV et 100 % de son Brise-garde$/u,
    () => {
      expect(resolved()).toEqual([
        expect.objectContaining({ hit: 1, damage: 6, guardDamage: 5 }),
        expect.objectContaining({ hit: 2, damage: 6, guardDamage: 5 }),
      ]);
    },
  );

  and(/^la condition est jugée une seule fois, au lancer$/u, () => {
    // La même frappe lancée quand la cible n'a pas agi garde ses 250 %, même si l'ordre change
    // avant le 2e coup.
    const first = act(
      fight(['shadowStep', 'rend', 'ambush'], { momentum: 3 }),
      cast('ambush'),
      CAST_AT,
    );
    expect(first.battle.phase).toMatchObject({ ambush: true });
    const hit = advance(first.battle, impactOf(first.battle) + 161);
    const moved: Battle = { ...hit.battle, turn: { order: [0, 'hero'], position: 1 } };
    expect(eventsOf(advance(moved, 10_000).events, 'strikeResolved')).toEqual([
      expect.objectContaining({ hit: 2, damage: 15 }),
    ]);
  });

  // --- Les règles d'« Attaquer » ---

  given(/^l'ennemi ciblé est étourdi$/u, () => {
    battle = fight(['bulwark', 'shieldBash'], { momentum: 2 }, {}, stunned);
  });

  when(/^le héros lance une frappe de pouvoir sur lui$/u, () => {
    launch(battle, 'shieldBash');
  });

  then(
    /^les PV retirés sont multipliés par 1,5 et aucune garde n'est retirée, comme pour « Attaquer »$/u,
    () => {
      // 10 × 50 % × 150 % = 7,5, arrondi à 7.
      expect(resolved()).toEqual([expect.objectContaining({ damage: 7, guardDamage: 0 })]);
    },
  );

  given(/^la garde de la cible tombe à 0 sous un Coup de bouclier$/u, () => {
    battle = fight(
      ['bulwark', 'shieldBash'],
      { momentum: 2, hp: 30 },
      { modifiers: { ...NO_MODIFIERS, onGuardBreak: { momentum: 1, heal: 5 } } },
      { guard: 20 },
    );
    launched = act(battle, cast('shieldBash'), CAST_AT);
    const hit = advance(launched.battle, impactOf(launched.battle) + 161);
    events = [...launched.events, ...hit.events];
    battle = hit.battle;
  });

  then(/^c'est une cassure, comme pour « Attaquer »$/u, () => {
    expect(eventsOf(events, 'guardBroken')).toEqual([
      expect.objectContaining({ enemy: 0, by: 'strike' }),
    ]);
  });

  and(/^si le héros possède Cœur de braise, il gagne 1 Élan et 5 PV$/u, () => {
    expect(eventsOf(events, 'momentumChanged').map(({ momentum }) => momentum)).toEqual([0, 1]);
    expect(battle.hero.hp).toBe(35);
  });

  given(/^un ennemi étourdi qui a déjà perdu son action$/u, () => {
    battle = fight(
      ['bulwark', 'shieldBash'],
      { momentum: 2 },
      {},
      { guard: 0, stun: { actionLost: true, heroAction: 0 } },
    );
  });

  when(/^le héros lance une frappe de pouvoir$/u, () => {
    launch(battle, 'shieldBash');
  });

  then(/^elle compte comme la prochaine action du héros, comme une attaque$/u, () => {
    expect(launched.battle.heroActions).toBe(battle.heroActions + 1);
    expect(launched.battle.lastPlayed).toBe('hero');
  });

  and(/^l'ennemi fait ensuite son retour en garde$/u, () => {
    expect(eventsOf(events, 'guardRestored')).toEqual([
      expect.objectContaining({ enemy: 0, inPlaceOfAction: false }),
    ]);
  });

  given(/^l'Errante a 3 Élan, Entaille et Rafale équipées$/u, () => {
    battle = fight(['shadowStep', 'rend', 'flurry'], { momentum: 3 });
  });

  when(/^elle lance Entaille, puis Rafale$/u, () => {
    const rended = act(battle, cast('rend'), CAST_AT);
    launched = act(rended.battle, cast('flurry'), CAST_AT + 100);
    events = [...launched.events, ...advance(launched.battle, CAST_AT + 4_000).events];
  });

  then(/^chacun des 4 coups de Rafale retire 150 % du Brise-garde, en un seul calcul$/u, () => {
    // 5 × 100 % × 150 % × 100 % = 7,5, arrondi une fois à 7.
    expect(resolved()).toEqual(
      [1, 2, 3, 4].map((hit) => expect.objectContaining({ hit, guardDamage: 7, rend: true })),
    );
  });

  and(/^Entaille est consommée par cette frappe$/u, () => {
    expect(launched.battle.hero).not.toHaveProperty('rend');
    expect(launched.battle.hero.momentum).toBe(0);
  });
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/frappes-de-pouvoir.feature');
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
