/**
 * « Réglages du combat » (#211) à travers la session d'ascension, sur un Stockage clé-valeur en
 * mémoire : la porte Élite du palier 2, l'Épouvantail et le Brûleur de ronces à leur garde du Codex
 * (`codex/scarecrow` v3, `codex/brambleBurner` v4), jamais multipliée par le palier.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { TIERS } from '../../src/domain/ascent/tiers';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { ascentBefore, saveBefore, storySession, storyStore } from '../support/tiersStory';

/** Le premier ennemi du combat qui commence derrière la porte Élite du palier 2. */
async function eliteFight(elite: EnemyKind) {
  const store = storyStore();
  saveBefore(store, ascentBefore(2, 'elite', [elite]), false);
  const { session } = storySession(store);
  await session.load();
  const battleSession = session.battleSession();
  await battleSession.start();
  const { battle } = battleSession.current()!;
  // Une Élite n'est jamais multipliée par le palier.
  expect(battle.tierMultiplier).toBeUndefined();
  return battle.enemies[0]!;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  let scarecrow: Awaited<ReturnType<typeof eliteFight>>;

  given(/^une porte Élite du palier 2$/u, () => {
    expect(TIERS[2].elites).toEqual(expect.arrayContaining(['scarecrow', 'brambleBurner']));
  });

  when(/^le combat commence contre l'Épouvantail$/u, async () => {
    scarecrow = await eliteFight('scarecrow');
    expect(scarecrow.kind).toBe('scarecrow');
  });

  then(/^il a (\d+) PV et une garde de (\d+)$/u, (hp: string, guard: string) => {
    expect(scarecrow).toMatchObject({
      hp: Number(hp),
      maxHp: Number(hp),
      guard: Number(guard),
      maxGuard: Number(guard),
    });
  });

  and(
    /^contre le Brûleur de ronces, (\d+) PV et une garde de (\d+)$/u,
    async (hp: string, guard: string) => {
      const burner = await eliteFight('brambleBurner');
      expect(burner).toMatchObject({
        kind: 'brambleBurner',
        hp: Number(hp),
        maxHp: Number(hp),
        guard: Number(guard),
        maxGuard: Number(guard),
      });
    },
  );
};

// La session seule : `@domain` éprouve les règles du domaine sans session.
const feature = loadFeature('features/reglages-du-combat.feature');
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
