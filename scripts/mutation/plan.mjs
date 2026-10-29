// Plan de la mutation en CI (docs/adr/0004-mutation-en-ci.md) : quels fichiers, quelles lignes, dans
// quel shard. Fonctions pures ; les seuls effets de bord (appels à git, lecture des fichiers, de
// leurs instructions avec le compilateur TypeScript et de leurs mutants avec l'instrumenter de
// Stryker) sont regroupés dans `collectChanges()`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Instrumenter } from '@stryker-mutator/instrumenter';
import { Minimatch, minimatch } from 'minimatch';
import ts from 'typescript';
import baseConfig from '../../stryker.config.mjs';
import domainConfig from '../../stryker.domain.config.mjs';
import uiConfig from '../../stryker.ui.config.mjs';

export const BASE_CONFIG = 'stryker.config.mjs';
export const DOMAIN_CONFIG = 'stryker.domain.config.mjs';
export const UI_CONFIG = 'stryker.ui.config.mjs';
const CONFIGS = { domain: DOMAIN_CONFIG, core: BASE_CONFIG, ui: UI_CONFIG };

// Réglages de la répartition, pas des seuils : nombre de parts (shards) par groupe et par mode.
// `core` (révision du 22 octobre 2026 de l'ADR 0004) : un coût fixe d'environ 5 minutes par shard
// (installation et « dry run » de toute la suite Jest). 3 parts en PR ramènent les ~25 minutes d'un
// seul shard à environ 10 ; au-delà, le coût fixe domine. En release (avenant du 29 octobre 2026,
// issue #134), 17 à 39 s par mutant mesurés (run 40804197216 : la config `core` exécute les trois
// projets Jest, et chaque timeout redémarre un processus de test), pour 1 253 mutants : 6 parts
// dépassaient le délai de 120 minutes. 10 parts d'environ 125 mutants, pesés par leur nombre de
// mutants (voir `CHUNK_MUTANTS`), soit environ 55 minutes, 80 au pire rythme mesuré.
// `domain` (avenant du 29 octobre 2026, issue #131) : un fichier du domaine modifié est muté en
// entier ; au-delà de `CHUNK_LINES.domain` lignes, il est coupé en plages (voir
// `chunkAtStatements()`) réparties entre les parts. `Battle.ts` (environ 1 500 lignes) prenait
// environ 3 h dans un seul shard.
export const PARTS = {
  changed: { domain: 6, core: 3, ui: 2 },
  full: { domain: 8, core: 10, ui: 10 },
};
export const CHUNK_LINES = { domain: 250 };
// En release, un fichier `core` de plus de `CHUNK_MUTANTS.core` mutants est coupé en plages (issue
// #134 : `BattleSession.ts`, 213 mutants, presque entièrement une seule classe).
export const CHUNK_MUTANTS = { core: 100 };

const SCOPES = ['domain', 'core', 'ui'];

// Mutation des écrans (issue #54) : seulement à la demande du propriétaire.
//   exclude (par défaut) : tout sauf les écrans ; include : tout ; only : les écrans seuls.
export const UI_OPTIONS = {
  exclude: ['domain', 'core'],
  include: ['domain', 'core', 'ui'],
  only: ['ui'],
};

/**
 * Vrai si `file` est retenu par une liste `mutate` de Stryker, lue dans l'ordre : un motif positif
 * ajoute, un motif `!` retire.
 */
export function isRetained(file, patterns) {
  let retained = false;
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      if (retained && minimatch(file, pattern.slice(1))) retained = false;
    } else if (!retained && minimatch(file, pattern)) {
      retained = true;
    }
  }
  return retained;
}

/**
 * Groupe d'un fichier de `src/` (`domain`, `core` ou `ui`), ou `null` s'il n'est pas muté. Les
 * listes `mutate` des configs Stryker sont la source de vérité.
 */
export function classify(
  file,
  {
    domainPatterns = domainConfig.mutate,
    basePatterns = baseConfig.mutate,
    uiPatterns = uiConfig.mutate,
  } = {},
) {
  if (isRetained(file, domainPatterns)) return 'domain';
  if (isRetained(file, uiPatterns)) return 'ui';
  return isRetained(file, basePatterns) ? 'core' : null;
}

/** Les fichiers d'écran qui ont du code à muter (lignes nouvelles, ou fichier ajouté). */
export function screenFiles(changes, scopeOf = classify) {
  return changes
    .filter((change) => scopeOf(change.file) === 'ui' && (change.added || change.ranges.length > 0))
    .map((change) => change.file)
    .sort();
}

const SCREENS = '`src/adapters/ui/`, `src/app/`';

/** La ligne du résumé CI qui dit si la mutation des écrans a été demandée. */
export function uiNotice({ ui, screens }) {
  if (ui === 'only') {
    return `Screen mutation (${SCREENS}) requested: only the screens are mutated, with the usual thresholds.`;
  }
  if (ui === 'include') {
    return `Screen mutation (${SCREENS}) requested: the screens are mutated too, with the usual thresholds.`;
  }
  return (
    `Screen mutation (${SCREENS}) not requested: ${screens} changed screen file(s) not mutated. ` +
    'To request it: add the `mutation:ui` label to the pull request, run the CI manually with ' +
    '`ui-mutation`, or run `npm run mutation:ui` locally.'
  );
}

/**
 * Lit la sortie de `git diff -U0 -M` : pour chaque fichier, les plages de lignes ajoutées ou
 * modifiées (côté HEAD), s'il est nouveau, et son poids (nombre de lignes ajoutées).
 */
export function parseDiff(text) {
  const changes = [];
  let current = null;
  let inHeader = false;
  let fromDevNull = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = null;
      inHeader = true;
      fromDevNull = false;
    } else if (line.startsWith('@@')) {
      // Les lignes de contenu commencent par « + », « - », « \ » ou une espace : « @@ » en tête de
      // ligne est toujours un en-tête de plage.
      inHeader = false;
      if (!current) continue;
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!match) throw new Error(`Unreadable diff hunk header: ${line}`);
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      if (count === 0) continue; // suppression pure : rien de nouveau à muter
      current.ranges.push({ start, end: start + count - 1 });
      current.weight += count;
    } else if (inHeader && line.startsWith('--- ')) {
      fromDevNull = line === '--- /dev/null';
    } else if (inHeader && line.startsWith('+++ ')) {
      if (line.startsWith('+++ "')) throw new Error(`Quoted path not supported: ${line}`);
      current =
        line === '+++ /dev/null'
          ? null
          : { file: line.slice(4).replace(/^b\//, ''), added: fromDevNull, ranges: [], weight: 0 };
      if (current) changes.push(current);
    }
  }
  return changes;
}

/**
 * Échappe un chemin pour qu'il ne désigne que lui-même dans un motif `mutate` de Stryker.
 * Stryker remplace chaque « \ » d'un motif par « / » (`normalizeFileName`) : l'échappement par
 * barre oblique inverse est donc impossible. Chaque caractère spécial est mis dans une classe d'un
 * seul caractère (`[(]`), que minimatch lit comme un littéral, sans glob : une plage reste permise.
 * `! + @` ne sont spéciaux que devant `(`, déjà échappé ; `{ }` ne peuvent pas l'être ainsi, et
 * `assertMatches()` refuse un chemin qui en dépendrait.
 */
export function escapeGlob(file) {
  return file.replace(/[*?[\]()]/g, '[$&]');
}

const RANGE = /:\d+-\d+$/;
const strykerPath = (file) => path.resolve(file).replace(/\\/g, '/');

/**
 * Vérifie, comme Stryker, que l'entrée `mutate` désigne bien le fichier `file` : même comparaison
 * (`minimatch` sur les chemins absolus normalisés), et pas de glob avec une plage (refusé par
 * Stryker). Sinon, lève une erreur au lieu de fausser la mesure en silence.
 */
export function assertMatches(file, pattern) {
  const glob = pattern.replace(RANGE, '');
  if (RANGE.test(pattern) && new Minimatch(pattern).hasMagic()) {
    throw new Error(
      `Mutate pattern "${pattern}" combines a glob with a line range: Stryker refuses it.`,
    );
  }
  if (!minimatch(strykerPath(file), strykerPath(glob))) {
    throw new Error(
      `Mutate pattern "${pattern}" does not match "${file}": it would mutate nothing.`,
    );
  }
}

/** Les entrées `mutate` d'un fichier : le fichier entier, ou une entrée par plage de lignes. */
export function mutateEntries(change, { whole }) {
  const escaped = escapeGlob(change.file);
  const entries =
    whole || change.added
      ? [escaped]
      : change.ranges.map(({ start, end }) => `${escaped}:${start}-${end}`);
  for (const entry of entries) assertMatches(change.file, entry);
  return entries;
}

const lineSpan = ({ start, end }) => end - start + 1;

/**
 * Les unités d'une instruction entre lesquelles on peut couper : l'instruction entière, ou, pour une
 * classe plus grande que `max`, ses membres (l'en-tête de la classe va au premier, son accolade
 * fermante au dernier). Aucun mutant ne traverse deux membres d'une classe.
 */
function cuttableUnits(statement, max, size) {
  const { start, end, members = [] } = statement;
  if (members.length === 0 || size({ start, end }) <= max) return [{ start, end }];
  return members.map((member, index) => ({
    start: index === 0 ? start : member.start,
    end: index === members.length - 1 ? end : member.end,
  }));
}

/**
 * Les plages de lignes d'un fichier `{ lineCount, statements }` (voir `outline()`) : contiguës, de
 * la ligne 1 à `lineCount`, d'au plus `max` (mesuré par `size`, en lignes par défaut), coupées
 * seulement entre deux instructions de premier niveau, ou entre deux membres d'une classe plus
 * grande que `max`. Stryker ne mute un nœud que s'il est entièrement dans une plage : une coupe
 * dans une instruction perdrait ses mutants en silence. Une unité plus grande que `max` reste
 * entière ; les commentaires et lignes vides entre deux unités vont à la suivante.
 */
export function chunkAtStatements({ lineCount, statements }, max, size = lineSpan) {
  // Des unités qui partagent une ligne ne peuvent pas être séparées par une plage de lignes.
  const units = [];
  const sorted = [...statements].sort((a, b) => a.start - b.start);
  for (const { start, end } of sorted.flatMap((s) => cuttableUnits(s, max, size))) {
    const last = units.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else units.push({ start, end });
  }
  const chunks = [];
  let start = 1;
  for (let index = 1; index < units.length; index += 1) {
    // Les lignes après la dernière instruction vont à la dernière plage.
    const end = index === units.length - 1 ? lineCount : units[index].end;
    if (size({ start, end }) > max) {
      const cut = units[index - 1].end + 1;
      chunks.push({ start, end: cut - 1 });
      start = cut;
    }
  }
  chunks.push({ start, end: lineCount });
  return chunks;
}

/**
 * Le nombre de lignes d'un fichier et les plages de lignes (de 1) de ses instructions de premier
 * niveau, avec, pour une classe, celles de ses membres (`members`), lues avec le compilateur
 * TypeScript, sans les commentaires qui les précèdent.
 */
export function outline(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const line = (position) => file.getLineAndCharacterOfPosition(position).line + 1;
  const span = (node) => ({ start: line(node.getStart(file)), end: line(node.getEnd()) });
  return {
    lineCount: line(file.getEnd()),
    statements: file.statements.map((statement) =>
      ts.isClassDeclaration(statement)
        ? { ...span(statement), members: statement.members.map(span) }
        : span(statement),
    ),
  };
}

/** Le nombre de mutants `{ start, end }` entièrement dans une plage de lignes. */
const mutantsIn =
  (mutants) =>
  ({ start, end }) =>
    mutants.filter((mutant) => mutant.start >= start && mutant.end <= end).length;

/**
 * Les éléments à répartir pour un fichier muté en entier : le fichier, ou une plage par élément
 * s'il dépasse `max`, mesuré par `size`. Le poids d'un élément est sa mesure. Sans `statements`
 * (rien de lu par `outline()`), le fichier n'est pas coupé.
 */
function wholeFileItems(change, max, size) {
  const lineCount = change.lineCount ?? change.weight;
  const chunks = change.statements
    ? chunkAtStatements({ lineCount, statements: change.statements }, max, size)
    : [{ start: 1, end: lineCount }];
  if (chunks.length === 1) {
    return [
      {
        file: change.file,
        weight: size(chunks[0]),
        mutate: mutateEntries(change, { whole: true }),
      },
    ];
  }
  return chunks.map((range) => ({
    file: change.file,
    weight: size(range),
    mutate: mutateEntries({ ...change, added: false, ranges: [range] }, { whole: false }),
  }));
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Répartit des éléments pondérés en `parts` parts, sans couper un élément : gloutonne et
 * déterministe (poids décroissant, chemin puis entrées ; la part la plus légère, puis d'indice le
 * plus bas). Les parts vides sont supprimées.
 */
export function split(items, parts) {
  const sorted = [...items].sort(
    (a, b) =>
      b.weight - a.weight ||
      compare(a.file, b.file) ||
      compare(String(a.mutate ?? ''), String(b.mutate ?? '')),
  );
  const buckets = Array.from({ length: Math.max(1, parts) }, () => ({ weight: 0, items: [] }));
  for (const item of sorted) {
    let lightest = buckets[0];
    for (const bucket of buckets) if (bucket.weight < lightest.weight) lightest = bucket;
    lightest.items.push(item);
    lightest.weight += item.weight;
  }
  return buckets.filter((bucket) => bucket.items.length > 0).map((bucket) => bucket.items);
}

/**
 * Le plan : une liste de shards `{ id, scope, thresholdClass, config, mutate }`.
 * `changes` vient de `parseDiff()` (mode `changed`) ou de `collectChanges()` (mode `full`).
 * `ui` dit si les écrans sont mutés (voir `UI_OPTIONS`) ; par défaut, ils ne le sont pas.
 */
export function buildPlan({ mode, changes, ui = 'exclude', scopeOf = classify }) {
  const parts = PARTS[mode];
  if (!parts) throw new Error(`Unknown mutation mode "${mode}" (expected "changed" or "full").`);
  const scopes = UI_OPTIONS[ui];
  if (!scopes) {
    throw new Error(
      `Unknown screen mutation option "${ui}" (expected ${Object.keys(UI_OPTIONS).join(', ')}).`,
    );
  }
  const byScope = Object.fromEntries(SCOPES.map((scope) => [scope, []]));
  for (const change of changes) {
    const scope = scopeOf(change.file);
    if (!scopes.includes(scope)) continue;
    if (scope === 'domain') {
      // Pesé en lignes mutées, coupé au-delà de `CHUNK_LINES.domain` lignes.
      byScope.domain.push(...wholeFileItems(change, CHUNK_LINES.domain, lineSpan));
      continue;
    }
    if (scope === 'core' && mode === 'full' && change.mutants) {
      // Pesé en mutants, coupé au-delà de `CHUNK_MUTANTS.core` mutants (issue #134).
      byScope.core.push(...wholeFileItems(change, CHUNK_MUTANTS.core, mutantsIn(change.mutants)));
      continue;
    }
    const mutate = mutateEntries(change, { whole: mode === 'full' });
    if (mutate.length === 0) continue; // seulement des lignes supprimées
    byScope[scope].push({ file: change.file, weight: change.weight, mutate });
  }
  const shards = [];
  for (const scope of SCOPES) {
    const groups = split(byScope[scope], parts[scope]);
    groups.forEach((items, index) => {
      shards.push({
        id: groups.length === 1 ? scope : `${scope}-${index + 1}`,
        scope,
        thresholdClass: scope === 'domain' ? 'domain' : 'newCode',
        config: CONFIGS[scope],
        mutate: items.flatMap((item) => item.mutate),
      });
    });
  }
  return shards;
}

/** La matrice GitHub Actions d'un plan. */
export function toMatrix(shards) {
  return { shard: shards.map((shard) => shard.id) };
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Ajoute à chaque fichier des groupes `scopes` son nombre de lignes et ses instructions (`outline()`). */
function withOutlines(changes, cwd, scopeOf, scopes) {
  return changes.map((change) =>
    scopes.includes(scopeOf(change.file))
      ? { ...change, ...outline(readFileSync(path.join(cwd, change.file), 'utf8'), change.file) }
      : change,
  );
}

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  isDebugEnabled: () => false,
};

/**
 * Les plages de lignes (de 1) des mutants de chaque fichier `{ name, content }`, par nom, comptés
 * avec l'instrumenter de Stryker (même version que Stryker, même mutateur que `stryker.config.mjs`).
 */
export async function mutantLines(files) {
  const { mutants } = await new Instrumenter(silentLogger).instrument(
    files.map((file) => ({ ...file, mutate: true })),
    {
      plugins: baseConfig.mutator?.plugins ?? null,
      excludedMutations: baseConfig.mutator?.excludedMutations ?? [],
      ignorers: [],
    },
  );
  const byFile = new Map(files.map((file) => [file.name, []]));
  for (const { fileName, location } of mutants) {
    byFile.get(fileName).push({ start: location.start.line + 1, end: location.end.line + 1 });
  }
  return byFile;
}

/** Ajoute à chaque fichier `core` ses mutants (`mutantLines()`). */
async function withMutants(changes, cwd, scopeOf) {
  const core = changes.filter((change) => scopeOf(change.file) === 'core');
  const byFile = await mutantLines(
    core.map(({ file }) => ({ name: file, content: readFileSync(path.join(cwd, file), 'utf8') })),
  );
  return changes.map((change) =>
    byFile.has(change.file) ? { ...change, mutants: byFile.get(change.file) } : change,
  );
}

/**
 * Seuls effets de bord du plan. Mode `changed` : diff depuis la base de fusion avec `baseRef`.
 * Mode `full` : tous les fichiers suivis de `src/`, en entier. Les fichiers du domaine, et en mode
 * `full` ceux du groupe `core`, sont lus avec le compilateur TypeScript pour pouvoir être coupés ;
 * en mode `full`, les mutants des fichiers `core` sont comptés pour les peser.
 */
export async function collectChanges({
  mode,
  baseRef = 'origin/develop',
  cwd = process.cwd(),
  scopeOf = classify,
}) {
  if (mode === 'full') {
    const files = git(['ls-files', 'src'], cwd).split('\n').filter(Boolean);
    const changes = files.map((file) => ({
      file,
      added: true,
      ranges: [],
      weight: readFileSync(path.join(cwd, file), 'utf8').split('\n').length,
    }));
    const outlined = withOutlines(changes, cwd, scopeOf, ['domain', 'core']);
    return { base: '', changes: await withMutants(outlined, cwd, scopeOf) };
  }
  const base = git(['merge-base', baseRef, 'HEAD'], cwd).trim();
  const diff = git(
    [
      '-c',
      'core.quotePath=false',
      'diff',
      '-U0',
      '-M',
      '--no-color',
      '--no-ext-diff',
      '--diff-filter=ACMR',
      base,
      'HEAD',
      '--',
      'src',
    ],
    cwd,
  );
  return { base, changes: withOutlines(parseDiff(diff), cwd, scopeOf, ['domain']) };
}
