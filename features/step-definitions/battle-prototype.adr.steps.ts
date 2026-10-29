/**
 * Scénario « Les conclusions du prototype sont consignées » (`@adr`) de « Prototype jouable du
 * combat » (#31) : l'ADR du moteur de combat (`docs/adr/NNNN-moteur-de-combat-2d.md`, numéro fixé
 * au merge) a une section pour chaque conclusion demandée. Les chiffres du téléphone du
 * propriétaire y sont reportés avant le passage au statut « accepté », vérifié par le Reviewer.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { SENTINEL } from '../../src/domain/battle/combatants';
import { TEST_BATTLE_ENEMIES, startTestBattle } from '../../src/domain/battle/testing/testBattle';

const ADR_DIRECTORY = path.resolve(__dirname, '../../docs/adr');

let adr = '';

/** Les titres de section de l'ADR (lignes « ## » et « ### »). */
function headings(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => /^#{2,3} /u.test(line))
    .map((line) => line.replace(/^#+ /u, ''));
}

const steps: StepDefinitions = ({ given, and, then }) => {
  // Le contexte commun : le combat dont l'ADR consigne les conclusions.
  given(
    /^le combat contre la Goule, le Spectre et le Nécromancien : la Sentinelle \(.+\) contre la Goule \(50 PV\), le Spectre \(35 PV\) et le Nécromancien \(45 PV\)$/u,
    () => {
      expect(SENTINEL.maxHp).toBe(80);
      expect(TEST_BATTLE_ENEMIES).toEqual(['ghoul', 'specter', 'necromancer']);
    },
  );

  and('le décalage vaut 0 ms', () => {
    const { battle } = startTestBattle({ seed: 1, defenseHint: false, at: 0 });
    expect(battle.inputOffset).toBe(0);
  });

  given('le prototype joué sur le téléphone du propriétaire', () => {
    const files = readdirSync(ADR_DIRECTORY).filter((name) =>
      /^\d{4}-moteur-de-combat-2d\.md$/u.test(name),
    );
    expect(files).toHaveLength(1);
    adr = readFileSync(path.join(ADR_DIRECTORY, files[0]!), 'utf8');
    expect(adr).toMatch(/^- \*\*Statut\*\* : (proposé|accepté)/mu);
    expect(adr).toMatch(/téléphone du propriétaire/u);
  });

  then(/^une décision d'architecture \(ADR\) consigne : .+$/u, () => {
    expect(headings(adr)).toEqual(
      expect.arrayContaining([
        'Précision mesurée des fenêtres de timing',
        'Fluidité des animations',
        'Réactivité des boutons',
        'Durées retenues',
        'Décision : poursuivre ou ajuster',
      ]),
    );
    expect(adr).toMatch(/transition de phase et l'avancée/u);
  });
};

const feature = loadFeature('features/battle-prototype.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@adr')) }],
  [steps],
);
