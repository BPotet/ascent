/**
 * « Le coffre du butin » (#227), règles seules : le Coffre est un habillage de l'écran, les tirages
 * du palier 1 sont ceux des marches figées avant lui (`TIER_ONE_WALKS`) : mêmes objets trouvés et
 * raretés, même Or, mêmes portes et mêmes offres de bienfaits.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';

/** Les marches rejouées : les 50 premières graines. */
const WALKS = 50;

let replayed: readonly string[] = [];

const steps: StepDefinitions = ({ given, then }) => {
  given(
    /^deux ascensions de même graine, aux mêmes choix, l'une en v0\.4\.0 et l'autre avec le coffre$/u,
    () => {
      replayed = TIER_ONE_WALKS.slice(0, WALKS).map((_, index) => walkTierOne(index + 1));
    },
  );

  then(
    /^les objets trouvés, leurs raretés, l'Or, les portes et les offres de bienfaits sont les mêmes$/u,
    () => {
      expect(replayed).toHaveLength(WALKS);
      expect(replayed).toEqual(TIER_ONE_WALKS.slice(0, WALKS));
    },
  );
};

const feature = loadFeature('features/coffre-du-butin.feature');
const ofDomain = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@domain');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofDomain),
      scenarioOutlines: feature.scenarioOutlines.filter(ofDomain),
    },
  ],
  [steps],
);
