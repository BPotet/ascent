import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cleanUpArtifacts,
  formatSummary,
  isLongLivedBranch,
  selectArtifactsToDelete,
} from './cleanup-artifacts.mjs';

const NAME = 'ascent-android-apk';
const MB = 1024 * 1024;
const REPOSITORY_ID = 42;
const FORK_REPOSITORY_ID = 4242;

let nextId = 1;
function apk(branch, createdAt, overrides = {}) {
  const id = nextId++;
  return {
    id,
    name: NAME,
    size_in_bytes: 34 * MB,
    expired: false,
    created_at: createdAt,
    workflow_run: {
      id: 1000 + id,
      head_branch: branch,
      repository_id: REPOSITORY_ID,
      head_repository_id: REPOSITORY_ID,
    },
    ...overrides,
  };
}

/** APK construit par une PR venant d'un fork, dont la branche peut porter n'importe quel nom. */
function forkApk(branch, createdAt) {
  const artifact = apk(branch, createdAt);
  artifact.workflow_run.head_repository_id = FORK_REPOSITORY_ID;
  return artifact;
}

const ids = (artifacts) => artifacts.map((artifact) => artifact.id).sort((a, b) => a - b);

describe('isLongLivedBranch', () => {
  it('recognises develop, main, release/* and hotfix/*', () => {
    for (const branch of ['develop', 'main', 'release/0.1.0', 'hotfix/0.1.1-crash']) {
      assert.equal(isLongLivedBranch(branch), true, branch);
    }
  });

  it('does not treat story or chore branches as long-lived', () => {
    for (const branch of ['feature/3-day-view', 'chore/x', 'developer', 'mainline', undefined]) {
      assert.equal(isLongLivedBranch(branch), false, String(branch));
    }
  });
});

describe('selectArtifactsToDelete', () => {
  it('keeps only the most recent APK of develop', () => {
    const old = apk('develop', '2026-10-20T10:00:00Z');
    const latest = apk('develop', '2026-10-21T10:00:00Z');
    const older = apk('develop', '2026-10-19T10:00:00Z');

    const { keep, remove } = selectArtifactsToDelete({ artifacts: [old, latest, older] });

    assert.deepEqual(ids(keep), [latest.id]);
    assert.deepEqual(ids(remove), ids([old, older]));
  });

  it('keeps the most recent APK of main and of each release and hotfix branch', () => {
    const main = [apk('main', '2026-10-21T19:00:00Z'), apk('main', '2026-10-20T19:00:00Z')];
    const release = [
      apk('release/0.1.0', '2026-10-21T18:50:11Z'),
      apk('release/0.1.0', '2026-10-21T18:50:42Z'),
    ];
    const hotfix = [apk('hotfix/0.1.1-crash', '2026-10-22T01:00:00Z')];

    const { keep } = selectArtifactsToDelete({ artifacts: [...main, ...release, ...hotfix] });

    assert.deepEqual(ids(keep), ids([main[0], release[1], hotfix[0]]));
  });

  it('keeps the most recent APK of a branch with an open pull request', () => {
    const older = apk('feature/23-habit-difficulty', '2026-10-22T02:23:07Z');
    const latest = apk('feature/23-habit-difficulty', '2026-10-22T03:01:41Z');

    const { keep, remove } = selectArtifactsToDelete({
      artifacts: [older, latest],
      openPullRequestBranches: ['feature/23-habit-difficulty'],
    });

    assert.deepEqual(ids(keep), [latest.id]);
    assert.deepEqual(ids(remove), [older.id]);
  });

  it('removes every APK of a branch without an open pull request', () => {
    const merged = [
      apk('feature/7-week-view', '2026-10-15T07:16:49Z'),
      apk('feature/7-week-view', '2026-10-15T05:57:04Z'),
    ];

    const { keep, remove } = selectArtifactsToDelete({
      artifacts: merged,
      openPullRequestBranches: ['feature/23-habit-difficulty'],
    });

    assert.deepEqual(keep, []);
    assert.deepEqual(ids(remove), ids(merged));
  });

  it('removes an APK whose branch is unknown', () => {
    const orphan = apk(undefined, '2026-10-15T07:16:49Z', { workflow_run: null });

    assert.deepEqual(ids(selectArtifactsToDelete({ artifacts: [orphan] }).remove), [orphan.id]);
  });

  it('never removes an APK of the current run, which its e2e job still needs', () => {
    const latest = apk('feature/x', '2026-10-22T03:00:00Z');
    const current = apk('feature/x', '2026-10-22T02:00:00Z');

    const { keep, remove } = selectArtifactsToDelete({
      artifacts: [latest, current],
      currentRunId: current.workflow_run.id,
    });

    assert.deepEqual(ids(keep), [current.id]);
    assert.deepEqual(ids(remove), [latest.id]);
  });

  it('ignores expired artifacts and artifacts with another name', () => {
    const expired = apk('feature/x', '2026-10-01T00:00:00Z', { expired: true });
    const report = apk('feature/x', '2026-10-01T00:00:00Z', { name: 'e2e-report' });

    const { keep, remove } = selectArtifactsToDelete({ artifacts: [expired, report] });

    assert.deepEqual(keep, []);
    assert.deepEqual(remove, []);
  });

  it('never lets a more recent fork APK named develop protect itself or replace the repository one', () => {
    const ours = apk('develop', '2026-10-21T10:00:00Z');
    const fork = forkApk('develop', '2026-10-22T10:00:00Z');

    const { keep, remove } = selectArtifactsToDelete({ artifacts: [ours, fork] });

    assert.deepEqual(ids(keep), [ours.id]);
    assert.deepEqual(ids(remove), [fork.id]);
  });

  it('never lets a more recent fork APK named like a branch with an open pull request replace the repository one', () => {
    const ours = apk('feature/23-habit-difficulty', '2026-10-22T02:23:07Z');
    const fork = forkApk('feature/23-habit-difficulty', '2026-10-22T03:01:41Z');

    const { keep, remove } = selectArtifactsToDelete({
      artifacts: [ours, fork],
      openPullRequestBranches: ['feature/23-habit-difficulty'],
    });

    assert.deepEqual(ids(keep), [ours.id]);
    assert.deepEqual(ids(remove), [fork.id]);
  });

  it('breaks a tie on the creation date with the highest id', () => {
    const first = apk('develop', '2026-10-21T10:00:00Z');
    const second = apk('develop', '2026-10-21T10:00:00Z');

    assert.deepEqual(ids(selectArtifactsToDelete({ artifacts: [second, first] }).keep), [
      second.id,
    ]);
  });
});

describe('formatSummary', () => {
  it('reports the number and the size of the deleted APKs', () => {
    const summary = formatSummary({
      deleted: [apk('a', '2026-10-01T00:00:00Z'), apk('b', '2026-10-01T00:00:00Z')],
      failed: [],
      kept: [apk('develop', '2026-10-01T00:00:00Z')],
    });

    assert.match(summary, /2 APK artifact\(s\) deleted, 68\.0 MB freed/);
    assert.match(summary, /1 kept/);
    assert.doesNotMatch(summary, /could not be deleted/);
  });

  it('reports the APKs that could not be deleted', () => {
    const summary = formatSummary({
      deleted: [],
      failed: [apk('a', '2026-10-01T00:00:00Z')],
      kept: [],
    });

    assert.match(summary, /0 APK artifact\(s\) deleted, 0\.0 MB freed/);
    assert.match(summary, /1 could not be deleted/);
  });
});

function fakeApi({ artifacts, pulls = [], deleteStatus = () => 204 }) {
  const calls = [];
  const request = async (method, path) => {
    calls.push(`${method} ${path}`);
    if (method === 'GET' && path.startsWith('/repos/o/r/actions/artifacts?')) {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      const slice = artifacts.slice((page - 1) * 100, page * 100);
      return { status: 200, body: { total_count: artifacts.length, artifacts: slice } };
    }
    if (method === 'GET' && path.startsWith('/repos/o/r/pulls?')) {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
      return { status: 200, body: pulls.slice((page - 1) * 100, page * 100) };
    }
    if (method === 'DELETE') {
      return { status: deleteStatus(Number(path.split('/').pop())), body: null };
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
  return { calls, request };
}

const silent = { warn: () => {}, log: () => {} };

describe('cleanUpArtifacts', () => {
  it('deletes the selected APKs and keeps those of open pull requests', async () => {
    const open = apk('feature/open', '2026-10-22T00:00:00Z');
    const stale = apk('feature/merged', '2026-10-20T00:00:00Z');
    const pulls = [
      { head: { ref: 'feature/open', repo: { full_name: 'o/r' } } },
      // A fork's branch of the same name does not protect this repository's branch.
      { head: { ref: 'feature/merged', repo: { full_name: 'fork/r' } } },
    ];
    const api = fakeApi({ artifacts: [open, stale], pulls });

    const result = await cleanUpArtifacts({
      repository: 'o/r',
      request: api.request,
      logger: silent,
    });

    assert.deepEqual(ids(result.deleted), [stale.id]);
    assert.deepEqual(ids(result.kept), [open.id]);
    assert.ok(api.calls.includes(`DELETE /repos/o/r/actions/artifacts/${stale.id}`));
  });

  it('reads every page of artifacts', async () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      apk('feature/merged', new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()),
    );
    const api = fakeApi({ artifacts: many });

    const result = await cleanUpArtifacts({
      repository: 'o/r',
      request: api.request,
      logger: silent,
    });

    assert.equal(result.deleted.length, 150);
  });

  it('counts an artifact already gone as deleted, so a second run is harmless', async () => {
    const stale = apk('feature/merged', '2026-10-20T00:00:00Z');
    const api = fakeApi({ artifacts: [stale], deleteStatus: () => 404 });

    const result = await cleanUpArtifacts({
      repository: 'o/r',
      request: api.request,
      logger: silent,
    });

    assert.deepEqual(ids(result.deleted), [stale.id]);
    assert.deepEqual(result.failed, []);
  });

  it('warns about a failed deletion and goes on with the others', async () => {
    const failing = apk('feature/merged', '2026-10-20T00:00:00Z');
    const other = apk('feature/merged', '2026-10-19T00:00:00Z');
    const warnings = [];
    const api = fakeApi({
      artifacts: [failing, other],
      deleteStatus: (id) => (id === failing.id ? 403 : 204),
    });

    const result = await cleanUpArtifacts({
      repository: 'o/r',
      request: api.request,
      logger: { ...silent, warn: (message) => warnings.push(message) },
    });

    assert.deepEqual(ids(result.failed), [failing.id]);
    assert.deepEqual(ids(result.deleted), [other.id]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /403/);
  });

  it('warns about a deletion that throws and goes on', async () => {
    const stale = apk('feature/merged', '2026-10-20T00:00:00Z');
    const warnings = [];
    const api = fakeApi({ artifacts: [stale] });
    const request = async (method, path) => {
      if (method === 'DELETE') throw new Error('network down');
      return api.request(method, path);
    };

    const result = await cleanUpArtifacts({
      repository: 'o/r',
      request,
      logger: { ...silent, warn: (message) => warnings.push(message) },
    });

    assert.deepEqual(ids(result.failed), [stale.id]);
    assert.match(warnings[0], /network down/);
  });
});
