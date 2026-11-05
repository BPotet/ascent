/**
 * La règle du domaine de « Riposte du Rempart » (#128), sans écran : sur un ennemi étourdi, la
 * riposte fait 4 PV et aucun point de garde (R4). Dans les règles actuelles, un ennemi étourdi perd
 * son action et ne frappe pas : le cas se vérifie sur le calcul de la riposte (`bulwarkCounterBlow`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { HEROES, SENTINEL } from '../../src/domain/battle/combatants';
import { bulwarkCounterBlow, type EnemyBlow } from '../../src/domain/battle/strike';

interface World {
  stunned: boolean;
  blow: EnemyBlow | null;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given('le héros est la Sentinelle, sans bienfait', () => {
    world = { stunned: false, blow: null };
    expect(SENTINEL).toMatchObject({ attackPower: 10, guardDamage: 12, counterPercent: 130 });
  });

  and('son Rempart est actif', () => {
    expect(HEROES.sentinel.power).toBe('bulwark');
  });

  given("l'ennemi qui porte le coup est étourdi", () => {
    world.stunned = true;
  });

  when('son coup use le Rempart', () => {
    world.blow = bulwarkCounterBlow({
      ...SENTINEL,
      ...SENTINEL.bulwarkCounter,
      stunned: world.stunned,
    });
  });

  then(/^la riposte lui retire (\d+) PV et aucun point de garde$/u, (hp: string) => {
    // 10 × 50 % × 130 % × 50 % × 150 % = 4,875.
    expect(world.blow).toEqual({ hp: Number(hp), guard: 0 });
  });
};

// Seule la règle du domaine : les scénarios `@ui` passent par l'écran.
const feature = loadFeature('features/rempart-riposte.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
