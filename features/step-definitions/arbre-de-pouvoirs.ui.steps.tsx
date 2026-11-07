/**
 * Scénarios `@ui` de « L'arbre de pouvoirs » (#235) : l'arbre et la fiche du pouvoir au camp, le
 * pied de la tour, le Choix du héros, la feuille de l'Équipement et l'écran de combat, avec les
 * vrais cas d'usage sur un stockage en mémoire.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { powerGestureTestId } from '../../src/adapters/ui/battle/ActionPad';
import { HeroBar } from '../../src/adapters/ui/battle/HeroBar';
import { LoadoutSheet } from '../../src/adapters/ui/components/LoadoutSheet';
import { PowerTreeScreen } from '../../src/adapters/ui/screens/PowerTreeScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderBattle, type BattleScreenTest } from '../../src/adapters/ui/testing/battleScreen';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { battleWith, heroWith } from '../../src/application/testing/battleBuilder';
import { CAMP_KEY } from '../../src/application/useCases/CampSession';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { loadoutOf } from '../../src/domain/ascent/loadout';
import { powerPrice } from '../../src/domain/ascent/powerTree';
import type { Battle } from '../../src/domain/battle/Battle';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';
import { act as heroAct, cast, powerBattle } from '../support/powersStory';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const hiddenToo = { includeHiddenElements: true } as const;

let setUp: ReturnType<typeof ascentSetUp>;
let fight: BattleScreenTest;
let options: Parameters<typeof ascentSetUp>[0] = {};

async function showTree(hero: HeroKind = 'sentinel') {
  setUp = ascentSetUp(options);
  await setUp.session.load();
  await renderScreen(
    <PowerTreeScreen camp={setUp.camp} hero={hero} onLeave={jest.fn()} />,
    setUp.dependencies,
  );
  await screen.findByTestId('power-tree');
  if (hero === 'wanderer') await fireEvent.press(screen.getByRole('tab', { name: /Errante/u }));
}

const node = (code: PowerKind) => within(screen.getByTestId(`power-node-${code}`));

async function openSheet(code: PowerKind) {
  await fireEvent.press(screen.getByTestId(`power-node-${code}`));
  return within(await screen.findByTestId('power-sheet'));
}

const equipped =
  (...powers: PowerKind[]) =>
  (battle: Battle): Battle => ({ ...battle, powers });

const asHero =
  (heroKind: HeroKind) =>
  (battle: Battle): Battle => ({ ...battle, heroKind });

const key = (power: PowerKind) => screen.getByTestId(`battle-power-button-${power}`);

/** Le maintien sur la touche de Représailles, avec ses fonctions de geste. */
const holdGesture = () =>
  getByGestureTestId(`${powerGestureTestId('retaliation')}-hold`) as unknown as {
    readonly handlers: Record<string, ((...args: unknown[]) => void) | undefined>;
  };

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- L'arbre de pouvoirs au Camp ---

  given(/^le joueur n'a débloqué aucun pouvoir et a 50 Éclats disponibles$/u, () => {
    options = { shards: 50 };
  });

  given(/^le joueur n'a débloqué aucun pouvoir$/u, () => {
    options = { shards: 50 };
  });

  when(/^il ouvre l'arbre de pouvoirs de la Sentinelle au camp$/u, async () => {
    await showTree('sentinel');
  });

  when(/^il ouvre l'arbre de pouvoirs de l'Errante au camp$/u, async () => {
    await showTree('wanderer');
  });

  then(/^il voit « 50 Éclats disponibles »$/u, () => {
    expect(screen.getByLabelText('50 Éclats disponibles')).toBeOnTheScreen();
  });

  and(/^la racine de l'arbre est le Rempart, marqué « Pouvoir de base », sans prix$/u, () => {
    expect(node('bulwark').getByText('Rempart')).toBeOnTheScreen();
    expect(node('bulwark').getByText('Pouvoir de base')).toBeOnTheScreen();
    expect(node('bulwark').queryByText(/Éclats/u)).not.toBeOnTheScreen();
  });

  and(
    /^la voie Veille montre Représailles \(rang 1, 30 Éclats\) puis Tenir bon \(rang 2, 60 Éclats, verrouillé\)$/u,
    async () => {
      expect(screen.getByText('Voie Veille')).toBeOnTheScreen();
      expect(node('retaliation').getByText('30 Éclats')).toBeOnTheScreen();
      expect(node('holdFast').getByText('Après Représailles')).toBeOnTheScreen();
      // Verrouillé, le nœud et sa fiche disent le verrou à la place du prix (maquette A1, F4).
      expect(powerPrice('holdFast')).toBe(60);
      const sheet = await openSheet('holdFast');
      expect(sheet.getByText('La Sentinelle · Voie Veille · Rang 2')).toBeOnTheScreen();
      expect(sheet.getByRole('button', { name: 'Voir Représailles' })).toBeOnTheScreen();
    },
  );

  and(
    /^la voie Bouclier montre Coup de bouclier \(rang 1, 30 Éclats\) puis Fracas \(rang 2, 60 Éclats, verrouillé\)$/u,
    () => {
      expect(screen.getByText('Voie Bouclier')).toBeOnTheScreen();
      expect(node('shieldBash').getByText('30 Éclats')).toBeOnTheScreen();
      expect(node('crushingBlow').getByText('Après Coup de bouclier')).toBeOnTheScreen();
      expect(powerPrice('crushingBlow')).toBe(60);
      expect(screen.queryByText('Bientôt')).not.toBeOnTheScreen();
    },
  );

  then(/^la racine de l'arbre est Pas de l'ombre, marqué « Pouvoir de base », sans prix$/u, () => {
    expect(node('shadowStep').getByText('Pouvoir de base')).toBeOnTheScreen();
    expect(node('shadowStep').queryByText(/Éclats/u)).not.toBeOnTheScreen();
  });

  and(
    /^la voie Lames montre Entaille \(rang 1, 30 Éclats\) puis Rafale \(rang 2, 60 Éclats, verrouillée\)$/u,
    () => {
      expect(screen.getByText('Voie Lames')).toBeOnTheScreen();
      expect(node('rend').getByText('30 Éclats')).toBeOnTheScreen();
      expect(node('flurry').getByText('Après Entaille')).toBeOnTheScreen();
      expect(powerPrice('flurry')).toBe(60);
    },
  );

  and(
    /^la voie Ombre montre Brume \(rang 1, 30 Éclats\) puis Frappe furtive \(rang 2, 60 Éclats, verrouillée\)$/u,
    () => {
      expect(screen.getByText('Voie Ombre')).toBeOnTheScreen();
      expect(node('mist').getByText('30 Éclats')).toBeOnTheScreen();
      expect(node('ambush').getByText('Après Brume')).toBeOnTheScreen();
      expect(powerPrice('ambush')).toBe(60);
    },
  );

  given(/^le joueur a 50 Éclats disponibles$/u, () => {
    options = { shards: 50 };
  });

  when(/^il débloque Représailles dans l'arbre de la Sentinelle$/u, async () => {
    await showTree('sentinel');
    const sheet = await openSheet('retaliation');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));
  });

  then(/^il a 20 Éclats disponibles$/u, async () => {
    expect(await screen.findByLabelText('20 Éclats disponibles')).toBeOnTheScreen();
  });

  and(/^Représailles est marqué débloqué dans l'arbre$/u, () => {
    expect(node('retaliation').getByText('Équipé')).toBeOnTheScreen();
  });

  and(/^le pied de la tour affiche lui aussi 20 Éclats disponibles$/u, async () => {
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );
    expect(await screen.findByLabelText('20 Éclats')).toBeOnTheScreen();
  });

  given(/^le joueur a débloqué Représailles et a 40 Éclats disponibles$/u, () => {
    options = { shards: 70, powers: ['retaliation'] };
  });

  then(/^Tenir bon \(60 Éclats\) est affiché mais ne peut pas être débloqué$/u, async () => {
    await showTree('sentinel');
    expect(screen.getByLabelText('40 Éclats disponibles')).toBeOnTheScreen();
    const sheet = await openSheet('holdFast');
    expect(sheet.getByLabelText(/^Prix 60 Éclats\./u)).toBeOnTheScreen();
    expect(
      sheet.getByRole('button', { name: 'Débloquer, indisponible : il manque 20 Éclats' }),
    ).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
  });

  and(/^il indique « Il manque 20 Éclats »$/u, () => {
    expect(node('holdFast').getByText('Il manque 20 Éclats')).toBeOnTheScreen();
  });

  given(/^le joueur a 200 Éclats disponibles$/u, () => {
    options = { shards: 200 };
  });

  when(/^il touche Coup de bouclier dans l'arbre de la Sentinelle$/u, async () => {
    await showTree('sentinel');
    await openSheet('shieldBash');
  });

  then(
    /^sa fiche s'ouvre, avec son nom complet « Coup de bouclier », 2 Élan et le type « Frappe »$/u,
    () => {
      const sheet = within(screen.getByTestId('power-sheet'));
      expect(sheet.getByText('Coup de bouclier')).toBeOnTheScreen();
      expect(sheet.queryByText("Coup d'écu")).not.toBeOnTheScreen();
      expect(sheet.getByText('2 Élan')).toBeOnTheScreen();
      expect(sheet.getByText('Frappe')).toBeOnTheScreen();
    },
  );

  and(/^elle propose de le débloquer pour 30 Éclats$/u, () => {
    const sheet = within(screen.getByTestId('power-sheet'));
    expect(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' })).toBeOnTheScreen();
  });

  given(/^l'enregistrement de l'achat échoue$/u, () => {
    options = { shards: 50 };
  });

  when(/^le joueur débloque Brume$/u, async () => {
    await showTree('wanderer');
    const store = setUp.keyValueStore;
    const set = store.set;
    store.set = (name, value) =>
      name === CAMP_KEY ? Promise.reject(new Error('disk full')) : set(name, value);
    const sheet = await openSheet('mist');
    await fireEvent.press(sheet.getByRole('button', { name: 'Débloquer pour 30 Éclats' }));
    store.set = set;
  });

  then(/^un message dit que l'achat n'a pas pu être enregistré$/u, async () => {
    expect(
      await screen.findByText("Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts."),
    ).toBeOnTheScreen();
  });

  and(
    /^les Éclats ne sont pas dépensés, Brume n'est pas débloquée et le joueur peut réessayer$/u,
    async () => {
      expect(screen.getByLabelText('50 Éclats disponibles')).toBeOnTheScreen();
      expect(node('mist').getByText('30 Éclats')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
      expect(await screen.findByLabelText('20 Éclats disponibles')).toBeOnTheScreen();
    },
  );

  // --- Les pouvoirs équipés ---

  given(/^le joueur a débloqué Représailles et aucune ascension n'est en cours$/u, () => {
    options = { shards: 30, powers: ['retaliation'] };
  });

  when(/^il commence une ascension et choisit la Sentinelle$/u, async () => {
    setUp = ascentSetUp(options);
    await renderScreen(
      <TowerFootScreen
        session={setUp.session}
        camp={setUp.camp}
        onEnter={jest.fn()}
        onCamp={jest.fn()}
      />,
      setUp.dependencies,
    );
    expect(setUp.session.current()).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
  });

  then(
    /^la carte de la Sentinelle du Choix du héros montre ses pouvoirs équipés : Rempart, puis Représailles$/u,
    () => {
      const card = within(screen.getByTestId('hero-choice-sentinel'));
      expect(card.getByText('Pouvoirs équipés · 2 sur 3')).toBeOnTheScreen();
      expect(
        card.getAllByTestId(/^equipped-power-(?!free)/u).map(({ props }) => props.testID),
      ).toEqual(['equipped-power-bulwark', 'equipped-power-retaliation']);
    },
  );

  and(/^il n'a rien à choisir$/u, async () => {
    expect(screen.queryByText(/Changer les pouvoirs/u)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec la Sentinelle' }));
    expect(setUp.session.current()?.powers).toEqual(['bulwark', 'retaliation']);
  });

  given(/^le joueur n'a débloqué aucun pouvoir pour l'Errante$/u, () => {
    options = { shards: 30, powers: ['retaliation'] };
  });

  when(/^il commence une ascension avec l'Errante$/u, async () => {
    setUp = ascentSetUp(options);
    await setUp.camp.load();
    expect(setUp.camp.beginAscent({ hero: 'wanderer' })?.powers).toEqual(['shadowStep']);
  });

  then(/^son seul pouvoir équipé est Pas de l'ombre$/u, () => {
    expect(setUp.session.current()?.powers).toEqual(['shadowStep']);
  });

  and(
    /^en combat, il a une seule touche de pouvoir à côté d'« Attaquer », comme aujourd'hui$/u,
    async () => {
      const powers = [...setUp.session.current()!.powers];
      fight = await renderBattle({
        seed: 1,
        createBattle: battleWith(asHero('wanderer'), equipped(...powers)),
      });
      expect(screen.getAllByTestId(/^battle-power-button-/u)).toHaveLength(1);
      expect(key('shadowStep')).toHaveTextContent(/^Pas de l'ombre/u);
      expect(screen.getByTestId('battle-attack-button')).toBeOnTheScreen();
      expect(screen.queryByTestId('battle-hint-powers')).toBeNull();
    },
  );

  given(
    /^une ascension en cours avec l'Errante équipée de Pas de l'ombre, Entaille et Brume$/u,
    () => {
      options = {
        saved: startAscent(5, { hero: 'wanderer', powers: ['shadowStep', 'rend', 'mist'] }),
      };
    },
  );

  when(/^le joueur ouvre la feuille de l'Équipement$/u, async () => {
    setUp = ascentSetUp(options);
    const ascent = await setUp.session.load();
    await render(
      <LoadoutSheet loadout={loadoutOf(ascent!)} combat={false} visible onClose={jest.fn()} />,
    );
  });

  then(
    /^il y voit ses 3 pouvoirs équipés, avec leur icône, leur coût en Élan et leur effet$/u,
    () => {
      const section = within(screen.getByTestId('loadout-powers'));
      expect(section.getAllByTestId(/^loadout-power-/u).map(({ props }) => props.testID)).toEqual([
        'loadout-power-shadowStep',
        'loadout-power-rend',
        'loadout-power-mist',
      ]);
      for (const power of ['shadowStep', 'rend', 'mist'] as const) {
        expect(section.getByTestId(`power-icon-${power}`, hiddenToo)).toBeTruthy();
      }
      expect(screen.getByTestId('loadout-power-mist').props.accessibilityLabel).toBe(
        'Brume, 2 Élan, Instantané. Le prochain impact qui te fait des dégâts est réduit de 50 %.',
      );
      expect(screen.getByTestId('loadout-power-rend').props.accessibilityLabel).toMatch(
        /^Entaille, 1 Élan, Instantané\. /u,
      );
    },
  );

  // --- Le combat à 1 à 3 touches de pouvoir ---

  given(
    /^l'Errante équipée de Pas de l'ombre, Entaille et Brume, sur un écran de 360 dp de large$/u,
    async () => {
      fight = await renderBattle({
        seed: 1,
        createBattle: battleWith(
          asHero('wanderer'),
          equipped('shadowStep', 'rend', 'mist'),
          heroWith({ momentum: 5 }),
        ),
      });
    },
  );

  when(/^c'est la phase du héros$/u, () => {
    expect(fight.battle().phase.kind).toBe('hero');
  });

  then(
    /^une seule rangée montre, dans l'ordre de l'arbre : Pas de l'ombre, Entaille, Brume, puis « Attaquer »$/u,
    () => {
      const pad = screen.getByTestId('battle-pad');
      expect(StyleSheet.flatten(pad.props.style).flexDirection).toBe('row');
      const keys = within(pad)
        .getAllByTestId(/^battle-(power|attack)-button/u)
        .map(({ props }) => props.testID);
      expect(keys).toEqual([
        'battle-power-button-shadowStep',
        'battle-power-button-rend',
        'battle-power-button-mist',
        'battle-attack-button',
      ]);
      // À 360 dp, 328 dp utiles : la plus étroite fait au moins 72 dp, « Attaquer » la plus large.
      const gap = StyleSheet.flatten(pad.props.style).gap as number;
      const flexes = keys.map((id) => StyleSheet.flatten(screen.getByTestId(id).props.style).flex);
      const total = flexes.reduce((sum, flex) => sum + flex, 0);
      const widths = flexes.map((flex) => ((328 - gap * 3) * flex) / total);
      expect(Math.min(...widths)).toBeGreaterThanOrEqual(72);
      expect(Math.max(...widths)).toBe(widths[3]);
    },
  );

  and(/^la zone des touches garde sa hauteur de 112 dp$/u, () => {
    for (const power of ['shadowStep', 'rend', 'mist'] as const) {
      expect(StyleSheet.flatten(key(power).props.style).minHeight).toBe(112);
    }
  });

  and(
    /^chaque touche de pouvoir dit son coût en Élan, et « Instantané » pour un pouvoir instantané$/u,
    () => {
      expect(key('shadowStep')).toHaveTextContent("Pas de l'ombre3 ÉlanInstantané");
      expect(key('rend')).toHaveTextContent('Entaille1 ÉlanInstantané');
      expect(key('mist')).toHaveTextContent('Brume2 ÉlanInstantané');
    },
  );

  given(/^la phase du héros$/u, async () => {
    fight = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('bulwark', 'retaliation', 'holdFast'),
        heroWith({ momentum: 5 }),
      ),
    });
    expect(fight.battle().phase.kind).toBe('hero');
  });

  when(/^le joueur maintient le doigt sur la touche de Représailles$/u, async () => {
    // Le doigt reste posé 400 ms : le maintien commence, le doigt n'est pas encore levé.
    await act(async () => {
      holdGesture().handlers.onStart?.({});
      await Promise.resolve();
    });
  });

  then(/^son effet court s'affiche$/u, () => {
    const tip = within(screen.getByTestId('battle-power-tip'));
    expect(tip.getByText('Représailles')).toBeOnTheScreen();
    expect(tip.getByText(/contre-attaque/u)).toBeOnTheScreen();
  });

  and(/^Représailles n'est pas lancé, même si le doigt est relâché sur la touche$/u, async () => {
    await act(async () => {
      holdGesture().handlers.onFinalize?.({}, true);
      fireGestureHandler(getByGestureTestId(powerGestureTestId('retaliation')) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      await Promise.resolve();
    });
    expect(fight.battle().hero).toMatchObject({ momentum: 5 });
    expect(fight.battle().hero).not.toHaveProperty('retaliation');
    expect(screen.queryByTestId('battle-power-tip')).not.toBeOnTheScreen();
  });

  given(/^la Sentinelle a 2 Élan et Tenir bon équipé$/u, async () => {
    fight = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('bulwark', 'retaliation', 'holdFast'),
        heroWith({ momentum: 2 }),
      ),
    });
  });

  then(
    /^la touche de Tenir bon est visible mais indisponible et dit qu'il manque 1 Élan$/u,
    async () => {
      expect(key('holdFast')).toHaveTextContent('Tenir bonIl manque\n1 Élan');
      expect(key('holdFast').props.accessibilityState).toEqual({ disabled: true });
      expect(key('holdFast').props.accessibilityLabel).toBe(
        'Pouvoir : Tenir bon, 3 Élan, indisponible : il manque 1 Élan',
      );
      await fight.power(undefined, 'holdFast');
      expect(fight.battle().hero.momentum).toBe(2);
    },
  );

  // --- Le Rempart et Représailles ensemble ---

  let both: Battle;

  given(/^la Sentinelle a le Rempart actif$/u, () => {
    both = powerBattle('sentinel', { bulwark: true, momentum: 2 });
  });

  when(/^elle lance Représailles dans une phase du héros suivante$/u, () => {
    both = heroAct(both, cast('retaliation'), 1_000).battle;
  });

  then(/^les deux sont actifs ensemble, chacun avec son étiquette sous les PV$/u, async () => {
    expect(both.hero).toMatchObject({ bulwark: true, retaliation: true });
    await render(<HeroBar hero={both.hero} kind="sentinel" />);
    expect(screen.getByTestId('battle-bulwark-chip', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-power-chip-retaliation', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-hero-bar').props.accessibilityLabel).toBe(
      'La Sentinelle, PV 80 sur 80, Élan 0 sur 5, Rempart, Représailles actif',
    );
  });
};

// Les écrans seuls : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/arbre-de-pouvoirs.feature');
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
