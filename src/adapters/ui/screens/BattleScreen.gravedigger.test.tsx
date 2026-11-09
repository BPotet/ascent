// L'écran de combat contre le Fossoyeur (#258, maquette 245, F1 à F6) : l'atlas du Squelette préparé
// avant le combat, la bulle de première rencontre qui ne bloque rien, la colonne seule puis les trois
// colonnes dès que le Squelette est entré, l'annonce et la sortie de terre passée à la scène.
import { fireEvent, screen } from '@testing-library/react-native';

import type { BattleFactory } from '../../../application/useCases/BattleSession';
import { encounterMultipliers } from '../../../domain/ascent/tiers';
import { startBattle } from '../../../domain/battle/Battle';
import type { SceneEnemy } from '../battle/sceneTypes';
import { preparedKinds } from '../battle/testing/fakeBattleCanvas';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderBattle, settle, type BattleScreenTest } from '../testing/battleScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hiddenToo = { includeHiddenElements: true } as const;
const SEEN = 'battle.hint.encounter.gravedigger.seen';

/** Le Fossoyeur seul au palier 1, ses PV et sa garde gardés hauts : il ne tombe pas. */
const gravedigger: BattleFactory = (options) =>
  startBattle({
    ...options,
    initiative: true,
    enemies: ['gravedigger'],
    ...encounterMultipliers(1, { kind: 'elite', enemies: ['gravedigger'] }),
  });

function sceneEnemies(): readonly SceneEnemy[] {
  return (screen.getByTestId('battle-scene', hiddenToo).props as { enemies: SceneEnemy[] }).enemies;
}

const columns = () => screen.getAllByTestId(/^enemy-[a-zA-Z]+$/u, hiddenToo);

/** Le héros attaque à son tour jusqu'à l'Exhumation de la manche 2. */
async function toExhumation(test: BattleScreenTest): Promise<void> {
  const exhumed = () =>
    test.snapshots.some((snapshot) => snapshot.events.some((e) => e.type === 'enemyExhumed'));
  for (let turn = 0; turn < 6 && !exhumed(); turn += 1) {
    await test.runUntil(() => test.battle().phase.kind === 'hero' || exhumed());
    if (!exhumed()) await test.attack();
  }
  await test.runUntil(exhumed);
}

describe('BattleScreen: the Gravedigger (#258)', () => {
  it('prepares the atlas of the Skeleton with the Gravedigger, before the battle shows', async () => {
    preparedKinds.length = 0;

    await renderBattle({ seed: 1, createBattle: gravedigger });

    expect(preparedKinds).toContainEqual(['gravedigger', 'skeleton']);
  });

  it('shows the first encounter bubble once, without blocking: a touch closes it (F1)', async () => {
    const keyValueStore = memoryKeyValueStore();
    await renderBattle({ seed: 1, createBattle: gravedigger, keyValueStore });

    expect(screen.getByTestId('encounter-hint-gravedigger')).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-gravedigger-signature', hiddenToo)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('battle-scene-frame'), 'touchStart');
    await settle();

    expect(screen.queryByTestId('encounter-hint-gravedigger')).toBeNull();
    expect(keyValueStore.values.get(SEEN)).toBe('1');
  });

  it('never shows the bubble once seen', async () => {
    const keyValueStore = memoryKeyValueStore();
    keyValueStore.values.set(SEEN, '1');
    await renderBattle({ seed: 1, createBattle: gravedigger, keyValueStore });

    expect(screen.queryByTestId('encounter-hint-gravedigger')).toBeNull();
  });

  it('keeps one column, then three once the Skeleton has come out of the ground (F2, F3)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: gravedigger });
    expect(columns()).toHaveLength(1);

    await toExhumation(test);

    expect(columns()).toHaveLength(2);
    expect(screen.getByText('Il exhume un Squelette', hiddenToo)).toBeOnTheScreen();
    const exhumedAt = test.snapshots
      .flatMap((snapshot) => snapshot.events)
      .find((event) => event.type === 'enemyExhumed')!.at;
    expect(sceneEnemies()[1]).toMatchObject({ kind: 'skeleton', exhumedAt });
    expect(sceneEnemies()[0]).not.toHaveProperty('exhumedAt');
  });
});
