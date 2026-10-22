// Plan de la mutation en CI (docs/adr/0004-mutation-en-ci.md) : quels fichiers, quelles lignes, dans
// quel shard. Fonctions pures ; les seuls effets de bord (appels à git, lecture des fichiers) sont
// regroupés dans `collectChanges()`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Minimatch, minimatch } from 'minimatch';
import baseConfig from '../../stryker.config.mjs';
import domainConfig from '../../stryker.domain.config.mjs';
import uiConfig from '../../stryker.ui.config.mjs';

export const BASE_CONFIG = 'stryker.config.mjs';
export const DOMAIN_CONFIG = 'stryker.domain.config.mjs';
export const UI_CONFIG = 'stryker.ui.config.mjs';
const CONFIGS = { domain: DOMAIN_CONFIG, core: BASE_CONFIG, ui: UI_CONFIG };

// Réglages de la répartition, pas des seuils : nombre de parts (shards) par groupe et par mode.
// `core` (révision du 22 octobre 2026 de l'ADR 0004) : environ 10 s par mutant en CI, plus un coût
// fixe d'environ 5 minutes par shard (installation et « dry run » de toute la suite Jest). 3 parts
// en PR ramènent les ~25 minutes d'un seul shard à environ 10 ; au-delà, le coût fixe domine. En
// release, ~7 fois plus de lignes : 6 parts d'environ 20 minutes au lieu de 2 de près d'une heure.
export const PARTS = {
  changed: { domain: 1, core: 3, ui: 2 },
  full: { domain: 1, core: 6, ui: 10 },
};

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

/**
 * Répartit des fichiers pondérés en `parts` parts, sans couper un fichier : gloutonne et
 * déterministe (poids décroissant puis chemin ; la part la plus légère, puis d'indice le plus bas).
 * Les parts vides sont supprimées.
 */
export function split(items, parts) {
  const sorted = [...items].sort(
    (a, b) => b.weight - a.weight || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
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
    const whole = mode === 'full' || scope === 'domain';
    const mutate = mutateEntries(change, { whole });
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

/**
 * Seuls effets de bord du plan. Mode `changed` : diff depuis la base de fusion avec `baseRef`.
 * Mode `full` : tous les fichiers suivis de `src/`, en entier, pondérés par leur nombre de lignes.
 */
export function collectChanges({ mode, baseRef = 'origin/develop', cwd = process.cwd() }) {
  if (mode === 'full') {
    const files = git(['ls-files', 'src'], cwd).split('\n').filter(Boolean);
    const changes = files.map((file) => ({
      file,
      added: true,
      ranges: [],
      weight: readFileSync(path.join(cwd, file), 'utf8').split('\n').length,
    }));
    return { base: '', changes };
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
  return { base, changes: parseDiff(diff) };
}
