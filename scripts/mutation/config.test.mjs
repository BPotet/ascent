// Scénario « En local » de l'issue #54 : `npm run mutation:changed`, `npm run mutation` et
// `npm run verify:full` ne mutent pas les écrans ; `npm run mutation:ui` les mute à la demande.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import baseConfig from '../../stryker.config.mjs';
import uiConfig from '../../stryker.ui.config.mjs';
import { isRetained } from './plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { scripts } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const screens = [
  'src/adapters/ui/screens/DayViewScreen.tsx',
  'src/adapters/ui/state/useDayView.ts',
  'src/app/_layout.tsx',
  'src/app/(tabs)/week.tsx',
];
const rest = [
  'src/application/useCases/toggleCheckIn.ts',
  'src/adapters/persistence/sqlite/SqlDatabase.ts',
  'src/adapters/device/clock/SystemClock.ts',
];

describe('npm scripts', () => {
  it('mutates only the screens with npm run mutation:ui', () => {
    assert.match(scripts['mutation:ui'], /\s--ui-only(\s|$)/);
  });

  it('never asks for the screens in mutation:changed, mutation and verify:full', () => {
    for (const name of ['mutation:changed', 'mutation', 'verify:full']) {
      assert.doesNotMatch(scripts[name], /--ui(-only)?(\s|$)/, name);
      assert.doesNotMatch(scripts[name], /mutation:ui|stryker\.ui\.config/, name);
    }
  });
});

describe('stryker.config.mjs', () => {
  it('leaves the screens out', () => {
    for (const file of screens) assert.equal(isRetained(file, baseConfig.mutate), false, file);
  });

  it('keeps the application, the persistence and the device adapters', () => {
    for (const file of rest) assert.equal(isRetained(file, baseConfig.mutate), true, file);
  });
});

describe('stryker.ui.config.mjs', () => {
  it('mutates the screens and nothing else, with the thresholds of the new code', () => {
    for (const file of screens) assert.equal(isRetained(file, uiConfig.mutate), true, file);
    for (const file of [...rest, 'src/domain/habit/Habit.ts', 'src/app/_layout.test.tsx']) {
      assert.equal(isRetained(file, uiConfig.mutate), false, file);
    }
    assert.deepEqual(uiConfig.thresholds, baseConfig.thresholds);
  });
});
