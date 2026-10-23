import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertMatches,
  buildPlan,
  classify,
  escapeGlob,
  isRetained,
  mutateEntries,
  parseDiff,
  screenFiles,
  split,
  toMatrix,
  uiNotice,
} from './plan.mjs';

const diffOf = (...blocks) => blocks.join('\n');
const modified = (file, ...hunks) =>
  diffOf(
    `diff --git a/${file} b/${file}`,
    'index 1111111..2222222 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    ...hunks,
  );

describe('parseDiff', () => {
  it('reads a one-line hunk without count', () => {
    const [change] = parseDiff(modified('src/a.ts', '@@ -3 +3 @@', '-old', '+new'));
    assert.deepEqual(change, {
      file: 'src/a.ts',
      added: false,
      ranges: [{ start: 3, end: 3 }],
      weight: 1,
    });
  });

  it('ignores pure deletions', () => {
    const [change] = parseDiff(modified('src/a.ts', '@@ -5,2 +5,0 @@', '-gone', '-gone'));
    assert.deepEqual(change.ranges, []);
    assert.equal(change.weight, 0);
  });

  it('reads several hunks of one file', () => {
    const [change] = parseDiff(
      modified(
        'src/a.ts',
        '@@ -1,0 +2,3 @@',
        '+a',
        '+b',
        '+c',
        '@@ -10,2 +13,2 @@',
        '-x',
        '-y',
        '+x',
        '+y',
      ),
    );
    assert.deepEqual(change.ranges, [
      { start: 2, end: 4 },
      { start: 13, end: 14 },
    ]);
    assert.equal(change.weight, 5);
  });

  it('keeps the new path of a renamed file', () => {
    const diff = diffOf(
      'diff --git a/src/old.ts b/src/new.ts',
      'similarity index 90%',
      'rename from src/old.ts',
      'rename to src/new.ts',
      'index 1111111..2222222 100644',
      '--- a/src/old.ts',
      '+++ b/src/new.ts',
      '@@ -7 +7 @@',
      '-a',
      '+b',
    );
    assert.deepEqual(parseDiff(diff), [
      { file: 'src/new.ts', added: false, ranges: [{ start: 7, end: 7 }], weight: 1 },
    ]);
  });

  it('marks an added file', () => {
    const diff = diffOf(
      'diff --git a/src/new.ts b/src/new.ts',
      'new file mode 100644',
      'index 0000000..2222222',
      '--- /dev/null',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,2 @@',
      '+a',
      '+b',
    );
    assert.deepEqual(parseDiff(diff), [
      { file: 'src/new.ts', added: true, ranges: [{ start: 1, end: 2 }], weight: 2 },
    ]);
  });

  it('does not take content lines for file headers', () => {
    const [change, ...others] = parseDiff(
      modified('src/a.ts', '@@ -1 +1,2 @@', '--- SQL comment removed', '+++ added', '+-- ok'),
    );
    assert.equal(others.length, 0);
    assert.equal(change.file, 'src/a.ts');
    assert.deepEqual(change.ranges, [{ start: 1, end: 2 }]);
  });
});

describe('classify', () => {
  it('puts the domain apart', () => {
    assert.equal(classify('src/domain/habit/Habit.ts'), 'domain');
  });

  it('puts the application and the non-UI adapters in core', () => {
    assert.equal(classify('src/application/checkIn.ts'), 'core');
    assert.equal(classify('src/adapters/device/clock/SystemClock.ts'), 'core');
    assert.equal(classify('src/adapters/persistence/sqlite/SqlDatabase.ts'), 'core');
    assert.equal(classify('src/future/thing.ts'), 'core');
  });

  it('takes the screens from the mutate list of stryker.ui.config.mjs', () => {
    assert.equal(
      classify('src/adapters/ui/HabitCard.tsx', {
        domainPatterns: [],
        basePatterns: ['src/**/*.tsx'],
        uiPatterns: [],
      }),
      'core',
    );
  });

  it('puts the UI adapters and the routes in ui', () => {
    assert.equal(classify('src/adapters/ui/HabitCard.tsx'), 'ui');
    assert.equal(classify('src/app/(tabs)/week.tsx'), 'ui');
    assert.equal(classify('src/app/_layout.tsx'), 'ui');
  });

  it('excludes tests, testing helpers and other files', () => {
    assert.equal(classify('src/adapters/ui/HabitCard.test.tsx'), null);
    assert.equal(classify('src/domain/habit/Habit.test.ts'), null);
    assert.equal(classify('src/adapters/persistence/testing/fakeExpoSqlite.ts'), null);
    assert.equal(classify('src/application/testing/fakes.ts'), null);
    assert.equal(classify('src/adapters/ui/assets/alert@2x.png'), null);
  });

  it('reads the patterns in order, like Stryker', () => {
    assert.equal(isRetained('src/x.ts', ['src/**/*.ts', '!src/x.ts', 'src/x.ts']), true);
    assert.equal(isRetained('src/x.ts', ['src/x.ts', '!src/**']), false);
  });
});

describe('escapeGlob and assertMatches', () => {
  // Stryker remplace chaque « \ » d'un motif par « / » (normalizeFileName) : un échappement par
  // barre oblique inverse ne correspondrait à rien. Une classe d'un seul caractère, si.
  it('escapes the route group (tabs) and keeps a line range valid', () => {
    const file = 'src/app/(tabs)/week.tsx';
    assert.equal(escapeGlob(file), 'src/app/[(]tabs[)]/week.tsx');
    assert.doesNotThrow(() => assertMatches(file, `${escapeGlob(file)}:3-8`));
  });

  it('escapes a dynamic route [id] and keeps a line range valid', () => {
    const file = 'src/adapters/ui/[id].tsx';
    assert.equal(escapeGlob(file), 'src/adapters/ui/[[]id[]].tsx');
    assert.doesNotThrow(() => assertMatches(file, `${escapeGlob(file)}:1-2`));
  });

  it('escapes catch-all routes, extglob-like names and wildcards', () => {
    for (const file of [
      'src/app/[...slug].tsx',
      'src/app/+not-found.tsx',
      'src/app/@(x).tsx',
      'src/app/!(x).tsx',
      'src/app/a*b?.tsx',
    ]) {
      assert.doesNotThrow(() => assertMatches(file, `${escapeGlob(file)}:1-2`), file);
    }
  });

  it('fails loudly on a pattern that matches nothing', () => {
    assert.throws(
      () => assertMatches('src/adapters/ui/[id].tsx', 'src/adapters/ui/\\[id\\].tsx'),
      /does not match/,
    );
  });

  it('fails loudly on a glob combined with a line range, which Stryker refuses', () => {
    assert.throws(
      () => assertMatches('src/adapters/ui/i.tsx', 'src/adapters/ui/[id].tsx:1-2'),
      /glob/,
    );
  });

  it('gives one entry per range, or the whole file', () => {
    const change = {
      file: 'src/app/(tabs)/week.tsx',
      added: false,
      ranges: [
        { start: 2, end: 4 },
        { start: 9, end: 9 },
      ],
      weight: 4,
    };
    assert.deepEqual(mutateEntries(change, { whole: false }), [
      'src/app/[(]tabs[)]/week.tsx:2-4',
      'src/app/[(]tabs[)]/week.tsx:9-9',
    ]);
    assert.deepEqual(mutateEntries(change, { whole: true }), ['src/app/[(]tabs[)]/week.tsx']);
  });
});

describe('split', () => {
  const items = [
    { file: 'e', weight: 1 },
    { file: 'a', weight: 5 },
    { file: 'b', weight: 4 },
    { file: 'c', weight: 3 },
    { file: 'd', weight: 3 },
  ];

  it('is greedy, balanced and deterministic', () => {
    const parts = split(items, 2).map((part) => part.map((item) => item.file));
    assert.deepEqual(parts, [
      ['a', 'd'],
      ['b', 'c', 'e'],
    ]);
    assert.deepEqual(split([...items].reverse(), 2), split(items, 2));
  });

  it('drops empty parts and never cuts a file', () => {
    assert.deepEqual(split([{ file: 'a', weight: 10 }], 10), [[{ file: 'a', weight: 10 }]]);
    assert.deepEqual(split([], 2), []);
  });
});

describe('buildPlan', () => {
  const change = (file, ranges, extra = {}) => ({
    file,
    added: false,
    ranges,
    weight: ranges.reduce((sum, { start, end }) => sum + end - start + 1, 0),
    ...extra,
  });

  it('mutates new lines outside the domain and whole domain files, screens on request', () => {
    const shards = buildPlan({
      mode: 'changed',
      ui: 'include',
      changes: [
        change('src/domain/habit/Habit.ts', [{ start: 4, end: 6 }]),
        change('src/application/checkIn.ts', [{ start: 10, end: 12 }]),
        change('src/adapters/device/clock/SystemClock.ts', [], { added: true, weight: 20 }),
        change('src/app/(tabs)/week.tsx', [{ start: 1, end: 30 }]),
        change('src/adapters/ui/HabitCard.tsx', [{ start: 3, end: 3 }]),
        change('src/adapters/ui/HabitCard.test.tsx', [{ start: 1, end: 50 }]),
        change('src/adapters/ui/Old.tsx', []),
      ],
    });
    assert.deepEqual(shards, [
      {
        id: 'domain',
        scope: 'domain',
        thresholdClass: 'domain',
        config: 'stryker.domain.config.mjs',
        mutate: ['src/domain/habit/Habit.ts'],
      },
      {
        id: 'core-1',
        scope: 'core',
        thresholdClass: 'newCode',
        config: 'stryker.config.mjs',
        mutate: ['src/adapters/device/clock/SystemClock.ts'],
      },
      {
        id: 'core-2',
        scope: 'core',
        thresholdClass: 'newCode',
        config: 'stryker.config.mjs',
        mutate: ['src/application/checkIn.ts:10-12'],
      },
      {
        id: 'ui-1',
        scope: 'ui',
        thresholdClass: 'newCode',
        config: 'stryker.ui.config.mjs',
        mutate: ['src/app/[(]tabs[)]/week.tsx:1-30'],
      },
      {
        id: 'ui-2',
        scope: 'ui',
        thresholdClass: 'newCode',
        config: 'stryker.ui.config.mjs',
        mutate: ['src/adapters/ui/HabitCard.tsx:3-3'],
      },
    ]);
    assert.deepEqual(toMatrix(shards), {
      shard: ['domain', 'core-1', 'core-2', 'ui-1', 'ui-2'],
    });
  });

  it('mutates whole files in full mode, with more parts', () => {
    const changes = Array.from({ length: 12 }, (_, index) =>
      change(`src/adapters/ui/C${index}.tsx`, [], { added: true, weight: 100 - index }),
    );
    const shards = buildPlan({ mode: 'full', ui: 'include', changes });
    assert.equal(shards.length, 10);
    assert.deepEqual(
      shards.map((shard) => shard.id),
      Array.from({ length: 10 }, (_, index) => `ui-${index + 1}`),
    );
    assert.ok(shards.every((shard) => shard.mutate.every((entry) => !entry.includes(':'))));
  });

  // Le shard `core` d'une PR prenait environ 25 minutes (docs/adr/0004-mutation-en-ci.md, révision
  // du 22 octobre 2026) : il est réparti comme les écrans.
  const coreFiles = (count) =>
    Array.from({ length: count }, (_, index) =>
      change(`src/application/useCases/u${index}.ts`, [], { added: true, weight: 50 - index }),
    );

  it('splits the core into 3 shards on a pull request', () => {
    const shards = buildPlan({ mode: 'changed', changes: coreFiles(8) });
    assert.deepEqual(
      shards.map(({ id, scope, thresholdClass, config }) => ({
        id,
        scope,
        thresholdClass,
        config,
      })),
      ['core-1', 'core-2', 'core-3'].map((id) => ({
        id,
        scope: 'core',
        thresholdClass: 'newCode',
        config: 'stryker.config.mjs',
      })),
    );
    assert.equal(shards.flatMap((shard) => shard.mutate).length, 8);
  });

  it('splits the core into 6 shards in full mode', () => {
    const shards = buildPlan({ mode: 'full', changes: coreFiles(12) });
    assert.deepEqual(
      shards.map((shard) => shard.id),
      Array.from({ length: 6 }, (_, index) => `core-${index + 1}`),
    );
    assert.ok(shards.every((shard) => shard.thresholdClass === 'newCode'));
  });

  it('keeps a single core shard when only one core file changed', () => {
    const shards = buildPlan({ mode: 'changed', changes: coreFiles(1) });
    assert.deepEqual(
      shards.map((shard) => shard.id),
      ['core'],
    );
  });

  it('gives an empty plan when nothing mutable changed', () => {
    const shards = buildPlan({
      mode: 'changed',
      changes: [change('src/adapters/ui/HabitCard.test.tsx', [{ start: 1, end: 2 }])],
    });
    assert.deepEqual(shards, []);
    assert.deepEqual(toMatrix(shards), { shard: [] });
  });

  it('rejects an unknown mode', () => {
    assert.throws(() => buildPlan({ mode: 'partial', changes: [] }), /Unknown mutation mode/);
  });

  // Décision du propriétaire (issue #54) : les écrans ne sont mutés qu'à sa demande.
  const prChanges = [
    change('src/domain/habit/Habit.ts', [{ start: 4, end: 6 }]),
    change('src/application/checkIn.ts', [{ start: 10, end: 12 }]),
    change('src/app/(tabs)/week.tsx', [{ start: 1, end: 30 }]),
    change('src/adapters/ui/HabitCard.tsx', [{ start: 3, end: 3 }]),
    change('src/adapters/ui/Old.tsx', []),
  ];

  it('does not mutate the screens by default', () => {
    for (const mode of ['changed', 'full']) {
      const shards = buildPlan({ mode, changes: prChanges });
      assert.deepEqual(
        shards.map((shard) => shard.id),
        ['domain', 'core'],
      );
      assert.equal(shards.find((shard) => shard.scope === 'domain').thresholdClass, 'domain');
      assert.ok(shards.every((shard) => shard.scope !== 'ui'));
    }
    assert.deepEqual(
      buildPlan({ mode: 'changed', ui: 'exclude', changes: prChanges }),
      buildPlan({ mode: 'changed', changes: prChanges }),
    );
  });

  it('mutates the domain with or without the screens', () => {
    for (const ui of ['exclude', 'include']) {
      const [domain] = buildPlan({ mode: 'changed', ui, changes: prChanges });
      assert.deepEqual(domain, {
        id: 'domain',
        scope: 'domain',
        thresholdClass: 'domain',
        config: 'stryker.domain.config.mjs',
        mutate: ['src/domain/habit/Habit.ts'],
      });
    }
  });

  it('mutates only the screens on request, with the threshold of the new code', () => {
    const shards = buildPlan({ mode: 'changed', ui: 'only', changes: prChanges });
    assert.deepEqual(
      shards.map(({ id, scope, thresholdClass, config }) => ({
        id,
        scope,
        thresholdClass,
        config,
      })),
      [
        { id: 'ui-1', scope: 'ui', thresholdClass: 'newCode', config: 'stryker.ui.config.mjs' },
        { id: 'ui-2', scope: 'ui', thresholdClass: 'newCode', config: 'stryker.ui.config.mjs' },
      ],
    );
  });

  it('rejects an unknown screen option', () => {
    assert.throws(
      () => buildPlan({ mode: 'changed', ui: 'yes', changes: [] }),
      /Unknown screen mutation option/,
    );
  });
});

describe('screenFiles and uiNotice', () => {
  const changes = [
    { file: 'src/domain/habit/Habit.ts', added: false, ranges: [{ start: 1, end: 1 }], weight: 1 },
    { file: 'src/app/(tabs)/week.tsx', added: false, ranges: [{ start: 1, end: 2 }], weight: 2 },
    { file: 'src/adapters/ui/Old.tsx', added: false, ranges: [], weight: 0 },
    { file: 'src/adapters/ui/New.tsx', added: true, ranges: [], weight: 9 },
    { file: 'src/adapters/ui/New.test.tsx', added: true, ranges: [], weight: 9 },
  ];

  it('lists the screen files that have code to mutate', () => {
    assert.deepEqual(screenFiles(changes), ['src/adapters/ui/New.tsx', 'src/app/(tabs)/week.tsx']);
  });

  it('says clearly when the screen mutation was not requested, and how to request it', () => {
    const notice = uiNotice({ ui: 'exclude', screens: 2 });
    assert.match(notice, /Screen mutation .* not requested/);
    assert.match(notice, /2 changed screen file\(s\) not mutated/);
    assert.match(notice, /`mutation:ui`/);
    assert.match(notice, /`ui-mutation`/);
    assert.match(notice, /`npm run mutation:ui`/);
  });

  it('says when the screen mutation was requested', () => {
    assert.match(uiNotice({ ui: 'include', screens: 2 }), /Screen mutation .* requested/);
    assert.doesNotMatch(uiNotice({ ui: 'include', screens: 2 }), /not requested/);
    assert.match(uiNotice({ ui: 'only', screens: 0 }), /only the screens/);
  });
});
