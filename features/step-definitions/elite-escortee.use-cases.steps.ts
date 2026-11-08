/**
 * « Élite escortée » (#257) à travers la session d'ascension, sur un Stockage clé-valeur en
 * mémoire : les récompenses d'une Élite escortée gagnée, et un combat d'Élite sauvegardé avant la
 * story, écrit en JSON à la main (`ELITE_BATTLE_BEFORE_257`), repris sans escorte.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ELITE_BATTLE_BEFORE_257 } from '../../src/application/testing/eliteBattleBefore257';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import { ITEMS } from '../../src/domain/ascent/items';
import { eliteGold } from '../../src/domain/ascent/rewards';
import { TIERS } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import {
  ascentBefore,
  playToTheEnd,
  storySession,
  storyStore,
  type StoryStore,
} from '../support/tiersStory';

interface World {
  store: StoryStore;
  escorted: Ascent;
  alone: Ascent;
  battle: Battle;
}

let world: World;

/**
 * L'ascension après la victoire sur l'Élite du palier 3 et `escort` : l'escorte déjà tombée,
 * l'Élite à 1 PV, le héros à 70 PV ; le même combat que l'Élite seule.
 */
async function wonAgainst(escort: readonly EnemyKind[]): Promise<Ascent> {
  const enemies: readonly EnemyKind[] = ['firstPilgrim', ...escort];
  const { battle } = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    heroHp: 70,
    enemies,
    tierMultiplier: TIERS[3].eliteMultiplier,
    ...(escort.length > 0 && { escortMultiplier: TIERS[3].multiplier }),
  });
  const ending: Battle = {
    ...battle,
    enemies: battle.enemies.map((enemy, index) => ({ ...enemy, hp: index === 0 ? 1 : 0 })),
  };
  const store = storyStore();
  const ascent = ascentBefore(3, 'elite', enemies);
  store.values.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent, battle: ending }));
  const { session, clock } = storySession(store);
  await session.load();
  await playToTheEnd(session.battleSession(), clock);
  return session.current()!;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension sans malédiction$/u, () => {
    world = { store: storyStore() } as World;
  });

  // --- Récompenses ---

  when(/^le héros gagne un combat d'Élite escortée au palier 3$/u, async () => {
    world.escorted = await wonAgainst(['bellNovice', 'clockJack']);
    world.alone = await wonAgainst([]);
  });

  then(
    /^il gagne 37 Or, l'objet Rare garanti, le Coffre scellé, 2 Éclats, le tirage du Cœur de braise et le Répit, comme pour une Élite seule$/u,
    () => {
      const { escorted } = world;
      expect(escorted.lastGold).toBe(37);
      expect(escorted.sealedChest).toMatchObject({ opened: false });
      expect(ITEMS[escorted.sealedChest!.eliteItem!].rarity).toBe('rare');
      expect(escorted.shardAwards).toContainEqual({ id: '3:3:3:elite', amount: 2 });
      // Le répit du palier 3 : +5 % des PV max, de 70 PV.
      expect(escorted.hero.hp).toBeGreaterThan(70);
      expect(escorted).toEqual(world.alone);
    },
  );

  and(/^l'escorte ne rapporte aucun Or$/u, () => {
    expect(world.escorted.lastGold).toBe(eliteGold(3));
    expect(world.escorted.gold).toBe(world.alone.gold);
  });

  // --- Sauvegarde d'avant la story ---

  given(
    /^une ascension sauvegardée pendant un combat d'Élite au palier 3, avant cette story$/u,
    () => {
      const ascent = ascentBefore(3, 'elite', ['firstPilgrim']);
      world.store.values.set(
        ASCENT_KEY,
        `{"version":1,"ascent":${JSON.stringify(ascent)},"battle":${ELITE_BATTLE_BEFORE_257}}`,
      );
    },
  );

  when(/^le joueur la reprend$/u, async () => {
    const { session } = storySession(world.store);
    await session.load();
    const battleSession = session.battleSession();
    await battleSession.start();
    world.battle = battleSession.current()!.battle;
  });

  then(/^le combat se rejoue sans escorte$/u, () => {
    expect(world.battle.enemies).toHaveLength(1);
    expect(world.battle.enemies[0]).toMatchObject({ kind: 'firstPilgrim', hp: 300, maxHp: 364 });
    expect(world.battle.enemies[0]).not.toHaveProperty('escort');
    expect(world.battle).not.toHaveProperty('escortMultiplier');
    // Son multiplicateur enregistré, celui d'avant #257 : 135 % des PV et des dégâts.
    expect(world.battle.tierMultiplier).toEqual({ hpPercent: 135, guardPercent: 150 });
  });
};

// La session seule : `@domain` et `@ui` ont leurs propres étapes.
const feature = loadFeature('features/elite-escortee.feature');
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
