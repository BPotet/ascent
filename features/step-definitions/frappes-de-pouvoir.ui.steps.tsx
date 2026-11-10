/**
 * Scénarios `@ui` des « Frappes de pouvoir » (#236) : l'arbre et la fiche au camp, le menu des
 * pouvoirs (#270) et le Choix du héros au pied de la tour, la feuille de l'Équipement et l'écran de
 * combat, avec les vrais cas d'usage sur un stockage en mémoire.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { LoadoutSheet } from '../../src/adapters/ui/components/LoadoutSheet';
import { PowerTreeScreen } from '../../src/adapters/ui/screens/PowerTreeScreen';
import { PowersMenuScreen } from '../../src/adapters/ui/screens/PowersMenuScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderBattle } from '../../src/adapters/ui/testing/battleScreen';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { battleWith, heroWith } from '../../src/application/testing/battleBuilder';
import { EQUIPPED_POWERS_KEY } from '../../src/application/useCases/CampSession';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { loadoutOf } from '../../src/domain/ascent/loadout';
import type { Battle } from '../../src/domain/battle/Battle';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

let setUp: ReturnType<typeof ascentSetUp>;
let options: Parameters<typeof ascentSetUp>[0] = {};
let onEnter: jest.Mock;

/** La mémoire des pouvoirs équipés, par héros, écrite avant l'ouverture de l'app. */
function remember(heroes: Partial<Record<HeroKind, readonly PowerKind[]>>): void {
  setUp.keyValueStore.values.set(EQUIPPED_POWERS_KEY, JSON.stringify({ version: 1, heroes }));
}

async function showTree(hero: HeroKind = 'sentinel') {
  await setUp.session.load();
  await renderScreen(
    <PowerTreeScreen camp={setUp.camp} hero={hero} onLeave={jest.fn()} />,
    setUp.dependencies,
  );
  await screen.findByTestId('power-tree');
  if (hero === 'wanderer') await fireEvent.press(screen.getByRole('tab', { name: /Errante/u }));
}

/** Le pied de la tour, puis « Commencer l'ascension » : le Choix du héros. */
async function showHeroChoice(hero: HeroKind = 'sentinel') {
  await setUp.session.load();
  onEnter = jest.fn();
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={onEnter}
      onCamp={jest.fn()}
    />,
    setUp.dependencies,
  );
  await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
  await act(async () => undefined);
  if (hero === 'wanderer') await fireEvent.press(screen.getByTestId('hero-choice-wanderer'));
}

const node = (code: PowerKind) => within(screen.getByTestId(`power-node-${code}`));

async function openSheet(code: PowerKind) {
  await fireEvent.press(screen.getByTestId(`power-node-${code}`));
  return within(await screen.findByTestId('power-sheet'));
}

/** Le menu des pouvoirs (#270), ouvert sur l'onglet de `hero`. */
async function showMenu(hero: HeroKind) {
  await setUp.session.load();
  await renderScreen(
    <PowersMenuScreen
      camp={setUp.camp}
      session={setUp.session}
      hero={hero}
      from="tower"
      refusal={{ refusal: jest.fn() }}
      onLeave={jest.fn()}
      onCamp={jest.fn()}
    />,
    setUp.dependencies,
  );
  await screen.findByTestId(`powers-menu-row-${hero === 'sentinel' ? 'bulwark' : 'shadowStep'}`);
}

const changeButton = () => screen.queryByRole('button', { name: /^Changer les pouvoirs/u });
const menuRow = (power: PowerKind) => screen.getByTestId(`powers-menu-row-${power}`);
const key = (power: PowerKind) => screen.getByTestId(`battle-power-button-${power}`);

/** Coche ou décoche chaque pouvoir de `toggles` au menu des pouvoirs. */
async function toggle(...toggles: PowerKind[]) {
  for (const power of toggles) await fireEvent.press(menuRow(power));
}

async function validate() {
  await fireEvent.press(screen.getByTestId('powers-menu-validate'));
  await act(async () => undefined);
}

async function continueWithSentinel() {
  await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
  await act(async () => undefined);
}

const equipped =
  (hero: HeroKind, ...powers: PowerKind[]) =>
  (battle: Battle): Battle => ({ ...battle, heroKind: hero, powers });

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- L'arbre ---

  given(/^le joueur n'a débloqué aucun pouvoir et a 90 Éclats disponibles$/u, () => {
    setUp = ascentSetUp({ shards: 90 });
  });

  when(/^il ouvre l'arbre de pouvoirs de la Sentinelle au camp$/u, async () => {
    await showTree('sentinel');
  });

  then(/^plus aucun pouvoir n'est marqué « Bientôt »$/u, () => {
    expect(screen.queryByText('Bientôt')).not.toBeOnTheScreen();
  });

  and(
    /^Coup de bouclier \(rang 1 de la voie Bouclier, 30 Éclats\) peut être débloqué$/u,
    async () => {
      expect(node('shieldBash').getByText('30 Éclats')).toBeOnTheScreen();
      const sheet = await openSheet('shieldBash');
      expect(sheet.getByText('La Sentinelle · Voie Bouclier · Rang 1')).toBeOnTheScreen();
      expect(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' })).toBeOnTheScreen();
      await fireEvent.press(sheet.getByRole('button', { name: 'Fermer' }));
    },
  );

  and(
    /^Fracas \(rang 2, 60 Éclats\) est verrouillé tant que Coup de bouclier ne l'est pas$/u,
    () => {
      expect(node('crushingBlow').getByText('Après Coup de bouclier')).toBeOnTheScreen();
    },
  );

  when(/^il débloque Coup de bouclier puis Fracas$/u, async () => {
    const bash = await openSheet('shieldBash');
    await fireEvent.press(bash.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));
    await screen.findByLabelText('60 Éclats disponibles');
    const crush = await openSheet('crushingBlow');
    await fireEvent.press(crush.getByRole('button', { name: 'Débloquer pour 60 Éclats' }));
  });

  then(/^il a 0 Éclat disponible et les deux sont débloqués$/u, async () => {
    expect(await screen.findByLabelText('0 Éclat disponible')).toBeOnTheScreen();
    expect(node('shieldBash').getByText('Équipé')).toBeOnTheScreen();
    expect(node('crushingBlow').getByText('Équipé')).toBeOnTheScreen();
  });

  // --- Le Choix du héros ---

  given(/^la Sentinelle a pour pouvoirs équipés Rempart, Représailles et Tenir bon$/u, () => {
    setUp = ascentSetUp({ shards: 200, powers: ['retaliation', 'holdFast'] });
    remember({ sentinel: ['bulwark', 'retaliation', 'holdFast'] });
  });

  when(/^le joueur débloque Coup de bouclier$/u, async () => {
    await showTree('sentinel');
    const sheet = await openSheet('shieldBash');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));
    expect(
      await screen.findByText(
        'Coup de bouclier débloqué. Tes 3 places sont prises : choisis tes pouvoirs au pied de la tour.',
      ),
    ).toBeOnTheScreen();
  });

  then(/^ses pouvoirs équipés restent Rempart, Représailles et Tenir bon$/u, () => {
    expect(setUp.camp.view().equipped.sentinel).toEqual(['bulwark', 'retaliation', 'holdFast']);
    expect(node('shieldBash').getByText('Débloqué')).toBeOnTheScreen();
  });

  and(
    /^le menu des pouvoirs propose Coup de bouclier à la Sentinelle, sans le cocher$/u,
    async () => {
      screen.unmount();
      await showMenu('sentinel');
      expect(menuRow('shieldBash').props.accessibilityState).toMatchObject({ checked: false });
      for (const power of ['bulwark', 'retaliation', 'holdFast'] as const) {
        expect(menuRow(power).props.accessibilityState).toMatchObject({ checked: true });
      }
    },
  );

  given(/^l'Errante n'a que Pas de l'ombre, Entaille et Brume de débloqués$/u, () => {
    setUp = ascentSetUp({ shards: 0, powers: ['rend', 'mist'] });
  });

  then(
    /^l'onglet de l'Errante du menu des pouvoirs n'a rien à cocher, et son Choix du héros pas de « Changer les pouvoirs »$/u,
    async () => {
      await showMenu('wanderer');
      expect(screen.queryAllByRole('checkbox')).toEqual([]);
      expect(within(menuRow('mist')).getByText('Équipé')).toBeOnTheScreen();
      screen.unmount();
      await showHeroChoice('wanderer');
      expect(changeButton()).not.toBeOnTheScreen();
      expect(
        within(screen.getByTestId('hero-choice-wanderer')).getByText('Pouvoirs équipés · 3 sur 3'),
      ).toBeOnTheScreen();
    },
  );

  given(/^la Sentinelle a débloqué Représailles, Tenir bon, Coup de bouclier et Fracas$/u, () => {
    setUp = ascentSetUp({
      shards: 0,
      powers: ['retaliation', 'holdFast', 'shieldBash', 'crushingBlow'],
    });
  });

  when(
    /^le joueur choisit Coup de bouclier, Fracas et Représailles au menu des pouvoirs et touche « Valider »$/u,
    async () => {
      await showMenu('sentinel');
      // La présélection : le Rempart, Coup de bouclier et Fracas.
      await toggle('bulwark', 'retaliation');
      await validate();
      screen.unmount();
      await showHeroChoice('sentinel');
    },
  );

  and(/^continue avec la Sentinelle$/u, async () => {
    await continueWithSentinel();
  });

  then(
    /^ses pouvoirs équipés pour l'ascension sont Coup de bouclier, Fracas et Représailles, sans le Rempart$/u,
    () => {
      expect(setUp.session.current()?.powers).toEqual([
        'shieldBash',
        'crushingBlow',
        'retaliation',
      ]);
      expect(onEnter).toHaveBeenCalled();
    },
  );

  given(/^l'Errante a 5 pouvoirs débloqués$/u, () => {
    setUp = ascentSetUp({ shards: 0, powers: ['rend', 'mist', 'flurry', 'ambush'] });
  });

  when(/^le joueur ouvre ses pouvoirs au menu des pouvoirs$/u, async () => {
    await showMenu('wanderer');
  });

  then(/^il ne peut pas en choisir un 4e$/u, async () => {
    expect(screen.getByText('3 sur 3')).toBeOnTheScreen();
    await toggle('ambush');
    expect(menuRow('ambush').props.accessibilityState).toMatchObject({ checked: false });
    expect(
      screen.getByText("3 sur 3 : retire d'abord un pouvoir pour équiper Frappe furtive."),
    ).toBeOnTheScreen();
  });

  and(/^il ne peut pas valider avec moins de 3 pouvoirs$/u, async () => {
    await toggle('rend');
    expect(
      screen.getByRole('button', {
        name: "Valider, indisponible : choisis encore 1 pouvoir pour l'Errante",
      }),
    ).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
  });

  given(/^l'enregistrement de l'ascension échoue au lancement$/u, async () => {
    setUp = ascentSetUp({
      shards: 0,
      powers: ['retaliation', 'holdFast', 'shieldBash', 'crushingBlow'],
    });
    const set = setUp.keyValueStore.set;
    setUp.keyValueStore.set = (key, value) =>
      key === EQUIPPED_POWERS_KEY ? Promise.reject(new Error('disk full')) : set(key, value);
    // Une présélection jamais validée au menu : le lancement l'écrit (#270, H4).
    await showHeroChoice('sentinel');
  });

  when(/^le joueur continue avec ses pouvoirs choisis$/u, async () => {
    await continueWithSentinel();
  });

  then(/^un message le dit et le joueur peut réessayer, sans perdre son choix$/u, async () => {
    expect(
      screen.getByText(
        "Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie.",
      ),
    ).toBeOnTheScreen();
    expect(setUp.session.current()).toBeNull();
    expect(onEnter).not.toHaveBeenCalled();
    expect(screen.getByTestId('equipped-power-crushingBlow')).toBeOnTheScreen();
    expect(screen.getByTestId('equipped-power-bulwark')).toBeOnTheScreen();

    setUp.keyValueStore.set = (key, value) => {
      setUp.keyValueStore.values.set(key, value);
      return Promise.resolve();
    };
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => undefined);
    expect(setUp.session.current()?.powers).toEqual(['bulwark', 'shieldBash', 'crushingBlow']);
    expect(onEnter).toHaveBeenCalled();
  });

  // --- Le combat ---

  given(/^la Sentinelle a Coup de bouclier équipé$/u, () => {
    options = { shards: 0, powers: ['retaliation', 'holdFast', 'shieldBash', 'crushingBlow'] };
  });

  when(/^le joueur ouvre la liste des pouvoirs en phase du héros$/u, async () => {
    const fight = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('sentinel', 'shieldBash', 'crushingBlow', 'retaliation'),
        heroWith({ momentum: 3 }),
      ),
    });
    await fight.openPowers();
  });

  then(/^sa ligne de la liste des pouvoirs s'appelle « Coup de bouclier »$/u, () => {
    expect(within(key('shieldBash')).getByText('Coup de bouclier')).toBeOnTheScreen();
    expect(screen.queryByText("Coup d'écu")).not.toBeOnTheScreen();
  });

  and(
    /^l'arbre, la fiche du pouvoir, la carte du Choix du héros, le menu des pouvoirs, la feuille de l'Équipement et le lecteur d'écran disent « Coup de bouclier »$/u,
    async () => {
      // Le lecteur d'écran, sur la ligne de la liste des pouvoirs.
      expect(key('shieldBash').props.accessibilityLabel).toBe('Pouvoir : Coup de bouclier, 2 Élan');
      // Le combat démonté avant l'écran suivant : ses gestes ne restent pas inscrits.
      await screen.unmount();
      // L'arbre et la fiche du pouvoir.
      setUp = ascentSetUp(options);
      await showTree('sentinel');
      expect(node('shieldBash').getByText('Coup de bouclier')).toBeOnTheScreen();
      const sheet = await openSheet('shieldBash');
      expect(sheet.getByText('Coup de bouclier')).toBeOnTheScreen();
      await screen.unmount();
      // La carte du Choix du héros et le menu des pouvoirs.
      setUp = ascentSetUp(options);
      await showHeroChoice('sentinel');
      expect(
        within(screen.getByTestId('equipped-power-shieldBash')).getByText('Coup de bouclier'),
      ).toBeOnTheScreen();
      await screen.unmount();
      await showMenu('sentinel');
      expect(within(menuRow('shieldBash')).getByText('Coup de bouclier')).toBeOnTheScreen();
      await screen.unmount();
      // La feuille de l'Équipement.
      const ascent = startAscent(5, { powers: ['shieldBash', 'crushingBlow', 'retaliation'] });
      await render(
        <LoadoutSheet loadout={loadoutOf(ascent)} combat={false} visible onClose={jest.fn()} />,
      );
      expect(
        within(screen.getByTestId('loadout-powers')).getByText('Coup de bouclier'),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Coup d'écu")).not.toBeOnTheScreen();
      await screen.unmount();
    },
  );

  given(/^l'Errante a 2 Élan et Frappe furtive équipée$/u, async () => {
    const fight = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('wanderer', 'shadowStep', 'rend', 'ambush'),
        heroWith({ momentum: 2 }),
      ),
    });
    await fight.openPowers();
  });

  then(
    /^la ligne de Frappe furtive est visible mais indisponible et dit qu'il manque 1 Élan$/u,
    () => {
      expect(within(key('ambush')).getByText('Frappe furtive')).toBeOnTheScreen();
      expect(within(key('ambush')).getByText('Il manque 1 Élan')).toBeOnTheScreen();
      expect(key('ambush').props.accessibilityState).toEqual({ disabled: true });
      expect(key('ambush').props.accessibilityLabel).toBe(
        'Pouvoir : Frappe furtive, 3 Élan, indisponible : il manque 1 Élan',
      );
    },
  );
};

// Les écrans seuls : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/frappes-de-pouvoir.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
