// Plan de la mutation en CI (docs/adr/0004-mutation-en-ci.md) : quels fichiers, quelles lignes, dans
// quel shard. Fonctions pures ; les seuls effets de bord (appels à git, lecture des fichiers) sont
// regroupés dans `collectChanges()`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { minimatch } from 'minimatch';
import baseConfig from '../../stryker.config.mjs';
import domainConfig from '../../stryker.domain.config.mjs';

export const BASE_CONFIG = 'stryker.config.mjs';
export const DOMAIN_CONFIG = 'stryker.domain.config.mjs';

// Réglages de la répartition, pas des seuils : nombre de parts (shards) par groupe et par mode.
export const PARTS = {
  changed: { domain: 1, core: 1, ui: 2 },
  full: { domain: 1, core: 2, ui: 10 },
};

const SCOPES = ['domain', 'core', 'ui'];
const UI_PATTERNS = ['src/adapters/ui/**', 'src/app/**'];

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
 * Groupe d'un fichier de `src/`, ou `null` s'il n'est pas muté. Les listes `mutate` des configs
 * Stryker sont la source de vérité.
 */
export function classify(
  file,
  { domainPatterns = domainConfig.mutate, basePatterns = baseConfig.mutate } = {},
) {
  if (isRetained(file, domainPatterns)) return 'domain';
  if (!isRetained(file, basePatterns)) return null;
  return UI_PATTERNS.some((pattern) => minimatch(file, pattern)) ? 'ui' : 'core';
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

/** Échappe les caractères spéciaux de minimatch pour qu'un chemin ne désigne que lui-même. */
export function escapeGlob(file) {
  return file.replace(/[*?[\]{}()!+@]/g, '\\$&');
}

/** Vérifie, comme Stryker, que le motif `pattern` désigne bien le fichier `file`. */
export function assertMatches(file, pattern) {
  const glob = pattern.replace(/:\d+-\d+$/, '');
  if (!minimatch(path.resolve(file), path.resolve(glob))) {
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
 */
export function buildPlan({ mode, changes, scopeOf = classify }) {
  const parts = PARTS[mode];
  if (!parts) throw new Error(`Unknown mutation mode "${mode}" (expected "changed" or "full").`);
  const byScope = Object.fromEntries(SCOPES.map((scope) => [scope, []]));
  for (const change of changes) {
    const scope = scopeOf(change.file);
    if (!scope) continue;
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
        config: scope === 'domain' ? DOMAIN_CONFIG : BASE_CONFIG,
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
