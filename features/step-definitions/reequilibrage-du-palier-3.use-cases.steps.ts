/**
 * « Rééquilibrage du palier 3 » (#244) à travers la session d'ascension, sur un Stockage clé-valeur
 * en mémoire : les sauvegardes d'avant la mise à jour, reprises avec leurs valeurs, et le plafond de
 * soin de parade sauvegardé avec le combat. Les sauvegardes d'avant sont écrites en JSON à la main,
 * sans les champs de #244 (`tierMultiplier` d'une Élite, `respitePercent`, `parryHealed`,
 * `lastElite`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { AscentSession } from '../../src/application/useCases/AscentSession';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import type { Battle } from '../../src/domain/battle/Battle';
import { ENEMIES } from '../../src/domain/battle/combatants';
import { PERFECT_PARRY_HEAL_CAP, cappedParryHeal } from '../../src/domain/battle/parryHeal';
import {
  ascentBefore,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  saved: Battle;
  battle: Battle;
}

let world: World;

/** Un combat d'avant #244, écrit à la main : ses ennemis à leurs valeurs enregistrées. */
function savedBattle(enemies: Battle['enemies'], hero: Partial<Battle['hero']> = {}): Battle {
  return {
    now: 0,
    random: [1, 2, 3, 4],
    inputOffset: 0,
    round: 2,
    heroKind: 'sentinel',
    initiative: true,
    hero: { hp: 50, maxHp: 80, momentum: 2, bulwark: false, ...hero },
    enemies,
    reserve: [],
    target: 0,
    phase: { kind: 'hero', since: 0, announced: true },
    turn: { order: ['hero', 0], position: 0 },
    lastPlayed: 'enemy',
    heroActions: 1,
    offBalanceUntil: null,
    hitStop: null,
    defenseHintPending: false,
  } as unknown as Battle;
}

function enemy(
  kind: Battle['enemies'][number]['kind'],
  values: Partial<Battle['enemies'][number]>,
) {
  return {
    kind,
    hp: ENEMIES[kind].maxHp,
    maxHp: ENEMIES[kind].maxHp,
    guard: ENEMIES[kind].maxGuard,
    maxGuard: ENEMIES[kind].maxGuard,
    intent: null,
    stun: null,
    raised: false,
    raisedRound: null,
    guardRestore: null,
    ...values,
  };
}

function save(tier: 1 | 2 | 3, kind: 'combat' | 'elite', battle: Battle): void {
  const ascent = ascentBefore(
    tier,
    kind,
    battle.enemies.map((each) => each.kind),
  );
  world.store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle }));
  world.saved = battle;
}

async function resume(): Promise<void> {
  world.session = storySession(world.store).session;
  await world.session.load();
  const battleSession = world.session.battleSession();
  await battleSession.start();
  world.battle = battleSession.current()!.battle;
}

const steps: StepDefinitions = ({ given, when, then }) => {
  given(
    /^une ascension sauvegardée avant le rééquilibrage, au milieu d'un combat d'Élite du palier 3$/u,
    () => {
      world = { store: storyStore() } as World;
      // Le Premier Pèlerin d'avant #244 : 270 PV, garde 55, entamé.
      save(3, 'elite', savedBattle([enemy('firstPilgrim', { hp: 180, guard: 20 })]));
    },
  );

  given(
    /^une ascension sauvegardée avant le rééquilibrage, au milieu d'un combat ordinaire$/u,
    () => {
      world = { store: storyStore() } as World;
      // La Goule et le Spectre à leur garde d'avant #244 (15 et 10).
      save(
        1,
        'combat',
        savedBattle([
          enemy('ghoul', { guard: 7, maxGuard: 15 }),
          enemy('specter', { guard: 10, maxGuard: 10 }),
        ]),
      );
    },
  );

  when(/^le joueur la reprend après la mise à jour$/u, async () => {
    await resume();
  });

  then(/^l'Élite garde ses PV, sa garde et ses coups d'avant$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({
      kind: 'firstPilgrim',
      hp: 180,
      maxHp: 270,
      guard: 20,
      maxGuard: 55,
    });
    // Sans multiplicateur enregistré, ses coups gardent leurs dégâts d'avant (100 %).
    expect(world.battle).not.toHaveProperty('tierMultiplier');
    expect(world.battle).not.toHaveProperty('respitePercent');
  });

  then(/^chaque ennemi garde sa garde et sa garde max enregistrées$/u, () => {
    expect(world.battle.enemies.map(({ guard, maxGuard }) => [guard, maxGuard])).toEqual([
      [7, 15],
      [10, 10],
    ]);
  });

  given(/^un combat où 7 PV de parade parfaite ont été rendus$/u, async () => {
    world = { store: storyStore() } as World;
    save(2, 'combat', savedBattle([enemy('thornPilgrim', {})], { parryHealed: 7 }));
    await resume();
    expect(world.battle.hero.parryHealed).toBe(7);
  });

  when(/^l'application est fermée puis rouverte$/u, async () => {
    world.session.pause();
    await settleStore();
    await resume();
  });

  then(/^il ne reste que 3 PV de soin de parade parfaite dans ce combat$/u, () => {
    const healed = world.battle.hero.parryHealed ?? 0;
    expect(PERFECT_PARRY_HEAL_CAP - healed).toBe(3);
    expect(cappedParryHeal({ hp: 40, maxHp: 80, heal: 7, healed })).toBe(3);
  });
};

// La session seule : `@domain` éprouve les règles du domaine sans session.
const feature = loadFeature('features/reequilibrage-du-palier-3.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
