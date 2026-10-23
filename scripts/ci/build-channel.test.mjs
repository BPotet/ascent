// Canal du build (docs/glossary.md, « Canal du build ») : l'action de build Android reçoit un canal,
// preview par défaut, et l'exporte en EXPO_PUBLIC_ASCENT_CHANNEL avant que Gradle ne produise le
// bundle JS. La release construit en production ; la CI des PR et de develop garde le défaut.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readYaml = (file) => parse(readFileSync(resolve(root, file), 'utf8'));

const action = readYaml('.github/actions/build-android-apk/action.yml');
const release = readYaml('.github/workflows/release.yml');
const ci = readYaml('.github/workflows/ci.yml');

const variable = 'EXPO_PUBLIC_ASCENT_CHANNEL';
const steps = action.runs.steps;
const channelStep = steps.findIndex((step) => step.run?.includes('GITHUB_ENV'));
const indexOf = (command) => steps.findIndex((step) => step.run?.includes(command));

/** Les appels de l'action de build dans un workflow. */
const buildCalls = (workflow) =>
  Object.values(workflow.jobs)
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.uses === './.github/actions/build-android-apk');

const dir = mkdtempSync(join(tmpdir(), 'ascent-build-channel-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Exécute l'étape du canal comme le ferait le runner, avec son environnement. */
function runChannelStep(channel) {
  const step = steps[channelStep];
  const githubEnv = join(dir, `env-${channel || 'empty'}`);
  writeFileSync(githubEnv, '');
  const env = { ...process.env, GITHUB_ENV: githubEnv };
  for (const [name, value] of Object.entries(step.env ?? {})) {
    env[name] = value === '${{ inputs.channel }}' ? channel : value;
  }
  try {
    execFileSync('bash', ['-e', '-c', step.run], { env, stdio: 'pipe' });
    return { ok: true, exported: readFileSync(githubEnv, 'utf8') };
  } catch {
    return { ok: false, exported: readFileSync(githubEnv, 'utf8') };
  }
}

describe('build channel of the Android build action', () => {
  it('takes an optional channel, preview by default', () => {
    assert.equal(action.inputs.channel.required, false);
    assert.equal(action.inputs.channel.default, 'preview');
  });

  it('exports the channel before the native project and the bundle are built', () => {
    assert.notEqual(channelStep, -1);
    assert.ok(channelStep < indexOf('expo prebuild'));
    assert.ok(channelStep < indexOf('gradlew assembleRelease'));
  });

  for (const channel of ['preview', 'production']) {
    it(`exports ${channel} as ${variable}`, () => {
      const { ok, exported } = runChannelStep(channel);
      assert.equal(ok, true);
      assert.equal(exported.trim(), `${variable}=${channel}`);
    });
  }

  for (const channel of ['staging', 'Preview', ' preview', '']) {
    it(`fails on the unknown channel "${channel}" without exporting it`, () => {
      const { ok, exported } = runChannelStep(channel);
      assert.equal(ok, false);
      assert.equal(exported, '');
    });
  }
});

describe('callers of the Android build action', () => {
  it('builds the release for production', () => {
    const calls = buildCalls(release);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].with.channel, 'production');
  });

  it('lets the CI keep the preview default', () => {
    const calls = buildCalls(ci);
    assert.ok(calls.length > 0);
    for (const call of calls) {
      assert.equal(call.with?.channel, undefined);
    }
  });
});
