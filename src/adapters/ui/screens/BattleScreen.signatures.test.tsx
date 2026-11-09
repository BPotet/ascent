// L'écran de combat contre la Mère-ronce et le Bedeau (#259, maquette 245, M1, M2, B1, B2) : la
// bulle de première rencontre, la piqûre des Épines 300 ms après la frappe, la barre de PV du
// héros qui baisse avec le « −2 », et le Sanctuaire passé à la scène.
import { act, screen } from '@testing-library/react-native';

import type { BattleFactory } from '../../../application/useCases/BattleSession';
import { encounterMultipliers } from '../../../domain/ascent/tiers';
import { startBattle } from '../../../domain/battle/Battle';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { SceneSignatures } from '../battle/scene/signatureScene';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderBattle } from '../testing/battleScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hiddenToo = { includeHiddenElements: true } as const;

const eliteOf =
  (kind: EnemyKind, tier: 2 | 3): BattleFactory =>
  (options) =>
    startBattle({
      ...options,
      enemies: [kind],
      ...encounterMultipliers(tier, { kind: 'elite', enemies: [kind] }),
    });

const seen = (kind: EnemyKind) => {
  const keyValueStore = memoryKeyValueStore();
  keyValueStore.values.set(`battle.hint.encounter.${kind}.seen`, '1');
  return keyValueStore;
};

function sceneSignatures(): SceneSignatures {
  return (screen.getByTestId('battle-scene', hiddenToo).props as { signatures: SceneSignatures })
    .signatures;
}

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe('BattleScreen: the Bramble mother (#259)', () => {
  it('shows the first encounter bubble of her Thorns, and her mark (M1)', async () => {
    await renderBattle({ seed: 1, createBattle: eliteOf('brambleMother', 2) });

    expect(screen.getByTestId('encounter-hint-brambleMother')).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-brambleMother-signature', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText(/Épines : −2 PV par frappe/u, hiddenToo)).toBeOnTheScreen();
  });

  it('pays the Thorns 300 ms after the strike: the « −2 », the word, the bar and the spikes (M2)', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: eliteOf('brambleMother', 2),
      keyValueStore: seen('brambleMother'),
    });
    const resolved = () =>
      test.snapshots.some((snapshot) => snapshot.events.some((e) => e.type === 'strikeResolved'));

    await test.attack();
    await test.runUntil(resolved);

    expect(test.battle().hero.hp).toBe(78);
    expect(screen.getByTestId('battle-thorns-float', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('PV 80/80', hiddenToo)).toBeOnTheScreen();
    expect(sceneSignatures().prick).not.toBeNull();

    await wait(350);

    expect(screen.getByText('PV 78/80', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('Épines', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('battle-hero-thorns', hiddenToo)).toBeOnTheScreen();
  });
});

describe('BattleScreen: the Beadle (#259)', () => {
  it('borders his guard bar with steel and strikes a steel spark at each reduced blow (B1, B2)', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: eliteOf('beadle', 3),
      keyValueStore: seen('beadle'),
    });

    expect(screen.getByTestId('enemy-beadle-guard-ward', hiddenToo)).toBeOnTheScreen();
    await test.attack();
    await test.runUntil(() =>
      test.snapshots.some((snapshot) => snapshot.events.some((e) => e.type === 'strikeResolved')),
    );

    expect(sceneSignatures().wardSpark).toMatchObject({ enemy: 0 });
    expect(screen.getByTestId('damage-half', hiddenToo)).toBeOnTheScreen();
  });
});
