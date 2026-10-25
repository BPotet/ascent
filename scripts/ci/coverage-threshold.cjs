/**
 * Seuils de couverture de Jest (docs/workflow.md, « Seuils »). En mode prototype
 * (`PROTOTYPE_MODE=true`, label `prototype` sur la PR), le seuil global, qui tient lieu de seuil du
 * code nouveau, est levé ; celui du domaine reste. Les tests tournent dans tous les cas.
 */
const domain = { statements: 95, branches: 95, functions: 95, lines: 95 };
const global = { statements: 80, branches: 80, functions: 80, lines: 80 };

function coverageThreshold(env) {
  if (env.PROTOTYPE_MODE === 'true') return { './src/domain/': domain };
  return { global, './src/domain/': domain };
}

module.exports = { coverageThreshold };
