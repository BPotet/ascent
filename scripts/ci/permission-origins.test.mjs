// Origine des permissions Android (#31, ADR 0005 « Permissions Android ») : l'action de build
// relève, dans le résumé du job, l'origine de chaque permission tirée du rapport de fusion du
// manifeste de Gradle, après l'assemblage de l'APK, sans toucher à l'environnement du job.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const program = resolve(root, 'scripts/ci/permission-origins.awk');
const action = parse(
  readFileSync(resolve(root, '.github/actions/build-android-apk/action.yml'), 'utf8'),
);
const steps = action.runs.steps;
const reportStep = steps.findIndex((step) => step.name === 'Report the APK size and permissions');

const dir = mkdtempSync(join(tmpdir(), 'ascent-permission-origins-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Un extrait de rapport de fusion, au format de Gradle (manifest-merger-*-report.txt). */
const REPORT = [
  '-- Merging decision tree log ---',
  'manifest',
  'ADDED from /work/android/app/src/main/AndroidManifest.xml:1:1-30:12',
  'uses-permission#android.permission.INTERNET',
  'ADDED from /work/android/app/src/main/AndroidManifest.xml:2:3-64',
  'MERGED from [androidx.media3:media3-datasource-okhttp:1.9.0] /cache/AndroidManifest.xml:22:5-67',
  '\tandroid:name',
  '\t\tADDED from /work/android/app/src/main/AndroidManifest.xml:2:20-62',
  'uses-permission#android.permission.WAKE_LOCK',
  'ADDED from [androidx.media3:media3-session:1.9.0] /cache/AndroidManifest.xml:22:5-68',
  'MERGED from [androidx.media3:media3-exoplayer:1.9.0] /cache/AndroidManifest.xml:23:5-68',
  '\tandroid:name',
  '\t\tADDED from [androidx.media3:media3-session:1.9.0] /cache/AndroidManifest.xml:22:22-65',
  'uses-permission#android.permission.ACCESS_NETWORK_STATE',
  'ADDED from [androidx.media3:media3-exoplayer:1.9.0] /cache/AndroidManifest.xml:24:5-79',
  'application',
  'ADDED from /work/android/app/src/main/AndroidManifest.xml:10:3-29:17',
  'MERGED from [androidx.media3:media3-session:1.9.0] /cache/AndroidManifest.xml:30:5-40:19',
  '',
].join('\n');

function origins(report) {
  const file = join(dir, 'report.txt');
  writeFileSync(file, report);
  return execFileSync('awk', ['-f', program, file], { encoding: 'utf8' });
}

describe('permission origins of the Android build', () => {
  it('lists the origin module of each permission', () => {
    assert.equal(
      origins(REPORT),
      [
        '  - android.permission.INTERNET: ADDED from AndroidManifest.xml:2:3-64',
        '  - android.permission.INTERNET: MERGED from [androidx.media3:media3-datasource-okhttp:1.9.0]',
        '  - android.permission.WAKE_LOCK: ADDED from [androidx.media3:media3-session:1.9.0]',
        '  - android.permission.WAKE_LOCK: MERGED from [androidx.media3:media3-exoplayer:1.9.0]',
        '  - android.permission.ACCESS_NETWORK_STATE: ADDED from [androidx.media3:media3-exoplayer:1.9.0]',
        '',
      ].join('\n'),
    );
  });

  it('ignores the origins of the other elements of the manifest', () => {
    assert.equal(
      origins('application\nADDED from [some:module:1.0] /x/AndroidManifest.xml:1:1\n'),
      '',
    );
  });

  it('reads the report after the APK is assembled, into the job summary only', () => {
    const step = steps[reportStep];
    assert.notEqual(reportStep, -1);
    assert.ok(
      reportStep >
        steps.findIndex((candidate) => candidate.run?.includes('gradlew assembleRelease')),
    );
    assert.match(step.env.MERGER_REPORT, /manifest-merger-release-report\.txt$/);
    assert.match(step.run, /awk -f scripts\/ci\/permission-origins\.awk "\$MERGER_REPORT"/);
    assert.match(step.run, /tee -a "\$GITHUB_STEP_SUMMARY"/);
    assert.doesNotMatch(step.run, /GITHUB_ENV/);
  });

  it('keeps the build channel as the first step to write the job environment', () => {
    const writers = steps.flatMap((step, index) =>
      step.run?.includes('GITHUB_ENV') ? [index] : [],
    );
    assert.equal(writers.length, 1);
    assert.equal(steps[writers[0]].name, 'Set the build channel');
  });
});
