// Règle de pureté du domaine et des cas d'usage (eslint.config.js, barrière Style) : le temps et le
// hasard passent par des ports. Exécuté par node:test (npm run test:scripts) et non par Jest :
// ESLint 9 charge eslint.config.js par un import() dynamique, que Jest refuse sans
// --experimental-vm-modules.
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslint = new ESLint({ cwd: root });

const impure = [
  'export function roll(): number {',
  '  setTimeout(() => undefined, 10);',
  '  return Math.random();',
  '}',
  '',
].join('\n');

async function errorsOf(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath: resolve(root, filePath) });
  return result.messages.filter((message) => message.severity === 2);
}

const rulesOf = (errors) => errors.map((error) => error.ruleId).sort();

describe('purity rule', () => {
  for (const layer of ['src/domain', 'src/application']) {
    it(`reports setTimeout and Math.random in ${layer}`, async () => {
      const errors = await errorsOf(impure, `${layer}/__purity__.ts`);

      assert.deepEqual(rulesOf(errors), ['no-restricted-globals', 'no-restricted-properties']);
    });
  }

  it('lets the adapters use timers and randomness', async () => {
    assert.deepEqual(await errorsOf(impure, 'src/adapters/device/__purity__.ts'), []);
  });

  for (const [name, code] of [
    ['setInterval', 'export const id = setInterval(() => undefined, 10);\n'],
    ['requestAnimationFrame', 'export const id = requestAnimationFrame(() => undefined);\n'],
    ['performance', 'export const at = performance.now();\n'],
  ]) {
    it(`reports ${name} in the domain`, async () => {
      const errors = await errorsOf(code, 'src/domain/__purity__.ts');

      assert.deepEqual(rulesOf(errors), ['no-restricted-globals']);
      assert.match(errors[0].message, new RegExp(name));
    });
  }

  it('still forbids fetch in the domain', async () => {
    const code = "export const answer = fetch('https://example.org');\n";

    assert.deepEqual(rulesOf(await errorsOf(code, 'src/domain/__purity__.ts')), [
      'no-restricted-globals',
    ]);
  });

  it('finds nothing to report in the existing domain and use cases', async () => {
    const results = await eslint.lintFiles(['src/domain', 'src/application']);
    const errors = results.flatMap((result) =>
      result.messages
        .filter((message) => message.severity === 2)
        .map((message) => `${result.filePath}: ${message.ruleId}`),
    );

    assert.ok(results.length > 0);
    assert.deepEqual(errors, []);
  });
});
