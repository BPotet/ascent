import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Instrumenter } from '@stryker-mutator/instrumenter';
import {
  assertMatches,
  buildPlan,
  CHUNK_LINES,
  CHUNK_MUTANTS,
  chunkAtStatements,
  classify,
  escapeGlob,
  isRetained,
  mutantLines,
  mutateEntries,
  outline,
  parseDiff,
  PARTS,
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

// Issue #131 : un gros fichier du domaine est coupé en plages de lignes, entre deux instructions
// de premier niveau seulement (avenant du 29 octobre 2026 à l'ADR 0004).
describe('chunkAtStatements', () => {
  const ranges = (...pairs) => pairs.map(([start, end]) => ({ start, end }));

  /** Vrai si les plages couvrent les lignes 1 à `lineCount`, sans trou ni recouvrement. */
  function assertCovers(chunks, lineCount) {
    assert.equal(chunks[0].start, 1);
    assert.equal(chunks.at(-1).end, lineCount);
    for (let index = 1; index < chunks.length; index += 1) {
      assert.equal(chunks[index].start, chunks[index - 1].end + 1);
    }
  }

  it('keeps a small file whole', () => {
    const file = { lineCount: 40, statements: ranges([1, 10], [12, 39]) };
    assert.deepEqual(chunkAtStatements(file, 50), ranges([1, 40]));
  });

  it('covers every line, contiguously, cutting only between statements', () => {
    const statements = ranges([1, 3], [5, 20], [22, 40], [42, 60], [62, 75], [77, 90]);
    const chunks = chunkAtStatements({ lineCount: 92, statements }, 30);
    assertCovers(chunks, 92);
    assert.ok(chunks.length > 1);
    for (const { start, end } of chunks) {
      assert.ok(end - start + 1 <= 30, `${start}-${end} is longer than 30 lines`);
      assert.ok(
        statements.every(
          (s) => s.end < start || s.start > end || (s.start >= start && s.end <= end),
        ),
        `${start}-${end} cuts a statement`,
      );
    }
  });

  it('attaches comments and blank lines between statements to a range', () => {
    // Lignes 11 à 14 : commentaire et lignes vides entre les deux instructions.
    const chunks = chunkAtStatements({ lineCount: 30, statements: ranges([1, 10], [15, 30]) }, 12);
    assert.deepEqual(chunks, ranges([1, 10], [11, 30]));
  });

  it('keeps a statement longer than the limit whole', () => {
    const chunks = chunkAtStatements(
      { lineCount: 120, statements: ranges([1, 5], [7, 100], [102, 120]) },
      20,
    );
    assert.deepEqual(chunks, ranges([1, 5], [6, 100], [101, 120]));
  });

  it('never cuts between two statements that share a line', () => {
    const chunks = chunkAtStatements({ lineCount: 30, statements: ranges([1, 10], [10, 30]) }, 12);
    assert.deepEqual(chunks, ranges([1, 30]));
  });

  it('keeps a range exactly at the limit whole', () => {
    const chunks = chunkAtStatements({ lineCount: 20, statements: ranges([1, 9], [10, 20]) }, 20);
    assert.deepEqual(chunks, ranges([1, 20]));
  });

  // Issue #134 : `BattleSession.ts` est presque entièrement une seule classe.
  const withMembers = (start, end, ...members) => ({ start, end, members: ranges(...members) });

  it('cuts a class longer than the limit between its members', () => {
    const statements = [
      { start: 1, end: 2 },
      withMembers(4, 60, [5, 6], [8, 25], [27, 44], [46, 59]),
    ];
    const chunks = chunkAtStatements({ lineCount: 61, statements }, 25);
    assert.deepEqual(chunks, ranges([1, 25], [26, 44], [45, 61]));
  });

  it('keeps a class within the limit whole, members or not', () => {
    const statements = [{ start: 1, end: 10 }, withMembers(12, 30, [13, 14], [16, 20], [22, 29])];
    const chunks = chunkAtStatements({ lineCount: 30, statements }, 20);
    assert.deepEqual(chunks, ranges([1, 10], [11, 30]));
  });

  it('keeps a class without members whole', () => {
    const chunks = chunkAtStatements({ lineCount: 50, statements: [withMembers(1, 50)] }, 10);
    assert.deepEqual(chunks, ranges([1, 50]));
  });

  it('measures the ranges with the given size, the number of mutants for the core', () => {
    // Un mutant par ligne de 1 à 10, aucun ensuite : la limite de 6 coupe après 6 lignes, puis
    // garde les lignes 7 à 40 ensemble (4 mutants seulement).
    const statements = Array.from({ length: 20 }, (_, index) => ({
      start: index * 2 + 1,
      end: index * 2 + 2,
    }));
    const mutants = Array.from({ length: 10 }, (_, index) => ({
      start: index + 1,
      end: index + 1,
    }));
    const size = ({ start, end }) => mutants.filter((m) => m.start >= start && m.end <= end).length;
    const chunks = chunkAtStatements({ lineCount: 40, statements }, 6, size);
    assert.deepEqual(chunks, ranges([1, 6], [7, 40]));
  });
});

describe('outline', () => {
  it('reads the line ranges of the top-level statements with the TypeScript compiler', () => {
    const source = [
      "import { a } from './a';", // 1
      '', // 2
      '/** A doc comment. */', // 3
      'export function f(x: number): number {', // 4
      '  return x + a;', // 5
      '}', // 6
      'const o = {', // 7
      '  k: 1,', // 8
      '}; export const p = 2;', // 9
      '', // 10
    ].join('\n');
    assert.deepEqual(outline(source, 'x.ts'), {
      lineCount: 10,
      statements: [
        { start: 1, end: 1 },
        { start: 4, end: 6 },
        { start: 7, end: 9 },
        { start: 9, end: 9 },
      ],
    });
  });

  it('reads the members of a class declaration', () => {
    const source = [
      'export class A {', // 1
      '  private x = 1;', // 2
      '', // 3
      '  /** A method. */', // 4
      '  m(): number {', // 5
      '    return this.x;', // 6
      '  }', // 7
      '}', // 8
    ].join('\n');
    assert.deepEqual(outline(source, 'a.ts').statements, [
      {
        start: 1,
        end: 8,
        members: [
          { start: 2, end: 2 },
          { start: 5, end: 7 },
        ],
      },
    ]);
  });
});

describe('mutantLines', () => {
  it('gives the line ranges of the mutants of each file, as the instrumenter of Stryker', async () => {
    const byFile = await mutantLines([
      { name: 'src/a.ts', content: 'export const f = (x: number) =>\n  x > 1;\n' },
      { name: 'src/types.ts', content: 'export type T = { a: number };\n' },
    ]);
    assert.deepEqual(byFile.get('src/types.ts'), []);
    const mutants = byFile.get('src/a.ts');
    assert.ok(mutants.length >= 3, `expected several mutants, got ${mutants.length}`);
    assert.ok(mutants.some(({ start, end }) => start === 2 && end === 2));
    assert.ok(mutants.every(({ start, end }) => start >= 1 && end <= 2 && start <= end));
  });
});

// Test de non-régression de l'issue #131 : Stryker ne garde un mutant que si son nœud est
// entièrement dans une plage (`locationIncluded`). Les mutants du fichier entier doivent être
// exactement la réunion des mutants des plages du plan : aucun perdu, aucun compté deux fois.
describe('no mutant lost when a domain file is cut', () => {
  const SAMPLE = `import { clamp } from './clamp';

/** Les points gagnés pour une série. */
export function streakPoints(days: number, bonus: boolean): number {
  if (days <= 0) {
    return 0;
  }
  const base = days * 10 + (bonus ? 5 : 0);
  return clamp(base, 0, 100);
}

export const LEVELS = {
  novice: { min: 0, label: 'Novice' },
  adept: { min: 100, label: 'Adept' },
  master: { min: 500, label: 'Master' },
};

// Un bloc sur plusieurs lignes, avec des boucles et des conditions imbriquées.
export function levelOf(xp: number): string {
  let found = 'novice';
  for (const [name, level] of Object.entries(LEVELS)) {
    if (xp >= level.min && name !== '') {
      found = name;
    }
  }
  while (found.length > 20) {
    found = found.slice(1);
  }
  return found;
}

export const isMaster = (xp: number): boolean => levelOf(xp) === 'master' || xp > 1000;

export class Counter {
  private count = 0;

  increment(by = 1): number {
    this.count += by;
    return this.count;
  }
}
`;
  const silent = { debug() {}, info() {}, warn() {}, error() {}, isDebugEnabled: () => false };

  /** Les plages d'une entrée `fichier:début-fin`, lues comme Stryker (`project-reader.js`). */
  const strykerRange = ({ start, end }) => ({
    start: { line: start - 1, column: 0 },
    end: { line: end - 1, column: Number.MAX_SAFE_INTEGER },
  });

  async function mutants(mutate, content = SAMPLE) {
    const instrumenter = new Instrumenter(silent);
    const result = await instrumenter.instrument([{ name: 'sample.ts', content, mutate }], {
      plugins: null,
      excludedMutations: [],
      ignorers: [],
    });
    return result.mutants.map(
      ({ mutatorName, replacement, location: { start, end } }) =>
        `${start.line}:${start.column}-${end.line}:${end.column} ${mutatorName} ${replacement}`,
    );
  }

  it('finds exactly the mutants of the whole file in the ranges of the plan', async () => {
    const chunks = chunkAtStatements(outline(SAMPLE, 'sample.ts'), 8);
    assert.ok(chunks.length >= 4, `expected several ranges, got ${chunks.length}`);
    const whole = await mutants(true);
    const perRange = [];
    for (const chunk of chunks) perRange.push(...(await mutants([strykerRange(chunk)])));
    assert.ok(whole.length > 30, `expected a meaningful sample, got ${whole.length} mutants`);
    assert.deepEqual([...perRange].sort(), [...whole].sort());
  });

  // Issue #134 : une classe plus longue que la limite est coupée entre deux de ses membres.
  const CLASS_SAMPLE = `import { clamp } from './clamp';

type Listener = (value: number) => void;

/** Une session : propriétés, constructeur, accesseurs, méthodes et fonctions fléchées. */
export class Session {
  private value = 0;
  private readonly listeners = new Set<Listener>();
  static readonly LIMIT = 100;
  #ticks = [1, 2, 3];

  constructor(
    private readonly step: number,
    private readonly label = 'session',
  ) {
    if (step <= 0) {
      throw new Error('A positive step is expected.');
    }
  }

  get current(): number {
    return this.value;
  }

  set current(value: number) {
    this.value = clamp(value, 0, Session.LIMIT);
  }

  /** Avance d'un pas, et prévient les abonnés. */
  advance(times = 1): number {
    for (let index = 0; index < times; index += 1) {
      this.value = Math.min(this.value + this.step, Session.LIMIT);
    }
    this.listeners.forEach((listener) => listener(this.value));
    return this.value;
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  describe(): string {
    return this.value > 50 && this.label !== '' ? \`\${this.label}: high\` : 'low';
  }

  private static isEven(value: number): boolean {
    return value % 2 === 0 || value === -0;
  }
}

export const done = (session: Session): boolean => session.current >= Session.LIMIT;
`;

  it('finds exactly the mutants of the whole file when a class is cut between its members', async () => {
    const file = outline(CLASS_SAMPLE, 'sample.ts');
    const session = file.statements.find((statement) => statement.members);
    const chunks = chunkAtStatements(file, 12);
    const inside = chunks.filter(({ start }) => start > session.start && start <= session.end);
    assert.ok(inside.length >= 3, `expected cuts inside the class, got ${inside.length}`);
    const whole = await mutants(true, CLASS_SAMPLE);
    const perRange = [];
    for (const chunk of chunks) {
      perRange.push(...(await mutants([strykerRange(chunk)], CLASS_SAMPLE)));
    }
    assert.ok(whole.length > 30, `expected a meaningful sample, got ${whole.length} mutants`);
    assert.deepEqual([...perRange].sort(), [...whole].sort());
  });

  it('would lose mutants with a cut inside a statement', async () => {
    // Témoin : couper `levelOf` en son milieu perd les mutants qui traversent la coupe.
    const whole = await mutants(true);
    const cut = [
      ...(await mutants([strykerRange({ start: 1, end: 24 })])),
      ...(await mutants([strykerRange({ start: 25, end: 44 })])),
    ];
    assert.ok(cut.length < whole.length);
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

  // Issue #134 : à 17 à 39 s par mutant, 6 parts ne tenaient pas dans le délai de 120 minutes.
  it('splits the core into 10 shards in full mode', () => {
    const shards = buildPlan({ mode: 'full', changes: coreFiles(12) });
    assert.equal(PARTS.full.core, 10);
    assert.deepEqual(
      shards.map((shard) => shard.id),
      Array.from({ length: 10 }, (_, index) => `core-${index + 1}`),
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

  // Issue #131 : `Battle.ts` (1 512 lignes, 1 226 mutants) dépassait le délai d'un shard.
  const bigDomainFile = (file = 'src/domain/battle/Battle.ts', lineCount = 1512) => ({
    file,
    added: false,
    ranges: [{ start: 40, end: 45 }],
    weight: 6,
    lineCount,
    // Une instruction de premier niveau de 9 lignes toutes les 10 lignes.
    statements: Array.from({ length: Math.floor(lineCount / 10) }, (_, index) => ({
      start: index * 10 + 1,
      end: index * 10 + 9,
    })),
  });

  it('cuts a large domain file into ranges spread over several domain shards', () => {
    const shards = buildPlan({ mode: 'changed', changes: [bigDomainFile()] });
    assert.ok(shards.length > 1);
    assert.ok(shards.length <= PARTS.changed.domain);
    assert.deepEqual(
      shards.map((shard) => shard.id),
      shards.map((_, index) => `domain-${index + 1}`),
    );
    for (const shard of shards) {
      assert.equal(shard.scope, 'domain');
      assert.equal(shard.thresholdClass, 'domain');
      assert.equal(shard.config, 'stryker.domain.config.mjs');
    }
    const chunks = shards
      .flatMap((shard) => shard.mutate)
      .map((entry) => {
        const match = /^src\/domain\/battle\/Battle\.ts:(\d+)-(\d+)$/.exec(entry);
        assert.ok(match, entry);
        return { start: Number(match[1]), end: Number(match[2]) };
      })
      .sort((a, b) => a.start - b.start);
    assert.equal(chunks[0].start, 1);
    assert.equal(chunks.at(-1).end, 1512);
    for (let index = 1; index < chunks.length; index += 1) {
      assert.equal(chunks[index].start, chunks[index - 1].end + 1);
    }
    assert.ok(chunks.every(({ start, end }) => end - start + 1 <= CHUNK_LINES.domain));
  });

  it('cuts the domain into more shards in full mode', () => {
    const changes = [
      { ...bigDomainFile(), added: true, ranges: [], weight: 1512 },
      { ...bigDomainFile('src/domain/hero/Hero.ts', 900), added: true, ranges: [], weight: 900 },
    ];
    const shards = buildPlan({ mode: 'full', changes });
    assert.equal(shards.length, PARTS.full.domain);
    assert.ok(PARTS.full.domain > PARTS.changed.domain);
  });

  it('weighs a domain file by its mutated lines, not only by its added lines', () => {
    const small = (file, lineCount, added) => ({
      file,
      added: false,
      ranges: [{ start: 1, end: added }],
      weight: added,
      lineCount,
      statements: [{ start: 1, end: lineCount }],
    });
    const shards = buildPlan({
      mode: 'changed',
      changes: [
        small('src/domain/a/A.ts', 200, 1),
        small('src/domain/b/B.ts', 10, 9),
        small('src/domain/c/C.ts', 10, 8),
      ],
    });
    // Pondérés par leurs lignes ajoutées, B et C passeraient avant A : A, le plus long à muter,
    // doit être seul dans sa part.
    assert.deepEqual(shards[0].mutate, ['src/domain/a/A.ts']);
  });

  // Issue #134 : en release, un élément `core` pèse son nombre de mutants, et un fichier `core`
  // de plus de `CHUNK_MUTANTS.core` mutants est coupé en plages.
  const fullCoreFile = (file, lineCount, mutantCount) => ({
    file,
    added: true,
    ranges: [],
    weight: lineCount,
    lineCount,
    // Une instruction de premier niveau de 9 lignes toutes les 10 lignes.
    statements: Array.from({ length: Math.floor(lineCount / 10) }, (_, index) => ({
      start: index * 10 + 1,
      end: index * 10 + 9,
    })),
    // Des mutants d'une ligne, répartis sur les instructions.
    mutants: Array.from({ length: mutantCount }, (_, index) => {
      const line = (index % Math.floor(lineCount / 10)) * 10 + 1 + (index % 9);
      return { start: line, end: line };
    }),
  });

  it('weighs a core file by its mutants in full mode', () => {
    const shards = buildPlan({
      mode: 'full',
      changes: [
        fullCoreFile('src/application/a.ts', 300, 10),
        fullCoreFile('src/application/b.ts', 80, 90),
        fullCoreFile('src/application/c.ts', 100, 50),
        fullCoreFile('src/application/d.ts', 100, 45),
      ],
    });
    // Les parts suivent le poids décroissant. Pondérés par leurs lignes, A viendrait en premier.
    assert.deepEqual(
      shards.map((shard) => shard.mutate),
      [
        ['src/application/b.ts'],
        ['src/application/c.ts'],
        ['src/application/d.ts'],
        ['src/application/a.ts'],
      ],
    );
  });

  it('cuts a core file with many mutants into ranges in full mode, each under the limit', () => {
    const big = fullCoreFile('src/application/useCases/big.ts', 600, 3 * CHUNK_MUTANTS.core);
    const shards = buildPlan({ mode: 'full', changes: [big] });
    const chunks = shards
      .flatMap((shard) => shard.mutate)
      .map((entry) => {
        const match = /^src\/application\/useCases\/big\.ts:(\d+)-(\d+)$/.exec(entry);
        assert.ok(match, entry);
        return { start: Number(match[1]), end: Number(match[2]) };
      })
      .sort((a, b) => a.start - b.start);
    assert.ok(shards.length >= 3, `expected several shards, got ${shards.length}`);
    assert.equal(chunks[0].start, 1);
    assert.equal(chunks.at(-1).end, 600);
    let total = 0;
    for (const [index, { start, end }] of chunks.entries()) {
      if (index > 0) assert.equal(start, chunks[index - 1].end + 1);
      const count = big.mutants.filter((m) => m.start >= start && m.end <= end).length;
      assert.ok(count <= CHUNK_MUTANTS.core, `${start}-${end}: ${count} mutants`);
      total += count;
    }
    assert.equal(total, big.mutants.length);
  });

  it('never cuts a core file on a pull request', () => {
    const core = {
      ...fullCoreFile('src/application/useCases/big.ts', 600, 3 * CHUNK_MUTANTS.core),
      added: false,
      ranges: [{ start: 1, end: 600 }],
    };
    const shards = buildPlan({ mode: 'changed', changes: [core] });
    assert.deepEqual(
      shards.map((shard) => shard.mutate),
      [['src/application/useCases/big.ts:1-600']],
    );
  });

  it('keeps a single domain shard for a small domain change', () => {
    const shards = buildPlan({
      mode: 'changed',
      changes: [{ ...bigDomainFile('src/domain/habit/Habit.ts', 120) }],
    });
    assert.deepEqual(
      shards.map(({ id, mutate }) => ({ id, mutate })),
      [{ id: 'domain', mutate: ['src/domain/habit/Habit.ts'] }],
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
