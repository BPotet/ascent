/**
 * Scénarios `@session` des « Frappes de pouvoir » (#236) : une vraie session d'ascension et une
 * vraie session du camp, sur un Stockage clé-valeur en mémoire. Le lancement écrit le choix des
 * pouvoirs équipés sous `camp.equippedPowers` ; fermer l'application, c'est ouvrir de nouvelles
 * sessions sur le même stockage.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { battleView } from '../../src/adapters/ui/state/battleView';
import { campSessionOf } from '../../src/application/testing/campSetUp';
import { SHARD_TOTAL_KEY, type AscentSession } from '../../src/application/useCases/AscentSession';
import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  type CampSession,
} from '../../src/application/useCases/CampSession';
import { serializeCamp } from '../../src/domain/ascent/camp';
import { powerPrice } from '../../src/domain/ascent/powerTree';
import type { Battle } from '../../src/domain/battle/Battle';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';
import { settleStore, storySession, storyStore, type StoryStore } from '../support/tiersStory';

interface World {
  store: StoryStore;
  session: AscentSession;
  camp: CampSession;
}

let world: World;
let battle: Battle;

/** Une nouvelle app sur le stockage : une session d'ascension et une session du camp, chargées. */
async function open(store: StoryStore): Promise<void> {
  const { session } = storySession(store);
  const camp = campSessionOf(session, store);
  await session.load();
  await camp.load();
  world = { store, session, camp };
}

/** Une app neuve, les pouvoirs `powers` débloqués, et la mémoire des pouvoirs équipés `memory`. */
async function withPowers(
  powers: readonly PowerKind[],
  memory?: Partial<Record<HeroKind, readonly PowerKind[]>>,
): Promise<void> {
  const store = storyStore();
  store.values.set(
    SHARD_TOTAL_KEY,
    JSON.stringify({ version: 1, total: 500, seed: null, awarded: [] }),
  );
  store.values.set(
    CAMP_KEY,
    serializeCamp({
      unlocks: [],
      powers: powers.map((power) => ({ power, price: powerPrice(power) })),
    }),
  );
  if (memory !== undefined) {
    store.values.set(EQUIPPED_POWERS_KEY, JSON.stringify({ version: 1, heroes: memory }));
  }
  await open(store);
}

async function launch(hero: HeroKind, powers: readonly PowerKind[]): Promise<void> {
  expect(await world.camp.launchAscent({ hero, powers })).toMatchObject({ kind: 'begun' });
}

/** Le premier combat de l'ascension en cours. */
async function firstBattle(): Promise<Battle> {
  const battleSession = world.session.battleSession();
  await battleSession.start();
  return battleSession.current()!.battle;
}

/** La fin de l'ascension en cours, puis une nouvelle app sur le même stockage. */
async function endAndReopen(): Promise<void> {
  world.session.abandon();
  world.session.leave();
  await settleStore();
  await open(world.store);
}

const WANDERER_FIVE: readonly PowerKind[] = ['rend', 'mist', 'flurry', 'ambush'];
const SENTINEL_MEMORY: readonly PowerKind[] = ['bulwark', 'retaliation', 'holdFast'];

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^le joueur a choisi, dans cet ordre, Frappe furtive, Entaille et Pas de l'ombre$/u,
    async () => {
      await withPowers(['rend', 'mist', 'ambush']);
      await launch('wanderer', ['ambush', 'rend', 'shadowStep']);
    },
  );

  when(/^c'est la phase du héros$/u, async () => {
    battle = await firstBattle();
  });

  then(
    /^les touches sont, de gauche à droite : Pas de l'ombre, Entaille, Frappe furtive, puis « Attaquer »$/u,
    () => {
      const pad = battleView(battle).pad;
      expect(pad.kind).toBe('hero');
      expect(pad.kind === 'hero' && pad.powers.map(({ power }) => power)).toEqual([
        'shadowStep',
        'rend',
        'ambush',
      ]);
    },
  );

  given(
    /^le joueur a équipé l'Errante de Entaille, Rafale et Frappe furtive lors de sa dernière ascension$/u,
    async () => {
      await withPowers(['retaliation', 'holdFast', 'shieldBash', ...WANDERER_FIVE], {
        sentinel: SENTINEL_MEMORY,
      });
      await launch('wanderer', ['rend', 'flurry', 'ambush']);
      await settleStore();
    },
  );

  when(/^il commence une nouvelle ascension et ouvre le Choix du héros$/u, async () => {
    await endAndReopen();
  });

  then(/^l'Errante est présélectionnée avec Entaille, Rafale et Frappe furtive$/u, () => {
    expect(world.camp.view().equipped.wanderer).toEqual(['rend', 'flurry', 'ambush']);
  });

  and(/^les pouvoirs mémorisés pour la Sentinelle ne changent pas$/u, () => {
    expect(world.camp.view().equipped.sentinel).toEqual(SENTINEL_MEMORY);
    expect(JSON.parse(world.store.values.get(EQUIPPED_POWERS_KEY)!).heroes.sentinel).toEqual(
      SENTINEL_MEMORY,
    );
  });

  given(
    /^une mise à jour où la Sentinelle a 4 pouvoirs débloqués et aucun choix mémorisé$/u,
    async () => {
      await withPowers(['retaliation', 'holdFast', 'shieldBash', 'crushingBlow']);
      expect(world.store.values.has(EQUIPPED_POWERS_KEY)).toBe(false);
    },
  );

  when(/^le joueur ouvre le Choix du héros$/u, () => undefined);

  then(
    /^la Sentinelle est présélectionnée avec le Rempart, puis les pouvoirs suivants dans l'ordre de l'arbre$/u,
    () => {
      expect(world.camp.view().equipped.sentinel).toEqual([
        'bulwark',
        'shieldBash',
        'crushingBlow',
      ]);
    },
  );

  given(
    /^une ascension lancée avec l'Errante équipée de Entaille, Rafale et Frappe furtive$/u,
    async () => {
      await withPowers(WANDERER_FIVE);
      await launch('wanderer', ['rend', 'flurry', 'ambush']);
    },
  );

  when(/^le joueur met l'ascension en pause et la reprend, même un autre jour$/u, async () => {
    world.session.pause();
    await settleStore();
    await open(world.store);
  });

  then(/^ses pouvoirs équipés sont toujours Entaille, Rafale et Frappe furtive$/u, async () => {
    expect(world.session.current()?.powers).toEqual(['rend', 'flurry', 'ambush']);
    expect((await firstBattle()).powers).toEqual(['rend', 'flurry', 'ambush']);
  });

  and(/^l'ascension ne propose aucun moyen de les changer$/u, async () => {
    // L'ascension en cours ne lit jamais la mémoire du choix : une autre mémoire ne la change pas.
    expect(world.camp.view().ascentInProgress).toBe(true);
    world.store.values.set(
      EQUIPPED_POWERS_KEY,
      JSON.stringify({ version: 1, heroes: { wanderer: ['shadowStep', 'rend', 'mist'] } }),
    );
    world.session.pause();
    await open(world.store);
    expect(world.session.current()?.powers).toEqual(['rend', 'flurry', 'ambush']);
  });
};

// La session seule : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/frappes-de-pouvoir.feature');
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
