// Scénario « En local » de l'issue #54 : `npm run mutation:changed`, `npm run mutation` et
// `npm run verify:full` ne mutent pas les écrans ; `npm run mutation:ui` les mute à la demande.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import baseConfig from '../../stryker.config.mjs';
import domainConfig from '../../stryker.domain.config.mjs';
import uiConfig from '../../stryker.ui.config.mjs';
import { classify, isRetained } from './plan.mjs';

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

// Issue #145 : le « dry run » des écrans dépassait le délai par défaut de Stryker (5 minutes).
describe('dry run timeout', () => {
  it('is 20 minutes in the three configs', () => {
    for (const config of [baseConfig, domainConfig, uiConfig]) {
      assert.equal(config.dryRunTimeoutMinutes, 20);
    }
  });
});

// Issue #147 : le délai par mutant de Stryker coupait les runs normaux des mutants d'écran.
describe('per-mutant timeout', () => {
  it('is 10 minutes for the screens', () => {
    assert.equal(uiConfig.timeoutMS, 600_000);
  });

  it('stays 10 seconds for the domain and the rest of the new code', () => {
    for (const config of [baseConfig, domainConfig]) assert.equal(config.timeoutMS, 10_000);
  });
});

// Issue #145 : les données recopiées de l'Atelier (ADR 0010) sortent de la liste `mutate` des
// écrans. Ce n'est sans effet sur le score que si tous leurs mutants sont déjà ignorés.
describe('Atelier data', () => {
  const dir = 'src/adapters/ui/pixelArt/sprites/atelier/data';
  const files = readdirSync(resolve(root, dir)).map((name) => `${dir}/${name}`);

  it('is left out of the screen mutation and of the plan', () => {
    assert.ok(files.length > 0);
    for (const file of files) {
      assert.equal(isRetained(file, uiConfig.mutate), false, file);
      assert.equal(classify(file), null, file);
    }
    assert.equal(
      isRetained('src/adapters/ui/pixelArt/sprites/atelier/fullAnimation.ts', uiConfig.mutate),
      true,
    );
  });

  it('has every mutant disabled, so that leaving it out hides no executable mutant', () => {
    for (const file of files) {
      const [first] = readFileSync(resolve(root, file), 'utf8').split('\n');
      assert.equal(first.trim(), '// Stryker disable all', file);
    }
  });
});
