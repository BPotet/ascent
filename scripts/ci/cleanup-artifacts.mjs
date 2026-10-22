#!/usr/bin/env node
// Job CI « Clean up old artifacts » (docs/workflow.md, « CI/CD et Git Flow ») : supprime les APK
// `ascent-android-apk` devenus inutiles pour libérer le stockage GitHub Actions. Sont gardés : le
// plus récent de `develop`, de `main`, de chaque `release/*` et `hotfix/*`, le plus récent de chaque
// branche qui a une PR ouverte, et ceux du run courant. Une suppression qui échoue n'est qu'un
// avertissement : ce job ne fait jamais échouer la CI. Il est idempotent.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const APK_ARTIFACT = 'ascent-android-apk';
const PAGE_SIZE = 100;

export function isLongLivedBranch(branch) {
  return (
    branch === 'develop' ||
    branch === 'main' ||
    (typeof branch === 'string' && (branch.startsWith('release/') || branch.startsWith('hotfix/')))
  );
}

function isNewer(a, b) {
  const byDate = Date.parse(a.created_at) - Date.parse(b.created_at);
  return byDate === 0 ? a.id > b.id : byDate > 0;
}

/** Fonction pure : répartit les artefacts entre ceux à garder et ceux à supprimer. */
export function selectArtifactsToDelete({
  artifacts,
  openPullRequestBranches = [],
  currentRunId,
  name = APK_ARTIFACT,
}) {
  const protectedBranches = new Set(openPullRequestBranches);
  const candidates = artifacts.filter((artifact) => artifact.name === name && !artifact.expired);

  const latestByBranch = new Map();
  for (const artifact of candidates) {
    const branch = artifact.workflow_run?.head_branch;
    if (!branch || !(isLongLivedBranch(branch) || protectedBranches.has(branch))) continue;
    const latest = latestByBranch.get(branch);
    if (!latest || isNewer(artifact, latest)) latestByBranch.set(branch, artifact);
  }
  const kept = new Set(latestByBranch.values());

  const keep = [];
  const remove = [];
  for (const artifact of candidates) {
    const ofCurrentRun = currentRunId !== undefined && artifact.workflow_run?.id === currentRunId;
    (kept.has(artifact) || ofCurrentRun ? keep : remove).push(artifact);
  }
  return { keep, remove };
}

const megabytes = (artifacts) =>
  (
    artifacts.reduce((total, artifact) => total + (artifact.size_in_bytes ?? 0), 0) /
    1024 /
    1024
  ).toFixed(1);

export function formatSummary({ deleted, failed, kept }) {
  const lines = [
    '### Old artifacts clean-up',
    '',
    `${deleted.length} APK artifact(s) deleted, ${megabytes(deleted)} MB freed; ${kept.length} kept.`,
  ];
  if (failed.length > 0) {
    lines.push('', `${failed.length} could not be deleted (see the warnings of the step).`);
  }
  return `${lines.join('\n')}\n`;
}

async function listAll(request, path, pick) {
  const items = [];
  for (let page = 1; ; page++) {
    const separator = path.includes('?') ? '&' : '?';
    const { status, body } = await request(
      'GET',
      `${path}${separator}per_page=${PAGE_SIZE}&page=${page}`,
    );
    if (status !== 200) throw new Error(`GET ${path} answered ${status}`);
    const batch = pick(body);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) return items;
  }
}

export async function cleanUpArtifacts({ repository, request, currentRunId, logger = console }) {
  const artifacts = await listAll(
    request,
    `/repos/${repository}/actions/artifacts?name=${APK_ARTIFACT}`,
    (body) => body.artifacts,
  );
  const pulls = await listAll(request, `/repos/${repository}/pulls?state=open`, (body) => body);
  const openPullRequestBranches = pulls
    .filter((pull) => pull.head?.repo?.full_name === repository)
    .map((pull) => pull.head.ref);

  const { keep, remove } = selectArtifactsToDelete({
    artifacts,
    openPullRequestBranches,
    currentRunId,
  });

  const deleted = [];
  const failed = [];
  for (const artifact of remove) {
    const label = `${artifact.id} (${artifact.workflow_run?.head_branch ?? 'unknown branch'})`;
    try {
      const { status } = await request(
        'DELETE',
        `/repos/${repository}/actions/artifacts/${artifact.id}`,
      );
      // 404 : déjà supprimé, par un autre run par exemple.
      if (status === 204 || status === 404) {
        deleted.push(artifact);
        logger.log(`Deleted artifact ${label}.`);
      } else {
        failed.push(artifact);
        logger.warn(`Artifact ${label} could not be deleted: HTTP ${status}.`);
      }
    } catch (error) {
      failed.push(artifact);
      logger.warn(`Artifact ${label} could not be deleted: ${error.message}.`);
    }
  }
  return { deleted, failed, kept: keep };
}

function githubRequest({ apiUrl, token }) {
  return async (method, path) => {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

async function main() {
  const env = process.env;
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPOSITORY = env.GITHUB_REPOSITORY;
  const GITHUB_RUN_ID = env.GITHUB_RUN_ID;
  const GITHUB_STEP_SUMMARY = env.GITHUB_STEP_SUMMARY;
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const logger = {
    log: (message) => console.log(message),
    warn: (message) => console.log(`::warning title=Artifacts clean-up::${message}`),
  };
  let summary;
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPOSITORY)
      throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
    const result = await cleanUpArtifacts({
      repository: GITHUB_REPOSITORY,
      request: githubRequest({ apiUrl, token: GITHUB_TOKEN }),
      currentRunId: GITHUB_RUN_ID ? Number(GITHUB_RUN_ID) : undefined,
      logger,
    });
    summary = formatSummary(result);
  } catch (error) {
    logger.warn(`The clean-up did not run: ${error.message}.`);
    summary = `### Old artifacts clean-up\n\nThe clean-up did not run: ${error.message}.\n`;
  }
  console.log(summary);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, summary);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
