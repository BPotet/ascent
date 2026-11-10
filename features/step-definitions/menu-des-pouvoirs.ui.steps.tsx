/**
 * Scénarios `@ui` du « Menu des pouvoirs » (#270) : le pied de la tour et sa carte « Pouvoirs
 * équipés », le menu des pouvoirs, le Choix du héros, l'arbre de pouvoirs et sa fiche, avec les vrais
 * cas d'usage sur un stockage en mémoire. Comme la pile de l'app, le menu se pose sur le pied de la
 * tour, qui reste monté sans être affiché ; fermer l'application, c'est ouvrir de nouvelles sessions
 * sur le même stockage.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { PowerTreeScreen } from '../../src/adapters/ui/screens/PowerTreeScreen';
import { PowersMenuScreen } from '../../src/adapters/ui/screens/PowersMenuScreen';
import { TowerFootScreen, type OpenPowers } from '../../src/adapters/ui/screens/TowerFootScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  POWERS_CARD_SEEN_KEY,
  POWERS_MENU_SEEN_KEY,
} from '../../src/application/useCases/CampSession';
import { OATHS_KEY } from '../../src/application/useCases/oaths';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';
import { Day } from '../../src/domain/day/Day';
import { HabitName } from '../../src/domain/habit/HabitName';

const { roles } = artPalette;

type SetUp = ReturnType<typeof ascentSetUp>;

interface Options {
  powers: PowerKind[];
  remembered: Partial<Record<HeroKind, readonly PowerKind[]>>;
  shards: number;
  saved?: Ascent;
  menuSeen: boolean;
  cardSeen: boolean;
  holdCamp: boolean;
  /** Les Serments à prêter : sur quel pouvoir, et si son habitude a été faite hier. */
  oaths: { power: PowerKind; habit: string; kept: boolean }[];
}

let options: Options;
let setUp: SetUp;
let refusal: jest.Mock;
let onChoosePowers: jest.Mock;
let announce: jest.SpyInstance;
let focus: jest.SpyInstance;
let restoreSet: () => void = () => undefined;
/** Le pied de la tour est affiché (avec ou sans le menu par-dessus). */
let appOpen = false;

function close(): void {
  screen.unmount();
  appOpen = false;
}

const WANDERER_FULL: readonly PowerKind[] = ['shadowStep', 'rend', 'mist'];

function fresh(): Options {
  return {
    powers: [],
    remembered: {},
    shards: 500,
    menuSeen: true,
    cardSeen: true,
    holdCamp: false,
    oaths: [],
  };
}

/** Une app neuve, selon `options`. */
async function prepare(): Promise<void> {
  setUp = ascentSetUp({
    shards: options.shards,
    powers: options.powers,
    ...(options.saved !== undefined && { saved: options.saved }),
  });
  const { values } = setUp.keyValueStore;
  values.set(EQUIPPED_POWERS_KEY, JSON.stringify({ version: 1, heroes: options.remembered }));
  if (options.menuSeen) values.set(POWERS_MENU_SEEN_KEY, '1');
  if (options.cardSeen) values.set(POWERS_CARD_SEEN_KEY, '1');
  if (options.oaths.length > 0) {
    const oaths = await setUp.dependencies.unitOfWork.run(async ({ habits, checkIns }) => {
      const sworn = [];
      for (const { power, habit, kept } of options.oaths) {
        const added = await habits.add(HabitName.parse(habit), Day.of(2026, 10, 1));
        if (kept) {
          await checkIns.save({
            habitId: added.id,
            day: Day.of(2026, 10, 26),
            done: true,
            corrected: false,
          });
        }
        sworn.push({ power, habit: added.id, since: '2026-10-20' });
      }
      return sworn;
    });
    values.set(OATHS_KEY, JSON.stringify({ version: 1, oaths }));
  }
  if (options.holdCamp) {
    const get = setUp.keyValueStore.get;
    setUp.keyValueStore.get = (key) => (key === CAMP_KEY ? new Promise(() => undefined) : get(key));
  }
}

/** Le pied de la tour, et le menu des pouvoirs posé dessus quand il s'ouvre. */
function Stack({ opened }: { readonly opened: OpenPowers | null }) {
  const [menu, setMenu] = useState(opened);
  return (
    <>
      <View style={menu === null ? styles.shown : styles.hidden}>
        <TowerFootScreen
          session={setUp.session}
          camp={setUp.camp}
          onEnter={jest.fn()}
          onCamp={jest.fn()}
          onOpenPowers={setMenu}
          focused={menu === null}
        />
      </View>
      {menu === null ? null : (
        <PowersMenuScreen
          camp={setUp.camp}
          session={setUp.session}
          hero={menu.hero}
          from={menu.from}
          refusal={{ refusal }}
          onLeave={() => setMenu(null)}
          onCamp={jest.fn()}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({ shown: { flex: 1 }, hidden: { display: 'none' } });

async function openApp(opened: OpenPowers | null = null): Promise<void> {
  await setUp.session.load();
  await renderScreen(<Stack opened={opened} />, setUp.dependencies);
  appOpen = true;
  if (opened !== null) {
    await screen.findByTestId('powers-menu');
  } else if (!options.holdCamp) {
    await screen.findByTestId('equipped-powers-card');
  } else {
    await screen.findByTestId('tower-foot');
  }
}

/** L'app fermée, puis rouverte sur le même stockage. */
async function reopen(): Promise<void> {
  close();
  const values = setUp.keyValueStore.values;
  setUp = ascentSetUp({});
  for (const [key, value] of values) setUp.keyValueStore.values.set(key, value);
  await openApp();
}

async function showTree(hero: HeroKind): Promise<void> {
  await setUp.session.load();
  await renderScreen(
    <PowerTreeScreen
      camp={setUp.camp}
      hero={hero}
      onLeave={jest.fn()}
      onChoosePowers={onChoosePowers}
    />,
    setUp.dependencies,
  );
  await screen.findByTestId('power-tree');
}

/** Débloque `power` dans l'arbre de son héros. */
async function unlock(hero: HeroKind, power: PowerKind, price: number): Promise<void> {
  await showTree(hero);
  await fireEvent.press(screen.getByTestId(`power-node-${power}`));
  const sheet = within(await screen.findByTestId('power-sheet'));
  await fireEvent.press(sheet.getByRole('button', { name: `Débloquer pour ${price} Éclats` }));
  await waitFor(() => expect(setUp.camp.view().owned[hero]).toContain(power));
}

const card = () => screen.getByTestId('equipped-powers-card');
const cells = (hero: HeroKind) =>
  within(screen.getByTestId(`powers-card-row-${hero}`))
    .getAllByTestId(/^powers-card-(cell|free)-/u)
    .map((cell) => (cell.props.testID as string).replace('powers-card-cell-', ''));
const row = (power: PowerKind) => screen.getByTestId(`powers-menu-row-${power}`);
const checked = (power: PowerKind) => row(power).props.accessibilityState?.checked as boolean;
const tab = (hero: HeroKind) => screen.getByTestId(`powers-menu-tab-${hero}`);
const band = () => within(screen.getByTestId('powers-menu-band'));
const validateButton = () => screen.getByTestId('powers-menu-validate');
const borderOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style).borderColor as string;

async function openMenuFromCard(): Promise<void> {
  await fireEvent.press(card());
  await screen.findByTestId('powers-menu');
}

async function toggle(...powers: PowerKind[]): Promise<void> {
  for (const power of powers) await fireEvent.press(row(power));
}

async function validate(): Promise<void> {
  await act(async () => {
    await fireEvent.press(validateButton());
  });
}

async function startAscentButton() {
  const button = await screen.findByRole('button', { name: "Commencer l'ascension" });
  await waitFor(() =>
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ disabled: false })),
  );
  return button;
}

async function openHeroChoice(hero: HeroKind = 'sentinel'): Promise<void> {
  await openApp();
  await fireEvent.press(await startAscentButton());
  await act(async () => undefined);
  if (hero === 'wanderer') await fireEvent.press(screen.getByTestId('hero-choice-wanderer'));
}

const choiceCells = (hero: HeroKind) =>
  within(screen.getByTestId(`hero-choice-${hero}`))
    .getAllByTestId(/^equipped-power-(?!kindled|free)/u)
    .map((cell) => (cell.props.testID as string).replace('equipped-power-', ''));

/** L'écriture de la mémoire des pouvoirs équipés échoue, jusqu'à `restoreSet`. */
function failMemoryWrites(): void {
  const set = setUp.keyValueStore.set;
  setUp.keyValueStore.set = (key, value) =>
    key === EQUIPPED_POWERS_KEY ? Promise.reject(new Error('disk full')) : set(key, value);
  const store = setUp.keyValueStore;
  restoreSet = () => {
    store.set = set;
  };
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  beforeEach(() => {
    options = fresh();
    appOpen = false;
    refusal = jest.fn();
    onChoosePowers = jest.fn();
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
  });
  afterEach(() => {
    announce.mockRestore();
    focus.mockRestore();
  });

  // --- Les débuts communs ---

  given("les 3 places de l'Errante sont prises", async () => {
    options.powers = ['rend', 'mist'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
  });

  given("le camp n'est pas encore lu", async () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
    options.holdCamp = true;
    await prepare();
  });

  when('le joueur ouvre le pied de la tour', async () => {
    await openApp();
  });

  // Parcours A : il revient du menu ; T4 : il revient du camp.
  then('il revient au pied de la tour', async () => {
    if (!appOpen) {
      await openApp();
      return;
    }
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
    expect(card()).toBeOnTheScreen();
  });

  when('le joueur touche « Valider »', async () => {
    await validate();
  });

  when('il touche « Valider »', async () => {
    await validate();
  });

  // --- La carte (T1, T4 à T8) ---

  given("aucune ascension n'est en cours", () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist'];
  });

  and('la Sentinelle a pour pouvoirs équipés Rempart, Représailles et Tenir bon', () => {
    options.remembered = {
      ...options.remembered,
      sentinel: ['bulwark', 'retaliation', 'holdFast'],
    };
  });

  and("l'Errante a pour pouvoirs équipés Pas de l'ombre, Entaille et Brume", async () => {
    options.remembered = { ...options.remembered, wanderer: WANDERER_FULL };
    await prepare();
  });

  then(
    "sous la jauge, la carte « Pouvoirs équipés » montre une ligne par héros, avec son portrait, les icônes de ses pouvoirs équipés dans l'ordre de l'arbre et « 3 sur 3 »",
    async () => {
      await screen.findByTestId('gauge-card');
      expect(
        screen
          .getAllByTestId(/^(gauge-card|equipped-powers-card)$/u)
          .map(({ props }) => props.testID),
      ).toEqual(['gauge-card', 'equipped-powers-card']);
      for (const hero of ['sentinel', 'wanderer'] as const) {
        expect(
          screen.getByTestId(`powers-card-portrait-${hero}`, { includeHiddenElements: true }),
        ).toBeOnTheScreen();
        expect(
          within(screen.getByTestId(`powers-card-row-${hero}`)).getByText('3 sur 3'),
        ).toBeOnTheScreen();
      }
      expect(cells('sentinel')).toEqual(['bulwark', 'retaliation', 'holdFast']);
      expect(cells('wanderer')).toEqual(['shadowStep', 'rend', 'mist']);
    },
  );

  and('la carte porte le lien « Changer »', () => {
    expect(within(card()).getByText('Changer')).toBeOnTheScreen();
  });

  when('le joueur touche la carte', async () => {
    await fireEvent.press(card());
  });

  // T1 : le menu s'ouvre de la carte ; M11 : il s'ouvre, le camp encore en lecture.
  then("le menu des pouvoirs s'ouvre", async () => {
    if (options.holdCamp) {
      await openApp({ hero: 'sentinel', from: 'tower' });
      return;
    }
    expect(await screen.findByRole('header', { name: 'Pouvoirs équipés' })).toBeOnTheScreen();
  });

  given('la Sentinelle a 4 pouvoirs possédés et aucune mémoire des pouvoirs équipés', async () => {
    options.powers = ['retaliation', 'holdFast', 'shieldBash'];
    await prepare();
  });

  then(
    "la ligne de la Sentinelle montre la présélection : le Rempart, puis les pouvoirs suivants dans l'ordre de l'arbre, 3 au plus",
    () => {
      expect(cells('sentinel')).toEqual(['bulwark', 'shieldBash', 'retaliation']);
    },
  );

  and('le joueur vient de débloquer Rafale au camp', async () => {
    await unlock('wanderer', 'flurry', 60);
    close();
  });

  then('la carte dit en or que Rafale attend une place, avec « nouveau »', () => {
    const note = within(screen.getByTestId('powers-card-waiting-flurry'));
    expect(note.getByText('nouveau')).toBeOnTheScreen();
    const text = note.getByText('Rafale attend une place.');
    expect(StyleSheet.flatten(text.props.style).color).toBe(roles.gold);
  });

  and("le lecteur d'écran ajoute « Nouveau : Rafale attend une place »", () => {
    expect(card().props.accessibilityLabel).toContain('Nouveau : Rafale attend une place.');
  });

  when('le joueur ouvre le menu des pouvoirs puis revient au pied de la tour', async () => {
    await openMenuFromCard();
    expect(tab('wanderer').props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    await act(async () => undefined);
  });

  then('la carte ne dit plus « nouveau »', () => {
    expect(within(card()).queryByText('nouveau')).toBeNull();
    expect(screen.queryByTestId('powers-card-waiting-flurry')).not.toBeOnTheScreen();
  });

  given('une ascension en cours avec la Sentinelle, Représailles attisé', async () => {
    options.powers = ['retaliation', 'holdFast'];
    options.saved = startAscent(3, {
      hero: 'sentinel',
      powers: ['bulwark', 'retaliation', 'holdFast'],
      kindled: [{ power: 'retaliation', habit: 1 }],
    });
    await prepare();
  });

  then(
    'la carte ne montre que la Sentinelle, ses pouvoirs fixés, un cadenas et le lien « Voir »',
    () => {
      expect(screen.queryByTestId('powers-card-row-wanderer')).not.toBeOnTheScreen();
      expect(cells('sentinel')).toEqual(['bulwark', 'retaliation', 'holdFast']);
      expect(
        screen.getByTestId('powers-card-lock', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(within(card()).getByText('Voir')).toBeOnTheScreen();
      expect(within(card()).getByText("Fixés jusqu'à la fin de l'ascension.")).toBeOnTheScreen();
    },
  );

  and('Représailles garde sa bordure de braise', () => {
    expect(borderOf('powers-card-cell-retaliation')).toBe(roles.ember);
  });

  then('la carte est un bloc gris, comme la jauge', async () => {
    await screen.findByTestId('gauge-card');
    expect(
      screen.getByTestId('powers-card-loading', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('equipped-powers-card')).not.toBeOnTheScreen();
  });

  and("« Commencer l'ascension » attend, comme aujourd'hui", () => {
    expect(screen.getByRole('button', { name: "Commencer l'ascension" })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true }),
    );
  });

  given(
    "le joueur avait lancé sa dernière ascension avec l'Errante équipée de Entaille, Rafale et Brume",
    async () => {
      options.powers = ['rend', 'mist', 'flurry', 'ambush'];
      options.remembered = { wanderer: ['rend', 'flurry', 'mist'] };
      options.cardSeen = false;
      await prepare();
    },
  );

  when('il ouvre le pied de la tour pour la première fois après la mise à jour', async () => {
    await openApp();
  });

  then('la carte porte « nouveau »', () => {
    expect(within(screen.getByTestId('powers-card-head')).getByText('nouveau')).toBeOnTheScreen();
  });

  and("la ligne de l'Errante montre Entaille, Rafale et Brume : son choix n'est pas perdu", () => {
    expect(cells('wanderer')).toEqual(['rend', 'flurry', 'mist']);
  });

  when('il revient plus tard au pied de la tour', async () => {
    close();
    await openApp();
  });

  then('la carte ne porte plus « nouveau »', () => {
    expect(within(screen.getByTestId('powers-card-head')).queryByText('nouveau')).toBeNull();
  });

  // --- Le menu (M1 à M12) ---

  given(
    "l'Errante a 5 pouvoirs possédés, dont Pas de l'ombre, Entaille et Brume équipés",
    async () => {
      options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry', 'ambush'];
      options.remembered = { wanderer: WANDERER_FULL };
      await prepare();
    },
  );

  when('le joueur ouvre le menu des pouvoirs', async () => {
    await openApp();
    await openMenuFromCard();
  });

  then("l'écran est titré « Pouvoirs équipés », sous-titré « Pour ta prochaine ascension »", () => {
    expect(screen.getByRole('header', { name: 'Pouvoirs équipés' })).toBeOnTheScreen();
    expect(screen.getByText('Pour ta prochaine ascension')).toBeOnTheScreen();
  });

  and('les deux héros sont en onglets, chacun avec son compte « 3/3 »', () => {
    for (const hero of ['sentinel', 'wanderer'] as const) {
      expect(tab(hero).props.accessibilityRole).toBe('tab');
      expect(within(tab(hero)).getByText('3/3')).toBeOnTheScreen();
    }
  });

  and(
    "l'onglet de l'Errante liste ses 5 pouvoirs dans l'ordre de l'arbre, chacun avec son icône, son nom, son coût et son type",
    async () => {
      await fireEvent.press(tab('wanderer'));
      expect(
        screen.getAllByTestId(/^powers-menu-row-[a-zA-Z]+$/u).map(({ props }) => props.testID),
      ).toEqual([
        'powers-menu-row-shadowStep',
        'powers-menu-row-rend',
        'powers-menu-row-flurry',
        'powers-menu-row-mist',
        'powers-menu-row-ambush',
      ]);
      const flurry = within(row('flurry'));
      expect(
        flurry.getByTestId('power-icon-flurry', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(flurry.getByText('Rafale')).toBeOnTheScreen();
      expect(flurry.getByText('2 Élan · Frappe')).toBeOnTheScreen();
    },
  );

  and("toute la ligne d'un pouvoir coche ou décoche", async () => {
    expect(row('rend').props.accessibilityRole).toBe('checkbox');
    await toggle('rend');
    expect(checked('rend')).toBe(false);
    await toggle('rend');
    expect(checked('rend')).toBe(true);
  });

  given(
    "l'Errante a pour pouvoirs équipés Pas de l'ombre, Entaille et Brume, et possède Rafale",
    async () => {
      options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
      options.remembered = { wanderer: WANDERER_FULL };
      await prepare();
    },
  );

  when(
    "le joueur ouvre le menu des pouvoirs, décoche Pas de l'ombre, coche Rafale et touche « Valider »",
    async () => {
      await openApp();
      await openMenuFromCard();
      await fireEvent.press(tab('wanderer'));
      await toggle('shadowStep', 'flurry');
      await validate();
    },
  );

  and(
    "la ligne de l'Errante montre Entaille, Rafale et Brume, la case de Rafale bordée d'or",
    () => {
      expect(cells('wanderer')).toEqual(['rend', 'flurry', 'mist']);
      expect(borderOf('powers-card-cell-flurry')).toBe(roles.gold);
      expect(borderOf('powers-card-cell-rend')).not.toBe(roles.gold);
    },
  );

  and(
    "le lecteur d'écran annonce « 3 pouvoirs équipés pour l'Errante : Entaille, Rafale, Brume. »",
    () => {
      expect(announce).toHaveBeenCalledWith(
        "3 pouvoirs équipés pour l'Errante : Entaille, Rafale, Brume.",
      );
    },
  );

  and('le focus revient sur la carte', () => {
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  given(
    "le joueur a équipé l'Errante de Entaille, Rafale et Brume et touché « Valider »",
    async () => {
      options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
      options.remembered = { wanderer: WANDERER_FULL };
      await prepare();
      await openApp();
      await openMenuFromCard();
      await fireEvent.press(tab('wanderer'));
      await toggle('shadowStep', 'flurry');
      await validate();
    },
  );

  when("il ferme l'application puis la rouvre, sans avoir lancé d'ascension", async () => {
    expect(setUp.session.current()).toBeNull();
    await reopen();
  });

  then(
    "le pied de la tour et le menu des pouvoirs montrent toujours Entaille, Rafale et Brume pour l'Errante",
    async () => {
      expect(cells('wanderer')).toEqual(['rend', 'flurry', 'mist']);
      await openMenuFromCard();
      await fireEvent.press(tab('wanderer'));
      expect(['rend', 'flurry', 'mist'].every((power) => checked(power as PowerKind))).toBe(true);
      expect(checked('shadowStep')).toBe(false);
      await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    },
  );

  and(
    "au Choix du héros, l'Errante est présélectionnée avec Entaille, Rafale et Brume",
    async () => {
      await fireEvent.press(await startAscentButton());
      await act(async () => undefined);
      expect(choiceCells('wanderer')).toEqual(['rend', 'flurry', 'mist']);
    },
  );

  given("le joueur a décoché Pas de l'ombre et coché Rafale dans le menu", async () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
    await openApp();
    await openMenuFromCard();
    await fireEvent.press(tab('wanderer'));
    await toggle('shadowStep', 'flurry');
  });

  when('il touche le retour sans « Valider »', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
  });

  and("les pouvoirs équipés de l'Errante n'ont pas changé", () => {
    expect(setUp.camp.view().equipped.wanderer).toEqual(WANDERER_FULL);
    expect(cells('wanderer')).toEqual([...WANDERER_FULL]);
  });

  given(
    "le joueur a changé la sélection de la Sentinelle puis celle de l'Errante, en passant d'un onglet à l'autre",
    async () => {
      options.powers = ['retaliation', 'holdFast', 'shieldBash', 'rend', 'mist', 'flurry'];
      options.remembered = { wanderer: WANDERER_FULL };
      await prepare();
      await openApp();
      await openMenuFromCard();
      // La présélection de la Sentinelle : le Rempart, Coup de bouclier et Représailles.
      await toggle('bulwark', 'holdFast');
      await fireEvent.press(tab('wanderer'));
      await toggle('shadowStep', 'flurry');
    },
  );

  then('les deux sélections sont enregistrées', () => {
    expect(JSON.parse(setUp.keyValueStore.values.get(EQUIPPED_POWERS_KEY)!).heroes).toEqual({
      sentinel: ['shieldBash', 'retaliation', 'holdFast'],
      wanderer: ['rend', 'flurry', 'mist'],
    });
  });

  given("l'Errante a 3 pouvoirs cochés", async () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
    await openApp();
    await openMenuFromCard();
    await fireEvent.press(tab('wanderer'));
  });

  when('le joueur touche la ligne de Rafale, non cochée', async () => {
    expect(checked('flurry')).toBe(false);
    await toggle('flurry');
  });

  then('rien ne se coche et rien ne se décoche', () => {
    expect(checked('flurry')).toBe(false);
    for (const power of WANDERER_FULL) expect(checked(power)).toBe(true);
  });

  and("le menu dit « 3 sur 3 : retire d'abord un pouvoir pour équiper Rafale. »", () => {
    expect(
      band().getByText("3 sur 3 : retire d'abord un pouvoir pour équiper Rafale."),
    ).toBeOnTheScreen();
  });

  and('le téléphone vibre brièvement', () => {
    expect(refusal).toHaveBeenCalledTimes(1);
  });

  given("l'Errante a 5 pouvoirs possédés", async () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry', 'ambush'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
    await openApp();
    await openMenuFromCard();
    await fireEvent.press(tab('wanderer'));
  });

  when("le joueur décoche Pas de l'ombre", async () => {
    await toggle('shadowStep');
  });

  then("l'onglet de l'Errante dit « 2/3 », en or", () => {
    expect(within(tab('wanderer')).getByText('2/3')).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('powers-menu-tab-wanderer-badge').props.style)
        .backgroundColor,
    ).toBe(roles.gold);
  });

  and('le bouton dit « Choisis encore 1 pouvoir » et ne peut pas être touché', () => {
    expect(validateButton()).toHaveTextContent('Choisis encore 1 pouvoir');
    expect(validateButton()).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true }),
    );
  });

  given("la sélection de l'Errante est complète", async () => {
    options.powers = ['retaliation', 'holdFast', 'shieldBash', 'rend', 'mist', 'flurry'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
    await openApp();
    await openMenuFromCard();
  });

  and('celle de la Sentinelle ne compte que 2 pouvoirs sur 3', async () => {
    await toggle('bulwark');
  });

  when("le joueur regarde l'onglet de l'Errante", async () => {
    await fireEvent.press(tab('wanderer'));
  });

  then(
    "le bouton dit qu'il faut encore choisir 1 pouvoir pour la Sentinelle et ne peut pas être touché",
    () => {
      expect(validateButton()).toHaveTextContent('Sentinelle : choisis encore 1');
      expect(validateButton().props.accessibilityLabel).toBe(
        'Valider, indisponible : choisis encore 1 pouvoir pour la Sentinelle',
      );
      expect(validateButton()).toHaveProp(
        'accessibilityState',
        expect.objectContaining({ disabled: true }),
      );
    },
  );

  given("la Sentinelle n'a que Rempart et Représailles", async () => {
    options.powers = ['retaliation', 'rend', 'mist'];
    await prepare();
  });

  when('le joueur ouvre son onglet', async () => {
    await openApp();
    await openMenuFromCard();
  });

  then('ses deux pouvoirs sont marqués « Équipé », en vert, sans case à cocher', () => {
    for (const power of ['bulwark', 'retaliation'] as const) {
      const tag = screen.getByTestId(`powers-menu-row-${power}-tag`);
      expect(within(tag).getByText('Équipé')).toBeOnTheScreen();
      expect(StyleSheet.flatten(tag.props.style).backgroundColor).toBe(roles.doneBg);
    }
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });

  and("une ligne dit qu'ils sont équipés d'office et qu'à partir de 4, il choisit ses 3", () => {
    expect(
      band().getByText(
        "Tes 2 pouvoirs sont équipés d'office : rien à choisir. À partir de 4, tu choisis tes 3.",
      ),
    ).toBeOnTheScreen();
  });

  and(
    "si l'Errante a aussi 3 pouvoirs ou moins, le menu propose « Le camp » au lieu de « Valider »",
    () => {
      expect(screen.getByRole('button', { name: 'Le camp' })).toBeOnTheScreen();
      expect(screen.queryByTestId('powers-menu-validate')).not.toBeOnTheScreen();
    },
  );

  given('Représailles, équipé, est attisé par un Serment tenu hier', () => {
    options.powers = ['retaliation', 'holdFast', 'shieldBash', 'crushingBlow'];
    options.remembered = { sentinel: ['bulwark', 'retaliation', 'holdFast'] };
    options.oaths.push({ power: 'retaliation', habit: 'Courir', kept: true });
  });

  and("Tenir bon, équipé, a un Serment qui n'a pas été tenu hier", async () => {
    options.oaths.push({ power: 'holdFast', habit: 'Lire', kept: false });
    await prepare();
  });

  when("le joueur ouvre l'onglet de la Sentinelle", async () => {
    await openApp();
    await openMenuFromCard();
    await screen.findByText("Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.");
  });

  then(
    'Représailles est bordé de braise, avec la flamme, « Attisé · 2 → 1 Élan » et la ligne de son Serment',
    () => {
      expect(borderOf('powers-menu-row-retaliation')).toBe(roles.ember);
      const line = within(row('retaliation'));
      expect(
        line.getByTestId('powers-menu-row-retaliation-flame', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(line.getByText('Attisé · 2 → 1 Élan · Instantané')).toBeOnTheScreen();
      expect(
        line.getByText("Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension."),
      ).toBeOnTheScreen();
    },
  );

  and("Tenir bon a une ligne neutre qui dit ce qu'il faut faire pour demain", () => {
    const text = within(row('holdFast')).getByText(
      "Serment : « Lire » pas faite hier. Fais-la aujourd'hui, il sera attisé demain.",
    );
    expect(StyleSheet.flatten(text.props.style).color).toBe(roles.parchment);
  });

  given('Représailles a un Serment tenu hier', async () => {
    options.powers = ['retaliation', 'holdFast', 'shieldBash', 'crushingBlow'];
    options.remembered = { sentinel: ['bulwark', 'retaliation', 'holdFast'] };
    options.oaths.push({ power: 'retaliation', habit: 'Courir', kept: true });
    await prepare();
  });

  when('le joueur décoche Représailles', async () => {
    await openApp();
    await openMenuFromCard();
    await screen.findByText("Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.");
    await toggle('retaliation');
  });

  then("Représailles n'est plus marqué « Attisé »", () => {
    expect(within(row('retaliation')).queryByText(/^Attisé/u)).toBeNull();
    expect(borderOf('powers-menu-row-retaliation')).not.toBe(roles.ember);
  });

  and("sa ligne dit en bleu qu'il n'est pas attisé tant qu'il n'est pas équipé", () => {
    const text = within(row('retaliation')).getByText(
      'Serment tenu hier : équipé, il sera attisé (1 Élan).',
    );
    expect(StyleSheet.flatten(text.props.style).color).toBe(roles.blue);
  });

  given("l'enregistrement du choix va échouer", async () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
    await openApp();
    await openMenuFromCard();
    await fireEvent.press(tab('wanderer'));
    await toggle('shadowStep', 'flurry');
    failMemoryWrites();
  });

  then(
    "un bandeau dit « Ton choix n'a pas pu être enregistré. Il est gardé ici : réessaie. »",
    () => {
      expect(screen.getByTestId('powers-menu-band').props.role).toBe('alert');
      expect(
        band().getByText("Ton choix n'a pas pu être enregistré. Il est gardé ici : réessaie."),
      ).toBeOnTheScreen();
    },
  );

  and('le choix reste affiché tel quel', () => {
    expect(checked('flurry')).toBe(true);
    expect(checked('shadowStep')).toBe(false);
  });

  and('le bouton devient « Réessayer »', () => {
    expect(validateButton()).toHaveTextContent('Réessayer');
  });

  and('le focus va sur le bandeau', () => {
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  when("l'enregistrement réussit au toucher de « Réessayer »", async () => {
    restoreSet();
    await validate();
  });

  then('le joueur revient au pied de la tour, la carte à jour', () => {
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
    expect(cells('wanderer')).toEqual(['rend', 'flurry', 'mist']);
  });

  given("la Sentinelle n'avait que Rempart et Représailles", async () => {
    options.powers = ['retaliation', 'rend', 'mist', 'flurry'];
    options.remembered = { sentinel: ['bulwark', 'retaliation'], wanderer: WANDERER_FULL };
    await prepare();
  });

  and('le joueur vient de débloquer Tenir bon au camp', async () => {
    await unlock('sentinel', 'holdFast', 60);
    close();
  });

  when('il ouvre le menu des pouvoirs', async () => {
    await openApp();
    await openMenuFromCard();
  });

  then("Tenir bon est équipé, sa ligne bordée d'or avec « nouveau »", () => {
    expect(within(row('holdFast')).getByText('Équipé')).toBeOnTheScreen();
    expect(within(row('holdFast')).getByText('nouveau')).toBeOnTheScreen();
    expect(borderOf('powers-menu-row-holdFast')).toBe(roles.gold);
  });

  and("un bandeau dit « Tenir bon s'est équipé tout seul : il restait une place. »", () => {
    expect(
      band().getByText("Tenir bon s'est équipé tout seul : il restait une place."),
    ).toBeOnTheScreen();
  });

  and('le joueur vient de débloquer Rafale', async () => {
    await unlock('wanderer', 'flurry', 60);
    close();
  });

  when("il ouvre l'onglet de l'Errante", async () => {
    await openApp();
    await openMenuFromCard();
    expect(tab('wanderer').props.accessibilityState).toMatchObject({ selected: true });
  });

  then('la ligne de Rafale porte « nouveau », non cochée', () => {
    expect(within(row('flurry')).getByText('nouveau')).toBeOnTheScreen();
    expect(checked('flurry')).toBe(false);
  });

  and("un bandeau dit qu'il faut retirer un pouvoir pour lui faire une place", () => {
    expect(
      band().getByText(
        'Rafale est à toi, pas encore équipé : retire un pouvoir pour lui faire une place.',
      ),
    ).toBeOnTheScreen();
  });

  and("aucun pouvoir équipé n'a changé", () => {
    expect(setUp.camp.view().equipped.wanderer).toEqual(WANDERER_FULL);
    for (const power of WANDERER_FULL) expect(checked(power)).toBe(true);
  });

  given('une ascension en cours avec la Sentinelle', async () => {
    options.powers = ['retaliation', 'holdFast', 'shieldBash', 'rend', 'mist', 'flurry'];
    options.saved = startAscent(3, {
      hero: 'sentinel',
      powers: ['bulwark', 'retaliation', 'holdFast'],
    });
    await prepare();
  });

  when('le joueur ouvre le menu des pouvoirs depuis la carte', async () => {
    await openApp();
    await openMenuFromCard();
  });

  then('le sous-titre dit « Ascension en cours »', () => {
    expect(screen.getByText('Ascension en cours')).toBeOnTheScreen();
  });

  and("un bandeau dit que la Sentinelle garde ces pouvoirs jusqu'à la fin de l'ascension", () => {
    expect(
      band().getByText(
        "Ascension en cours. La Sentinelle garde ces pouvoirs jusqu'à sa fin. Tu pourras les changer pour la prochaine.",
      ),
    ).toBeOnTheScreen();
  });

  and('ses pouvoirs sont marqués « Fixé », sans case à cocher', () => {
    for (const power of ['bulwark', 'retaliation', 'holdFast'] as const) {
      expect(within(row(power)).getByText('Fixé')).toBeOnTheScreen();
    }
  });

  and('aucun pouvoir ne peut être coché ni décoché, dans aucun onglet', async () => {
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    await fireEvent.press(tab('wanderer'));
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.queryByTestId('powers-menu-validate')).not.toBeOnTheScreen();
  });

  then('des blocs gris remplacent les lignes', () => {
    expect(
      screen.getAllByTestId('powers-menu-skeleton', { includeHiddenElements: true }),
    ).toHaveLength(4);
    expect(screen.queryByTestId('powers-menu-row-bulwark')).not.toBeOnTheScreen();
  });

  and('« Valider » attend', () => {
    expect(validateButton()).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true }),
    );
  });

  given("le joueur n'a jamais ouvert le menu des pouvoirs", async () => {
    options.powers = ['retaliation', 'holdFast', 'shieldBash', 'rend', 'mist', 'flurry'];
    options.menuSeen = false;
    await prepare();
  });

  when("il l'ouvre", async () => {
    await openApp();
    await openMenuFromCard();
  });

  then(
    "un bandeau dit que ses pouvoirs se préparent désormais ici, avant chaque ascension, et qu'ils sont gardés",
    () => {
      expect(
        band().getByText(
          "Nouveau : tes pouvoirs se préparent ici, avant chaque ascension. Ils sont gardés d'une fois sur l'autre.",
        ),
      ).toBeOnTheScreen();
    },
  );

  and('ce bandeau ne revient pas aux ouvertures suivantes', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    await openMenuFromCard();
    expect(screen.queryByTestId('powers-menu-band')).not.toBeOnTheScreen();
    await reopen();
    await openMenuFromCard();
    expect(screen.queryByTestId('powers-menu-band')).not.toBeOnTheScreen();
  });

  // --- Le Choix du héros (H1 à H4, M13) ---

  given('la Sentinelle a 3 pouvoirs possédés', async () => {
    options.powers = ['retaliation', 'holdFast'];
    await prepare();
  });

  when('le joueur ouvre le Choix du héros', async () => {
    await openHeroChoice();
  });

  then(
    'la carte de la Sentinelle montre la rangée « Pouvoirs équipés · 3 sur 3 », en lecture seule',
    () => {
      expect(
        within(screen.getByTestId('hero-choice-sentinel')).getByText('Pouvoirs équipés · 3 sur 3'),
      ).toBeOnTheScreen();
      expect(screen.queryAllByRole('checkbox')).toEqual([]);
    },
  );

  and("il n'y a ni bouton « Changer les pouvoirs » ni panneau des pouvoirs équipés", () => {
    expect(screen.queryByText(/Changer les pouvoirs/u)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('equipped-powers-panel')).not.toBeOnTheScreen();
  });

  given("l'Errante a 4 pouvoirs possédés ou plus", async () => {
    options.powers = ['rend', 'mist', 'flurry'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
  });

  when("le joueur choisit l'Errante au Choix du héros", async () => {
    await openHeroChoice('wanderer');
  });

  then('un lien discret « Changer les pouvoirs » est proposé', () => {
    expect(
      screen.getByRole('button', {
        name: "Changer les pouvoirs de l'Errante : ouvre le menu des pouvoirs",
      }),
    ).toHaveTextContent('Changer les pouvoirs');
  });

  when('il le touche', async () => {
    await fireEvent.press(screen.getByTestId('hero-choice-change-powers'));
    await screen.findByTestId('powers-menu');
  });

  then(
    "le menu des pouvoirs s'ouvre sur l'onglet de l'Errante, avec le retour « Retour au Choix du héros »",
    () => {
      expect(tab('wanderer').props.accessibilityState).toMatchObject({ selected: true });
      expect(screen.getByRole('button', { name: 'Retour au Choix du héros' })).toBeOnTheScreen();
    },
  );

  when('il change la sélection et touche « Valider »', async () => {
    await toggle('shadowStep', 'flurry');
    await validate();
  });

  then('il revient au Choix du héros, qui montre la nouvelle rangée', () => {
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
    expect(screen.getByTestId('hero-choice')).toBeOnTheScreen();
    expect(choiceCells('wanderer')).toEqual(['rend', 'flurry', 'mist']);
  });

  given('la Sentinelle a 3 pouvoirs possédés ou moins', async () => {
    options.powers = ['retaliation', 'holdFast', 'rend', 'mist', 'flurry'];
    await prepare();
  });

  when('le joueur choisit la Sentinelle au Choix du héros', async () => {
    await openHeroChoice('sentinel');
  });

  then("le lien « Changer les pouvoirs » n'est pas proposé", () => {
    expect(screen.queryByTestId('hero-choice-change-powers')).not.toBeOnTheScreen();
  });

  given('Représailles, équipé, est attisé', async () => {
    options.powers = ['retaliation', 'holdFast'];
    options.oaths.push({ power: 'retaliation', habit: 'Courir', kept: true });
    await prepare();
  });

  then(
    "la case de Représailles est en braise, avec « 2 → 1 Élan » et la ligne du Serment, comme aujourd'hui",
    async () => {
      expect(
        await screen.findByText("Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension."),
      ).toBeOnTheScreen();
      const cell = screen.getByTestId('equipped-power-retaliation');
      expect(StyleSheet.flatten(cell.props.style).borderColor).toBe(roles.ember);
      expect(within(cell).getByText('2 → 1 Élan')).toBeOnTheScreen();
    },
  );

  given("l'enregistrement de l'ascension échoue au lancement", async () => {
    options.powers = ['rend', 'mist', 'flurry'];
    await prepare();
    failMemoryWrites();
  });

  when("le joueur continue avec l'Errante", async () => {
    await openHeroChoice('wanderer');
    await fireEvent.press(screen.getByRole('button', { name: "Continuer avec l'Errante" }));
    await act(async () => undefined);
  });

  then(
    "le message « Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie. » s'affiche",
    () => {
      expect(
        screen.getByText(
          "Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie.",
        ),
      ).toBeOnTheScreen();
      expect(setUp.session.current()).toBeNull();
    },
  );

  and('« Réessayer » relance, le choix gardé', async () => {
    restoreSet();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => undefined);
    expect(setUp.session.current()?.powers).toEqual(['shadowStep', 'rend', 'flurry']);
  });

  // --- Le Camp (D1, D2) ---

  when('le joueur débloque Rafale dans son arbre de pouvoirs', async () => {
    await unlock('wanderer', 'flurry', 60);
  });

  then(
    'le bandeau dit « Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au pied de la tour. »',
    () => {
      expect(
        screen.getByText(
          'Rafale débloqué. Tes 3 places sont prises : choisis tes pouvoirs au pied de la tour.',
        ),
      ).toBeOnTheScreen();
    },
  );

  and('il porte le bouton « Choisir mes pouvoirs »', () => {
    expect(
      screen.getByRole('button', {
        name: "Choisir mes pouvoirs : ouvre le menu des pouvoirs de l'Errante",
      }),
    ).toHaveTextContent('Choisir mes pouvoirs');
  });

  when('le joueur touche « Choisir mes pouvoirs »', async () => {
    await fireEvent.press(
      screen.getByRole('button', {
        name: "Choisir mes pouvoirs : ouvre le menu des pouvoirs de l'Errante",
      }),
    );
    expect(onChoosePowers).toHaveBeenCalledWith('wanderer');
    // La route pose le menu des pouvoirs sur le pied de la tour.
    close();
    await openApp({ hero: 'wanderer', from: 'tower' });
  });

  then("le menu des pouvoirs s'ouvre sur l'onglet de l'Errante", async () => {
    await screen.findByTestId('powers-menu-row-flurry');
    expect(tab('wanderer').props.accessibilityState).toMatchObject({ selected: true });
  });

  and('son retour ramène au pied de la tour', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
    expect(card()).toBeOnTheScreen();
  });

  given('Rafale est débloqué mais pas équipé', async () => {
    options.powers = ['rend', 'mist', 'flurry'];
    options.remembered = { wanderer: WANDERER_FULL };
    await prepare();
  });

  when("le joueur ouvre sa fiche dans l'arbre", async () => {
    await showTree('wanderer');
    await fireEvent.press(screen.getByTestId('power-node-flurry'));
    await screen.findByTestId('power-sheet');
  });

  then(
    'elle dit « Pas équipé : choisis-le au pied de la tour, dans « Pouvoirs équipés ». »',
    () => {
      expect(
        within(screen.getByTestId('power-sheet')).getByText(
          'Débloqué. Pas équipé : choisis-le au pied de la tour, dans « Pouvoirs équipés ».',
        ),
      ).toBeOnTheScreen();
    },
  );
};

// Les écrans seuls : `@session` a ses propres étapes.
const feature = loadFeature('features/menu-des-pouvoirs.feature');
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
