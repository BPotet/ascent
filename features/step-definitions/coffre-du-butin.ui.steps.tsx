/**
 * « Le coffre du butin » (#227) jusqu'à l'écran : le vrai écran de l'ascension (`AscentScreen`), sur
 * une vraie session, le combat gagné dans l'écran (le héros attaque à chacun de ses tours, sur
 * l'horloge de combat manuelle), avec la simulation du canevas du combat et de `SpriteCanvas`.
 *
 * Correspondance des libellés :
 * - « le coffre » : la scène `ChestStage` (`chest-stage`), fermé (`chest-closed`) ou ouvert
 *   (`chest-open`) ; « l'objet » : son image `item-image` et ses lignes (`found-item-reveal`) ;
 * - « touche l'écran » : le toucher « Passer l'ouverture du coffre » qui couvre l'écran ;
 * - « ferme l'application et reprend l'ascension » : une nouvelle session, lue dans le même
 *   stockage, et un nouvel écran.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import {
  chooseExit,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../src/domain/ascent/Ascent';
import { ITEMS, drawLoot, type ItemKind } from '../../src/domain/ascent/items';
import { unlockedItems } from '../../src/domain/ascent/unlocks';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { CHEST_OPEN_MS } from '../../src/adapters/ui/components/FoundItemPanel';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { ascentSetUp } from '../../src/adapters/ui/testing/ascent';
import { lootState } from '../../src/adapters/ui/testing/lootState';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { spyBattles, winShownBattle } from '../../src/adapters/ui/testing/winShownBattle';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const hidden = { includeHiddenElements: true } as const;
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const reduceMotion = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

const AXE_TEXT = 'Hache rouillée · Arme · Commun · Brise-garde ×1,1 · Initiative −1';

interface World {
  setUp: ReturnType<typeof ascentSetUp>;
  onLeave: jest.Mock;
}

let world: World;
/** L'écran de l'objet trouvé est déjà montré par l'étape « Étant donné » du scénario. */
let shown = false;

beforeEach(() => {
  shown = false;
  jest.useFakeTimers();
  announce.mockClear();
  reduceMotion.mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  reduceMotion.mockResolvedValue(false);
});

/** Le combat `kind` de l'étage 3 du palier 1. */
function before(kind: Encounter['kind']): Ascent {
  return {
    ...startAscent(42),
    floor: 3,
    encounter: { kind, enemies: ['ghoul'], battleSeed: 3 },
  };
}

/** Le premier état du flux du butin pour lequel le combat de `ascent` donne un objet de `wanted`. */
function lootFor(ascent: Ascent, wanted: (item: ItemKind) => boolean): number {
  for (let state = 0; ; state += 1) {
    const { value } = drawLoot(
      ascent.encounter!,
      ascent.gauge,
      ascent.equipment,
      state,
      unlockedItems(ascent.unlocks),
    );
    if (value !== null && wanted(value)) return state;
  }
}

/** L'écran de l'ascension sur `saved`, ouvert dans une session lue dans le stockage. */
async function open(saved: Ascent, spy = false) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  const battles = spy ? spyBattles(setUp.session) : null;
  const onLeave = jest.fn();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={onLeave}
    />,
    setUp.dependencies,
  );
  world = { setUp, onLeave };
  return battles;
}

/** Le combat de `saved` gagné dans l'écran. */
async function win(saved: Ascent): Promise<void> {
  const battles = await open(saved, true);
  await screen.findByTestId('battle-screen');
  await winShownBattle(battles!, world.setUp.clock);
  shown = true;
}

/** Le temps qui passe, pas de 100 ms par pas. */
async function advance(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
}

const withAxe = () => {
  const ascent = before('combat');
  return { ...ascent, lootRandom: lootFor(ascent, (item) => item === 'axe') };
};
const chest = () => screen.queryByTestId('chest-stage', hidden);
const closed = () => screen.queryByTestId('chest-closed', hidden);
const opened = () => screen.queryByTestId('chest-open', hidden);
const itemImage = () => screen.queryByTestId('item-image', hidden);
const button = (name: string) => screen.queryByRole('button', { name });
const revealOpacity = () =>
  StyleSheet.flatten(screen.getByTestId('found-item-reveal', hidden).props.style).opacity;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^un combat ordinaire gagné dont la chance d'objet donne la Hache rouillée$/u, async () => {
    await win(withAxe());
  });

  when(/^l'écran de l'objet trouvé s'affiche$/u, async () => {
    if (!shown) await win(withAxe());
    expect(world.setUp.session.current()!.foundItem).toBe('axe');
    expect(screen.getByTestId('ascent-item')).toBeOnTheScreen();
  });

  then(/^un coffre apparaît fermé et s'ouvre tout seul, en 600 ms environ$/u, async () => {
    expect(closed()).toHaveProp('sprite', 'chest-closed');
    expect(button('Équiper')).toBeNull();
    await advance(300);
    expect(closed()).toBeNull();
    expect(opened()).toHaveProp('sprite', 'chest-open');
    await advance(CHEST_OPEN_MS - 300);
    expect(chest()).toBeNull();
  });

  and(
    /^la Hache rouillée apparaît, comparée à l'objet que porte le héros, avec « Laisser » et « Équiper »$/u,
    () => {
      expect(itemImage()).toHaveProp('sprite', 'item-axe');
      expect(screen.getByText(AXE_TEXT)).toBeOnTheScreen();
      expect(screen.getByText('Tu portes : Épée courte · Initiative 0')).toBeOnTheScreen();
      expect(button('Laisser')).toBeOnTheScreen();
      expect(button('Équiper')).toBeOnTheScreen();
    },
  );

  when(/^le héros bat une Élite$/u, async () => {
    const ascent = before('elite');
    await win({
      ...ascent,
      lootRandom: lootFor(ascent, (item) => ITEMS[item].rarity === 'rare'),
    });
  });

  then(/^son objet garanti apparaît dans un coffre qui s'ouvre tout seul$/u, async () => {
    expect(world.setUp.session.current()!.foundItem).not.toBeNull();
    expect(closed()).toBeOnTheScreen();
    expect(button('Équiper')).toBeNull();
    await advance(CHEST_OPEN_MS + 100);
    expect(chest()).toBeNull();
    expect(button('Équiper')).toBeOnTheScreen();
  });

  and(
    /^sa rareté se lit comme avant \(Rare, ou Épique en losanges, au mot et à la couleur\)$/u,
    async () => {
      const item = world.setUp.session.current()!.foundItem!;
      expect(
        screen.getByText(new RegExp(` · ${item === 'flamberge' ? 'Épique' : 'Rare'} · `)),
      ).toBeOnTheScreen();
      // Un Rare n'a pas de ligne en losanges ; l'Épique, sa ligne à la couleur Épique (#195).
      expect(screen.queryByText(/◆/)).toBeNull();
      screen.unmount();
      await open({
        ...before('elite'),
        encounter: null,
        exits: [{ kind: 'combat', groupSize: 2 }],
        foundItem: 'flamberge',
      });
      expect(screen.getByText('◆◆◆ Épique')).toHaveStyle({
        color: artPalette.roles.rarityEpic,
      });
    },
  );

  given(/^le coffre est en train de s'ouvrir$/u, async () => {
    await win(withAxe());
    await advance(200);
    expect(chest()).toBeOnTheScreen();
  });

  when(/^le joueur touche l'écran$/u, async () => {
    await fireEvent.press(screen.getByRole('button', { name: "Passer l'ouverture du coffre" }));
  });

  then(/^le coffre est ouvert tout de suite et l'objet est affiché$/u, () => {
    expect(chest()).toBeNull();
    expect(itemImage()).toHaveProp('sprite', 'item-axe');
    expect(revealOpacity()).toBe(1);
    expect(button('Équiper')).toBeOnTheScreen();
  });

  and(/^ce toucher n'équipe ni ne laisse l'objet$/u, () => {
    expect(world.setUp.session.current()).toMatchObject({
      foundItem: 'axe',
      equipment: { weapon: null },
    });
  });

  given(/^un combat ordinaire gagné où la chance d'objet ne donne rien$/u, async () => {
    const ascent = before('combat');
    await win({ ...ascent, lootRandom: lootState(ascent, false) });
  });

  then(/^aucun coffre n'apparaît et l'offre de bienfaits s'affiche, comme avant$/u, () => {
    expect(world.setUp.session.current()!.foundItem).toBeNull();
    expect(chest()).toBeNull();
    expect(screen.getByTestId('ascent-boons')).toBeOnTheScreen();
  });

  and(/^au boss ou au Feu de camp, aucun coffre n'apparaît non plus$/u, async () => {
    const boss = { ...before('boss'), floor: 6 };
    expect(
      Array.from(
        { length: 50 },
        (_, state) => drawLoot(boss.encounter!, boss.gauge, boss.equipment, state).value,
      ).every((item) => item === null),
    ).toBe(true);
    const camp = chooseExit(
      { ...before('combat'), encounter: null, exits: [{ kind: 'campfire', groupSize: null }] },
      0,
    );
    expect(camp.foundItem).toBeNull();
    await open(camp);
    expect(screen.queryByTestId('ascent-item')).toBeNull();
    expect(chest()).toBeNull();
  });

  given(/^le joueur voit un objet trouvé dans un coffre ouvert$/u, async () => {
    await win(withAxe());
    await advance(CHEST_OPEN_MS + 100);
    expect(itemImage()).toHaveProp('sprite', 'item-axe');
  });

  when(/^il ferme l'application et reprend l'ascension$/u, async () => {
    const stored = world.setUp.keyValueStore.values.get(ASCENT_KEY)!;
    screen.unmount();
    announce.mockClear();
    await open((JSON.parse(stored) as { ascent: Ascent }).ascent);
  });

  then(/^il retrouve le même objet, dans le coffre déjà ouvert, sans animation$/u, () => {
    expect(world.setUp.session.current()!.foundItem).toBe('axe');
    expect(chest()).toBeNull();
    expect(itemImage()).toHaveProp('sprite', 'item-axe');
    expect(revealOpacity()).toBe(1);
    expect(button('Équiper')).toBeOnTheScreen();
  });

  given(/^le mouvement réduit est activé$/u, () => {
    reduceMotion.mockResolvedValue(true);
  });

  then(/^le coffre ne bouge pas : il est montré ouvert, l'objet en fondu$/u, async () => {
    expect(closed()).toBeNull();
    expect(opened()).toBeOnTheScreen();
    const still = StyleSheet.flatten(chest()!.props.style).transform;
    await advance(300);
    expect(StyleSheet.flatten(chest()!.props.style).transform).toEqual(still);
    expect(still).toEqual([{ translateX: 0 }]);
    await advance(CHEST_OPEN_MS - 300);
    expect(itemImage()).toBeOnTheScreen();
    expect(revealOpacity()).toBeLessThan(1);
    await advance(100);
    expect(revealOpacity()).toBe(1);
  });

  when(/^l'écran de l'objet trouvé s'affiche avec le lecteur d'écran$/u, async () => {
    await win(withAxe());
    await advance(CHEST_OPEN_MS);
  });

  then(/^il annonce « Coffre ouvert », puis le nom de l'objet, sa rareté et son effet$/u, () => {
    expect(announce).toHaveBeenCalledWith(
      'Coffre ouvert. Hache rouillée, Commun, Brise-garde ×1,1, Initiative −1.',
    );
    // L'image du coffre n'est pas lue à part.
    expect(screen.queryByTestId('chest-stage')).toBeNull();
    expect(screen.queryByTestId('item-image')).toBeNull();
  });

  and(/^les boutons « Laisser » et « Équiper » sont lus comme avant$/u, () => {
    expect(button('Laisser')).toBeOnTheScreen();
    expect(button('Équiper')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
  });
};

const feature = loadFeature('features/coffre-du-butin.feature');
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
