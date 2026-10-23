#!/usr/bin/env node
// Barrière « Tests de mutation » (docs/workflow.md, docs/adr/0004-mutation-en-ci.md) : seul endroit où
// les seuils s'appliquent. Additionne les mutants de tous les shards par classe de seuil (domaine,
// code nouveau) avec la formule de Stryker, puis compare chaque total au `break` de sa config.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { calculateMutationTestMetrics } from 'mutation-testing-metrics';

export const REPORTS_DIR = 'reports/mutation';
const FIELDS = ['killed', 'timeout', 'survived', 'noCoverage', 'totalDetected', 'totalValid'];
const CLASSES = ['domain', 'newCode'];
const REPORTED_STATUSES = ['Survived', 'NoCoverage'];

/** Les `plan.json` sous `dir`, à toute profondeur (les artefacts téléchargés sont dans des sous-dossiers). */
export function findPlans(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === 'plan.json')
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .sort();
}

/** Lit chaque shard (son plan et le `mutation.json` voisin) et vérifie qu'aucun ne manque. */
export function loadShards(dir, { expectedShards } = {}) {
  const errors = [];
  const shards = findPlans(dir).map((planPath) => {
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    const reportPath = path.join(path.dirname(planPath), 'mutation.json');
    if (!existsSync(reportPath)) {
      errors.push(`Shard "${plan.id}": ${reportPath} is missing.`);
      return { plan, report: null };
    }
    return { plan, report: JSON.parse(readFileSync(reportPath, 'utf8')) };
  });
  const expected = new Set(shards.map(({ plan }) => plan.expectedShards));
  if (expectedShards !== undefined) expected.add(expectedShards);
  for (const count of expected) {
    if (count !== shards.length) {
      errors.push(`Expected ${count} shard(s), found ${shards.length} plan.json under ${dir}.`);
    }
  }
  return { shards, errors };
}

/** Métriques d'un rapport Stryker, avec la même formule que Stryker. */
export function shardMetrics(report) {
  const metrics = calculateMutationTestMetrics(report).systemUnderTestMetrics.metrics;
  return Object.fromEntries(FIELDS.map((field) => [field, metrics[field]]));
}

/** Les mutants non tués, au format `fichier:ligne — mutateur — remplacement`. */
export function undetectedMutants(report) {
  return Object.entries(report.files ?? {}).flatMap(([file, { mutants }]) =>
    mutants
      .filter((mutant) => REPORTED_STATUSES.includes(mutant.status))
      .map(
        (mutant) =>
          `${file}:${mutant.location.start.line} — ${mutant.mutatorName} — ${mutant.replacement ?? ''}`.trimEnd() +
          ` (${mutant.status})`,
      ),
  );
}

/** Additionne les shards par classe de seuil et applique les seuils `break`. */
export function score(shards, thresholds) {
  const classes = Object.fromEntries(
    CLASSES.map((name) => [
      name,
      {
        name,
        threshold: thresholds[name],
        shards: [],
        total: Object.fromEntries(FIELDS.map((field) => [field, 0])),
      },
    ]),
  );
  for (const { plan, report } of shards) {
    const target = classes[plan.thresholdClass];
    if (!target)
      throw new Error(`Shard "${plan.id}": unknown threshold class "${plan.thresholdClass}".`);
    const metrics = shardMetrics(report);
    target.shards.push({ id: plan.id, metrics, undetected: undetectedMutants(report) });
    for (const field of FIELDS) target.total[field] += metrics[field];
  }
  for (const target of Object.values(classes)) {
    const { totalDetected, totalValid } = target.total;
    target.score = totalValid === 0 ? null : (totalDetected / totalValid) * 100;
    // Comparaison en entiers : pas d'arrondi flottant à la frontière du seuil.
    target.passed = totalValid === 0 || totalDetected * 100 >= target.threshold * totalValid;
  }
  return { classes: Object.values(classes), passed: Object.values(classes).every((c) => c.passed) };
}

const LABELS = { domain: 'Domain', newCode: 'New code (outside the domain)' };

function percent(metrics) {
  return metrics.totalValid === 0
    ? 'n/a'
    : `${((metrics.totalDetected / metrics.totalValid) * 100).toFixed(2)} %`;
}

function row(name, metrics, threshold, verdict) {
  const cells = [
    name,
    metrics.killed,
    metrics.timeout,
    metrics.survived,
    metrics.noCoverage,
    percent(metrics),
    `${threshold} %`,
    verdict,
  ];
  return `| ${cells.join(' | ')} |`;
}

/**
 * Le résumé Markdown : la mutation des écrans demandée ou non (`notice`), un tableau par classe et
 * par shard, puis les mutants non tués.
 */
export function renderSummary(result, errors = [], { notice = '' } = {}) {
  const lines = ['## Mutation tests (StrykerJS)', ''];
  if (notice) lines.push(`> ${notice}`, '');
  for (const error of errors) lines.push(`- **Error**: ${error}`);
  if (errors.length > 0) lines.push('');
  lines.push(
    '| Class / shard | Killed | Timeout | Survived | No coverage | Score | Threshold | Verdict |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
  );
  for (const target of result.classes) {
    for (const shard of target.shards) {
      lines.push(row(`${LABELS[target.name]} / ${shard.id}`, shard.metrics, target.threshold, ''));
    }
    const verdict =
      target.total.totalValid === 0 ? 'pass (no mutant)' : target.passed ? 'pass' : '**fail**';
    lines.push(row(`**${LABELS[target.name]}, total**`, target.total, target.threshold, verdict));
  }
  const undetected = result.classes.flatMap((target) =>
    target.shards.flatMap((shard) => shard.undetected),
  );
  lines.push('', `### Survived and no-coverage mutants (${undetected.length})`, '');
  lines.push(...(undetected.length > 0 ? undetected.map((line) => `- ${line}`) : ['None.']));
  return `${lines.join('\n')}\n`;
}

/** Les seuils `break` des deux configs Stryker. */
export async function loadThresholds(root = process.cwd()) {
  const load = async (file) =>
    (await import(pathToFileURL(path.resolve(root, file)).href)).default.thresholds.break;
  return {
    domain: await load('stryker.domain.config.mjs'),
    newCode: await load('stryker.config.mjs'),
  };
}

/** Point d'entrée : 0 si chaque classe atteint son seuil, 1 sinon. */
export async function main({
  dir = REPORTS_DIR,
  env = process.env,
  thresholds,
  write = (text) => process.stdout.write(text),
} = {}) {
  const expectedShards =
    env.EXPECTED_SHARDS === undefined || env.EXPECTED_SHARDS === ''
      ? undefined
      : Number(env.EXPECTED_SHARDS);
  const { shards, errors } = loadShards(dir, { expectedShards });
  const result = score(
    shards.filter(({ report }) => report),
    thresholds ?? (await loadThresholds()),
  );
  const summary = renderSummary(result, errors, { notice: env.MUTATION_UI_NOTICE });
  write(summary);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'summary.md'), summary);
  return errors.length === 0 && result.passed ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main();
}
