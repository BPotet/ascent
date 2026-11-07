/**
 * Scénarios `@session` de « L'arbre de pouvoirs » (#235) : une vraie session d'ascension et une
 * vraie session du camp, sur un Stockage clé-valeur en mémoire. Fermer l'application, c'est ouvrir
 * de nouvelles sessions sur le même stockage ; rien du camp ne dépend du jour.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { campSessionOf } from '../../src/application/testing/campSetUp';
import type { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  ASCENT_KEY,
  SHARD_TOTAL_KEY,
  type AscentSession,
} from '../../src/application/useCases/AscentSession';
import { CAMP_KEY, type CampSession } from '../../src/application/useCases/CampSession';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import { campPowers, parseCamp } from '../../src/domain/ascent/camp';
import type { PowerKind } from '../../src/domain/battle/powers';
import { equippedOf } from '../../src/domain/battle/Battle';
import {
  ascentBefore,
  saveBefore,
  settleStore,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  camp: CampSession;
  clock: ManualBattleClock;
}

let world: World;
let running: Ascent | null;

/** Une nouvelle app sur le stockage : une session d'ascension et une session du camp, chargées. */
async function open(store: StoryStore): Promise<void> {
  const { session, clock } = storySession(store);
  const camp = campSessionOf(session, store);
  await session.load();
  await camp.load();
  world = { store, session, camp, clock };
}

async function withShards(total: number): Promise<void> {
  const store = storyStore();
  store.values.set(SHARD_TOTAL_KEY, JSON.stringify({ version: 1, total, seed: null, awarded: [] }));
  await open(store);
}

async function unlockPower(power: PowerKind): Promise<void> {
  expect(await world.camp.unlockPower(power)).toBe('unlocked');
}

const stateOf = (code: PowerKind) =>
  [...world.camp.view().trees.sentinel.nodes, ...world.camp.view().trees.wanderer.nodes].find(
    (node) => node.code === code,
  )?.state;

const savedPowers = () => campPowers(parseCamp(world.store.values.get(CAMP_KEY) ?? null).camp);

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- L'achat ---

  given(/^le joueur a 30 Éclats disponibles$/u, async () => {
    await withShards(30);
  });

  when(/^il débloque Entaille dans l'arbre de l'Errante$/u, async () => {
    await unlockPower('rend');
  });

  then(/^il a 0 Éclat disponible$/u, () => {
    expect(world.camp.view().availableShards).toBe(0);
  });

  given(/^le joueur a débloqué Représailles et a 60 Éclats disponibles$/u, async () => {
    await withShards(90);
    await unlockPower('retaliation');
    expect(world.camp.view().availableShards).toBe(60);
  });

  when(/^il débloque Tenir bon$/u, async () => {
    await unlockPower('holdFast');
  });

  then(/^il a 0 Éclat disponible et Tenir bon est débloqué$/u, () => {
    expect(world.camp.view().availableShards).toBe(0);
    expect(stateOf('holdFast')).toEqual({ kind: 'unlocked' });
    expect(savedPowers()).toEqual(['retaliation', 'holdFast']);
  });

  // --- Jamais perdu ---

  given(/^le joueur a débloqué Représailles$/u, async () => {
    await withShards(80);
    await unlockPower('retaliation');
  });

  when(
    /^le héros tombe, que le joueur abandonne, que l'application est fermée de force ou que le jour change$/u,
    async () => {
      // Le héros tombe : une chute sauvegardée, relue par la session.
      const fallen = {
        ...world.camp.beginAscent({ hero: 'sentinel' })!,
        encounter: null,
        outcome: 'fall' as const,
      };
      world.store.values.set(
        ASCENT_KEY,
        JSON.stringify({ version: 1, ascent: fallen, battle: null }),
      );
      await world.session.load();
      world.session.leave();
      // Le joueur abandonne.
      world.camp.beginAscent({ hero: 'sentinel' });
      world.session.abandon();
      world.session.leave();
      await settleStore();
      // L'application est fermée de force, puis rouverte un autre jour : de nouvelles sessions
      // relisent le même stockage.
      await open(world.store);
    },
  );

  then(
    /^Représailles est toujours débloqué, sans pouvoir être racheté, et les Éclats disponibles sont inchangés$/u,
    async () => {
      expect(savedPowers()).toEqual(['retaliation']);
      expect(stateOf('retaliation')).toEqual({ kind: 'unlocked' });
      expect(await world.camp.unlockPower('retaliation')).toBe('refused');
      expect(world.camp.view().availableShards).toBe(50);
    },
  );

  // --- Le prix ---

  given(/^une jauge en malédiction forte$/u, async () => {
    await withShards(100);
    running = world.camp.beginAscent({ hero: 'sentinel', gauge: -2 });
    expect(running?.gauge).toBe(-2);
  });

  when(/^le joueur ouvre l'arbre de pouvoirs au camp$/u, () => undefined);

  then(/^les prix sont 30 Éclats au rang 1 et 60 Éclats au rang 2$/u, async () => {
    await unlockPower('retaliation');
    expect(world.camp.view().availableShards).toBe(70);
    await unlockPower('holdFast');
    expect(world.camp.view().availableShards).toBe(10);
    expect(JSON.parse(world.store.values.get(CAMP_KEY)!).powers).toEqual([
      { power: 'retaliation', price: 30 },
      { power: 'holdFast', price: 60 },
    ]);
  });

  and(/^il peut débloquer ce que ses Éclats disponibles permettent$/u, async () => {
    expect(stateOf('rend')).toEqual({ kind: 'missing', missing: 20 });
    expect(await world.camp.unlockPower('rend')).toBe('refused');
  });

  // --- Les Éclats partagés avec le Gardien ---

  given(/^le joueur a 50 Éclats disponibles$/u, async () => {
    await withShards(50);
  });

  when(
    /^il débloque Représailles \(30\), puis l'Épieu de chasse \(20\) chez le Gardien de la flamme$/u,
    async () => {
      await unlockPower('retaliation');
      expect(await world.camp.unlock('huntingSpear')).toBe('unlocked');
    },
  );

  then(/^il a 0 Éclat disponible, au camp comme au pied de la tour$/u, async () => {
    expect(world.camp.view().availableShards).toBe(0);
    // Le pied de la tour lit les Éclats disponibles du même camp : une nouvelle app les relit.
    await open(world.store);
    expect(world.camp.view().availableShards).toBe(0);
    expect(JSON.parse(world.store.values.get(CAMP_KEY)!)).toEqual({
      version: 1,
      unlocks: [{ unlock: 'huntingSpear', price: 20 }],
      powers: [{ power: 'retaliation', price: 30 }],
    });
  });

  // --- Les pouvoirs équipés figés dans l'ascension ---

  given(/^une ascension en cours avec la Sentinelle, qui n'a que le Rempart$/u, async () => {
    await withShards(100);
    running = world.camp.beginAscent({ hero: 'sentinel' });
    expect(running?.powers).toEqual(['bulwark']);
  });

  when(/^le joueur débloque Représailles au camp$/u, async () => {
    await unlockPower('retaliation');
  });

  then(/^l'arbre indique « Dès ta prochaine ascension »$/u, () => {
    expect(stateOf('retaliation')).toEqual({ kind: 'nextAscent' });
  });

  and(/^l'ascension en cours garde le Rempart seul jusqu'à sa fin$/u, async () => {
    expect(world.session.current()?.powers).toEqual(['bulwark']);
    await settleStore();
    await open(world.store);
    expect(world.session.current()?.powers).toEqual(['bulwark']);
  });

  and(/^l'ascension suivante avec la Sentinelle équipe le Rempart et Représailles$/u, () => {
    world.session.abandon();
    world.session.leave();
    expect(world.camp.beginAscent({ hero: 'sentinel' })?.powers).toEqual([
      'bulwark',
      'retaliation',
    ]);
  });

  given(
    /^une ascension lancée avec la Sentinelle équipée du Rempart et de Représailles$/u,
    async () => {
      await withShards(100);
      await unlockPower('retaliation');
      running = world.camp.beginAscent({ hero: 'sentinel' });
      expect(running?.powers).toEqual(['bulwark', 'retaliation']);
    },
  );

  when(
    /^le joueur met l'ascension en pause et la reprend, même un autre jour, après avoir débloqué Tenir bon$/u,
    async () => {
      world.session.pause();
      await unlockPower('holdFast');
      await settleStore();
      await open(world.store);
    },
  );

  then(/^elle a toujours le Rempart et Représailles, et pas Tenir bon$/u, () => {
    expect(world.session.current()?.powers).toEqual(['bulwark', 'retaliation']);
    expect(world.camp.view().equipped.sentinel).toEqual(['bulwark', 'retaliation', 'holdFast']);
  });

  given(/^une ascension sauvegardée avant cette story$/u, async () => {
    const store = storyStore();
    store.values.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: 80, seed: null, awarded: [] }),
    );
    const { powers: _, ...before } = ascentBefore(1, 'combat', ['ghoul']);
    saveBefore(store, before as Ascent, false);
    await open(store);
  });

  when(/^le joueur la reprend après avoir débloqué Représailles$/u, async () => {
    await unlockPower('retaliation');
    await open(world.store);
  });

  then(/^le héros n'a que son pouvoir de base jusqu'à la fin de cette ascension$/u, async () => {
    expect(world.session.current()?.powers).toEqual(['bulwark']);
    const battle = world.session.battleSession();
    await battle.start();
    expect(equippedOf(battle.current()!.battle)).toEqual(['bulwark']);
  });
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/arbre-de-pouvoirs.feature');
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
