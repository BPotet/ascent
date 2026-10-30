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
// Issue #147 : un `Timeout` arrêté par la limite de passages porte ce `statusReason` ; sans lui,
// c'est le délai par mutant qui a coupé le run. Au-delà de cette part des mutants exécutés, le
// résumé avertit que le délai est sans doute trop court.
const HIT_LIMIT = /^Hit limit reached/;
const DELAY_TIMEOUT_WARNING = 10;

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

/** Les timeouts d'un rapport, partagés entre délai et limite de passages. */
export function timeoutCauses(report) {
  const timeouts = Object.values(report.files ?? {})
    .flatMap(({ mutants }) => mutants)
    .filter((mutant) => mutant.status === 'Timeout');
  const hitLimit = timeouts.filter((mutant) => HIT_LIMIT.test(mutant.statusReason ?? '')).length;
  return { delay: timeouts.length - hitLimit, hitLimit };
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
        timeouts: { delay: 0, hitLimit: 0 },
      },
    ]),
  );
  for (const { plan, report } of shards) {
    const target = classes[plan.thresholdClass];
    if (!target)
      throw new Error(`Shard "${plan.id}": unknown threshold class "${plan.thresholdClass}".`);
    const metrics = shardMetrics(report);
    const timeouts = timeoutCauses(report);
    target.shards.push({ id: plan.id, metrics, timeouts, undetected: undetectedMutants(report) });
    for (const field of FIELDS) target.total[field] += metrics[field];
    target.timeouts.delay += timeouts.delay;
    target.timeouts.hitLimit += timeouts.hitLimit;
  }
  for (const target of Object.values(classes)) {
    const { totalDetected, totalValid } = target.total;
    target.score = totalValid === 0 ? null : (totalDetected / totalValid) * 100;
    // Comparaison en entiers : pas d'arrondi flottant à la frontière du seuil.
    target.passed = totalValid === 0 || totalDetected * 100 >= target.threshold * totalValid;
    // Mutants exécutés : ceux dont les tests ont tourné jusqu'à un verdict ou un timeout.
    const { killed, timeout, survived } = target.total;
    target.run = killed + timeout + survived;
    target.delayWarning = target.timeouts.delay * 100 > DELAY_TIMEOUT_WARNING * target.run;
  }
  return { classes: Object.values(classes), passed: Object.values(classes).every((c) => c.passed) };
}

const LABELS = { domain: 'Domain', newCode: 'New code (outside the domain)' };

function ratio(part, whole) {
  return whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(2)} %`;
}

function percent(metrics) {
  return ratio(metrics.totalDetected, metrics.totalValid);
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
  const warnings = result.classes.filter((target) => target.delayWarning);
  for (const target of warnings) {
    lines.push(
      `> **Warning**: ${LABELS[target.name]}: ${target.timeouts.delay} of ${target.run} mutant(s) run ` +
        `(${ratio(target.timeouts.delay, target.run)}) timed out by delay, above ${DELAY_TIMEOUT_WARNING} %. ` +
        'The per-mutant timeout may be too short: these mutants count as detected without any failing test.',
      '',
    );
  }
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
  lines.push('', '### Timeouts by delay and by hit limit', '');
  for (const target of result.classes) {
    const { delay, hitLimit } = target.timeouts;
    lines.push(
      `- ${LABELS[target.name]}: ${delay} timeout(s) by delay, ${hitLimit} by hit limit, ` +
        `of ${target.run} mutant(s) run (${ratio(delay, target.run)}).`,
    );
    for (const shard of target.shards) {
      lines.push(
        `- ${LABELS[target.name]} / ${shard.id}: ${shard.timeouts.delay} by delay, ${shard.timeouts.hitLimit} by hit limit.`,
      );
    }
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
