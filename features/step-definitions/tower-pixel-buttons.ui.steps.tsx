/**
 * Scénarios du combat de « Les boutons de l'onglet Tour en pixel art » (#120). Le pavé de combat
 * (`ActionPad`), les colonnes des ennemis (`EnemyColumn`) et la bulle d'aide (`BattleHintBubble`)
 * sont rendus seuls, comme dans `battleComponents.test.tsx`, avec les vues que la session de combat
 * leur donne. Les touchers passent par Gesture Handler (`fireGestureHandler`) ; la scène Skia n'en
 * fait pas partie.
 *
 * Correspondance des libellés :
 * - « l'habillage du bouton pixel » : cadre cranté (trait d'un pixel d'art, 4 coins coupés de la
 *   couleur du fond du pavé), fond or ou surface, libellé en police pixel 24 ;
 * - « appuyé » : 2 dp plus bas, arête haute assombrie, écrits par le geste de look sur le fil UI ;
 * - « hachuré » : `battle-pad-hatching` (déséquilibre) ou `battle-power-hatching` (pouvoir) ;
 * - « en cadre cranté » : un `PixelFrame`, reconnu à ses 4 coins (`pixel-frame-corner`).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { useState } from 'react';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import type { DefenseButton } from '../../src/domain/battle/BattleEvent';
import { ActionPad } from '../../src/adapters/ui/battle/ActionPad';
import { BattleHintBubble } from '../../src/adapters/ui/battle/BattleHintBubble';
import { EnemyColumn, enemyGestureTestId } from '../../src/adapters/ui/battle/EnemyColumn';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { artPixelSize } from '../../src/adapters/ui/pixelArt/artPixel';
import { pixelFont, textFont } from '../../src/adapters/ui/pixelArt/pixelTypography';
import type { ActionPad as Pad, EnemyView } from '../../src/adapters/ui/state/battleView';
import { battleColors } from '../../src/adapters/ui/theme/battleColors';

const { roles } = artPalette;
const hidden = { includeHiddenElements: true } as const;

/** L'instant du fil UI où le doigt se pose, et celui du fil JS (lecteur d'écran). */
const UI_NOW = 1_234;
const JS_NOW = 4_321;
const LINE = artPixelSize(2);
const SLOTS = sceneGeometry(390, 440, 2).enemies;

const GHOUL: EnemyView = {
  kind: 'ghoul',
  name: 'Goule',
  standing: true,
  target: false,
  hpRatio: 1,
  hpText: '50/50 PV',
  guardRatio: 1,
  guardText: 'Garde 15/15',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: { category: 'attack' },
  active: false,
  dimmed: false,
  tag: null,
  label: 'Goule, 50 PV sur 50, garde 15 sur 15, intention : attaque',
};
const VILLAGER: EnemyView = {
  ...GHOUL,
  kind: 'madVillager',
  name: 'Villageois fou',
  hpText: '30/30 PV',
  guardText: 'Garde 5/5',
  label: 'Villageois fou, 30 PV sur 30, garde 5 sur 5, intention : attaque',
};

const BULWARK = { power: 'bulwark', cost: 1, missing: 0 } as const;
const HERO_PAD: Pad = { kind: 'hero', locked: false, lock: null, power: BULWARK };
const DEFENSE_PAD: Pad = { kind: 'defense', locked: false, lock: null, offBalance: false };
const STRIKE_PAD: Pad = { kind: 'strike', since: 1_000, impactAt: 1_700, resolved: false };

/** Ce que le pavé et les colonnes transmettent à la session de combat. */
const calls = {
  onDefense: jest.fn<void, [DefenseButton, number]>(),
  onAttack: jest.fn<void, [number, number]>(),
  onPower: jest.fn<void, [number, number]>(),
  onStrike: jest.fn<void, [number]>(),
};

/** Le combat de la tour, réduit à ce que la story habille : les colonnes et le pavé. */
function TowerCombat({ pad, enemies }: { readonly pad: Pad; readonly enemies: EnemyView[] }) {
  const [target, setTarget] = useState(0);
  return (
    <View>
      {enemies.map((view, index) => (
        <EnemyColumn
          key={view.kind}
          view={{ ...view, target: index === target }}
          index={index}
          slot={SLOTS[index]!}
          sealed={false}
          float={null}
          uiNow={() => UI_NOW}
          now={() => JS_NOW}
          onTarget={setTarget}
        />
      ))}
      <ActionPad
        pad={pad}
        targetName={enemies[target]!.name!}
        uiNow={() => UI_NOW}
        now={() => JS_NOW}
        {...calls}
      />
    </View>
  );
}

function style(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style);
}

const LOOKS = {
  gold: { backgroundColor: roles.gold, borderColor: roles.ink },
  surface: { backgroundColor: roles.surface, borderColor: roles.line },
  strike: { backgroundColor: roles.goldBg, borderColor: roles.goldDark },
} as const;

/** La touche `testID` porte l'habillage du bouton pixel, dans sa variante `look`. */
function expectPixelKey(testID: string, look: keyof typeof LOOKS, label: string) {
  const key = screen.getByTestId(testID);
  expect(style(testID)).toMatchObject({ ...LOOKS[look], borderWidth: LINE });
  const corners = within(key).getAllByTestId('pixel-key-corner', hidden);
  expect(corners).toHaveLength(4);
  for (const corner of corners) {
    expect(StyleSheet.flatten(corner.props.style).backgroundColor).toBe(battleColors.background);
  }
  expect(within(key).getByText(label)).toHaveStyle({ fontFamily: pixelFont, fontSize: 24 });
  expect(within(key).getByText(label).props.numberOfLines).toBeUndefined();
}

/** Le cadre cranté `testID` : ses 4 coins coupés. */
function expectNotchedFrame(testID: string) {
  expect(
    within(screen.getByTestId(testID, hidden)).getAllByTestId('pixel-frame-corner', hidden),
  ).toHaveLength(4);
}

/** Le doigt se pose sur la touche dont le geste est `testId` (puis le toucher se termine). */
async function fingerDown(testId: string) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(testId), [{ state: State.BEGAN }]);
    await Promise.resolve();
  });
}

/**
 * Le doigt se pose (`State.BEGAN`) ou se lève (`State.END`) sur la touche dont le geste est
 * `testId`, sans aller plus loin. L'événement passe par le même canal que `fireGestureHandler`
 * (`DeviceEventEmitter`), mais `fireGestureHandler` ajoute toujours `ACTIVE` et `END` à un geste
 * Tap : le doigt serait levé, et la touche remonterait, avant la vérification.
 */
async function fingerState(testId: string, state: typeof State.BEGAN | typeof State.END) {
  const { handlerTag } = getByGestureTestId(testId);
  const oldState = state === State.BEGAN ? State.UNDETERMINED : State.BEGAN;
  await act(async () => {
    DeviceEventEmitter.emit('onGestureHandlerStateChange', { handlerTag, state, oldState });
    await Promise.resolve();
  });
}

/** Un toucher complet, posé puis relevé sur la touche. */
async function tap(testId: string) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(testId), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]);
    await Promise.resolve();
  });
}

let enemies: EnemyView[] = [];
let onClose = jest.fn();

beforeEach(() => {
  for (const spy of Object.values(calls)) spy.mockReset();
  enemies = [GHOUL, VILLAGER];
  onClose = jest.fn();
});

/**
 * Une image du fil UI simulé : sous Jest, Reanimated branche le style animé d'une vue
 * (`useAnimatedStyle`) une image après son montage (`scheduleOnUI`, un `setTimeout` de 0 ms).
 * Avant cette image, un appui ne change pas encore le style lu par `getAnimatedStyle`.
 */
async function uiFrame() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function showPad(pad: Pad) {
  await render(<TowerCombat pad={pad} enemies={enemies} />);
  await uiFrame();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // Les touches de combat (C1, C3, C4)

  given('un combat de la tour', () => {
    enemies = [GHOUL, VILLAGER];
  });

  when("c'est la phase du héros", () => showPad(HERO_PAD));

  then("« Pouvoir » et « Attaquer » ont l'habillage du bouton pixel, 112 dp de haut", () => {
    expectPixelKey('battle-power-button', 'surface', 'Pouvoir');
    expectPixelKey('battle-attack-button', 'gold', 'Attaquer');
    expect(style('battle-power-button').minHeight).toBe(112);
    expect(style('battle-attack-button').minHeight).toBe(112);
  });

  when("c'est la frappe en rythme", () => showPad(STRIKE_PAD));

  then(
    "« Frapper » a l'habillage du bouton pixel, sur toute la largeur, avec la même barre et le même trait",
    () => {
      expectPixelKey('battle-strike-button', 'strike', 'Frapper');
      expect(style('battle-strike-button')).toMatchObject({ flex: 1, minHeight: 112 });
      expect(within(screen.getByTestId('battle-pad')).getAllByRole('button')).toHaveLength(1);
      expect(style('battle-strike-mark').left).toBe('80%');
    },
  );

  when("c'est la phase ennemie", () => showPad(DEFENSE_PAD));

  then(
    "« Esquive » à gauche et « Parade » à droite ont l'habillage du bouton pixel, 112 dp de haut, sur une grille 1 / 1,45, à la même place",
    () => {
      expectPixelKey('battle-dodge-button', 'surface', 'Esquive');
      expectPixelKey('battle-parry-button', 'gold', 'Parade');
      expect(style('battle-pad')).toMatchObject({ flexDirection: 'row', gap: 12 });
      expect(
        within(screen.getByTestId('battle-pad'))
          .getAllByRole('button')
          .map((key) => key.props.accessibilityLabel),
      ).toEqual(['Esquive', 'Parade']);
      expect(style('battle-dodge-button')).toMatchObject({ flex: 1, minHeight: 112 });
      expect(style('battle-parry-button')).toMatchObject({ flex: 1.45, minHeight: 112 });
    },
  );

  and('chaque touche réagit dès que le doigt se pose', async () => {
    await fingerDown('battle-dodge');
    await fingerDown('battle-parry');

    expect(calls.onDefense.mock.calls).toEqual([
      ['dodge', UI_NOW],
      ['parry', UI_NOW],
    ]);
  });

  // L'état appuyé d'une touche de combat

  given("la phase ennemie d'un combat de la tour", () => showPad(DEFENSE_PAD));

  when('le joueur pose le doigt sur « Parade »', async () => {
    await fingerState('battle-parry', State.BEGAN);
    await fingerState('battle-parry-look', State.BEGAN);
  });

  then("la touche descend de 2 dp et son arête s'inverse, sans animation", () => {
    expect(getAnimatedStyle(screen.getByTestId('battle-parry-button'))).toMatchObject({
      transform: [{ translateY: LINE }],
    });
    expect(getAnimatedStyle(screen.getByTestId('battle-parry-edge', hidden))).toMatchObject({
      backgroundColor: roles.goldDark,
    });
    // Sans animation : le décalage est déjà complet, sans avancer le temps.
    expect(screen.getByTestId('battle-parry-button')).toHaveAnimatedStyle({
      transform: [{ translateY: LINE }],
    });
  });

  and("l'appui est daté à l'instant où le doigt se pose, comme aujourd'hui", () => {
    expect(calls.onDefense.mock.calls).toEqual([['parry', UI_NOW]]);
  });

  when('il lève le doigt', async () => {
    await fingerState('battle-parry-look', State.END);
    await fingerState('battle-parry', State.END);
  });

  then('la touche remonte', () => {
    expect(getAnimatedStyle(screen.getByTestId('battle-parry-button'))).toMatchObject({
      transform: [{ translateY: 0 }],
    });
    expect(getAnimatedStyle(screen.getByTestId('battle-parry-edge', hidden))).toMatchObject({
      backgroundColor: roles.light,
    });
    expect(calls.onDefense).toHaveBeenCalledTimes(1);
  });

  // Le choix de la cible (C2)

  given('la phase du héros', () => showPad(HERO_PAD));

  when("le joueur touche la colonne d'un ennemi", () => tap(enemyGestureTestId(1)));

  then(
    "sa plaque en cadre cranté prend un double cadre d'or, une flèche au-dessus de l'intention et son nom en gras",
    () => {
      expectNotchedFrame('enemy-madVillager-plate');
      expect(style('enemy-madVillager-plate').borderColor).toBe(roles.gold);
      expect(style('enemy-madVillager-ring').borderColor).toBe(roles.gold);
      expect(screen.getByTestId('enemy-madVillager-target-arrow', hidden)).toBeOnTheScreen();
      expect(screen.getByText('Villageois fou')).toHaveStyle({ fontFamily: textFont.bold });

      expectNotchedFrame('enemy-ghoul-plate');
      expect(style('enemy-ghoul-plate').borderColor).toBe(roles.line);
      expect(style('enemy-ghoul-ring').borderColor).toBe('transparent');
      expect(screen.queryByTestId('enemy-ghoul-target-arrow', hidden)).toBeNull();
      expect(screen.getByText('Goule')).not.toHaveStyle({ fontFamily: textFont.bold });
    },
  );

  and('toute la colonne reste touchable', async () => {
    const column = screen.getByTestId('enemy-madVillager');
    expect(column.props.accessibilityRole).toBe('button');
    expect(column.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(screen.getByRole('button', { name: 'Attaquer, cible : Villageois fou' })).toBeTruthy();

    await tap(enemyGestureTestId(0));
    expect(screen.getByTestId('enemy-ghoul').props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('button', { name: 'Attaquer, cible : Goule' })).toBeTruthy();
  });

  // La bulle d'aide du combat (C8)

  given("une bulle d'aide du combat affichée", async () => {
    await render(<BattleHintBubble kind="hero" onClose={onClose} />);
  });

  when('elle apparaît', () => {
    expect(screen.getByTestId('battle-hint-hero')).toBeOnTheScreen();
  });

  then('elle est en cadre cranté clair', () => {
    expectNotchedFrame('battle-hint-frame');
    expect(style('battle-hint-frame')).toMatchObject({
      backgroundColor: battleColors.coach,
      borderColor: roles.ink,
    });
    expect(screen.getByText('Première ascension')).toHaveStyle({ fontFamily: pixelFont });
    expect(screen.getByText('Touche pour fermer.', hidden)).toBeOnTheScreen();
  });

  and("elle se ferme au toucher, comme aujourd'hui", async () => {
    const bubble = screen.getByRole('button', {
      name: 'Première ascension. Touche un ennemi pour le viser, puis Attaquer.',
    });
    expect(bubble.props.accessibilityHint).toBe("Touche pour fermer l'aide.");
    await fireEvent.press(bubble);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Limite — temps mort de la transition de phase (C5)

  given('une transition de phase en cours', () => {
    enemies = [GHOUL, VILLAGER];
  });

  when("le pavé de combat s'affiche", () =>
    showPad({ ...DEFENSE_PAD, locked: true, lock: { since: JS_NOW, until: JS_NOW + 800 } }),
  );

  then(
    'les touches sont estompées, sans hachures, avec le cadenas et « Attends » en cadre cranté',
    () => {
      for (const key of ['battle-dodge-button', 'battle-parry-button']) {
        expect(style(key).opacity).toBe(0.4);
        expect(screen.getByTestId(key)).toBeDisabled();
      }
      expect(screen.queryByTestId('battle-pad-hatching', hidden)).toBeNull();
      expect(screen.queryByTestId('battle-power-hatching', hidden)).toBeNull();
      expectNotchedFrame('battle-lock-tag');
      expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
      expect(screen.queryByText('Déséquilibré')).toBeNull();
    },
  );

  // La règle (l'appui ignoré, sans déséquilibre) est celle de la session de combat
  // (`battle-prototype.feature`) : le pavé lui transmet l'appui tel qu'aujourd'hui, et n'affiche pas
  // de déséquilibre.
  and("un appui pendant ce temps est ignoré sans déséquilibre, comme aujourd'hui", async () => {
    await fingerState('battle-parry-look', State.BEGAN);
    await fingerDown('battle-parry');

    expect(calls.onDefense.mock.calls).toEqual([['parry', UI_NOW]]);
    // Inactive, la touche ne s'enfonce pas.
    expect(getAnimatedStyle(screen.getByTestId('battle-parry-button'))).toMatchObject({
      transform: [{ translateY: 0 }],
    });
    expect(screen.queryByTestId('battle-off-balance')).toBeNull();
    expect(screen.queryByTestId('battle-pad-hatching', hidden)).toBeNull();
  });

  // Limite — déséquilibre (C6)

  given('un appui raté', () => {
    enemies = [GHOUL, VILLAGER];
  });

  when('le joueur est déséquilibré', () => showPad({ ...DEFENSE_PAD, offBalance: true }));

  then('les touches sont grisées et hachurées, avec « Déséquilibré » en cadre cranté', () => {
    for (const [key, label] of [
      ['battle-dodge-button', 'Esquive'],
      ['battle-parry-button', 'Parade'],
    ] as const) {
      expect(style(key).backgroundColor).toBe(roles.surface);
      expect(within(screen.getByTestId(key)).getByText(label)).toHaveStyle({
        color: roles.muted,
      });
    }
    expect(screen.getByTestId('battle-pad-hatching', hidden)).toBeOnTheScreen();
    expectNotchedFrame('battle-off-balance-tag');
    expect(
      within(screen.getByTestId('battle-off-balance-tag')).getByTestId('battle-off-balance'),
    ).toHaveTextContent('Déséquilibré');
  });

  and("elles restent actives, comme aujourd'hui", async () => {
    expect(screen.getByRole('button', { name: 'Parade' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Esquive' })).toBeEnabled();
    await fingerDown('battle-dodge');
    expect(calls.onDefense.mock.calls).toEqual([['dodge', UI_NOW]]);
  });

  // Limite — pouvoir indisponible (C7)

  given("un pouvoir qui coûte plus d'Élan que le héros n'en a", () => {
    enemies = [GHOUL, VILLAGER];
  });

  when("la phase du héros s'affiche", () =>
    showPad({ ...HERO_PAD, power: { ...BULWARK, missing: 1 } }),
  );

  then(
    "« Pouvoir » est hachuré, écrit l'Élan qui manque (« Il manque 1 Élan ») et est annoncé indisponible",
    () => {
      const power = screen.getByRole('button', {
        name: 'Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan',
      });
      expect(power).toBeDisabled();
      expect(within(power).getByTestId('battle-power-hatching', hidden)).toBeTruthy();
      expect(within(power).getByText('Il manque 1 Élan')).toBeOnTheScreen();
      expect(style('battle-power-button').opacity).toBeUndefined();
      expect(screen.queryByTestId('battle-pad-hatching', hidden)).toBeNull();
    },
  );

  // Limite — accessibilité inchangée au combat

  given("le lecteur d'écran est actif", () => {
    enemies = [GHOUL, VILLAGER];
  });

  when('le joueur parcourt le combat de la tour', async () => {
    await showPad({ ...HERO_PAD, power: { ...BULWARK, missing: 1 } });
    await tap(enemyGestureTestId(1));
  });

  then(
    "les rôles et les libellés lus sont ceux d'aujourd'hui (« Attaquer, cible : Villageois fou », « Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan »)",
    () => {
      expect(
        screen.getAllByRole('button').map((button) => button.props.accessibilityLabel),
      ).toEqual([
        GHOUL.label,
        VILLAGER.label,
        'Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan',
        'Attaquer, cible : Villageois fou',
      ]);
      expect(screen.getByTestId('battle-attack-button').props.accessibilityState).toEqual({
        disabled: false,
      });
    },
  );

  and("aucun état n'est signalé par la couleur seule", () => {
    // La cible : la flèche et le gras ; le pouvoir indisponible : les hachures et l'Élan qui manque.
    expect(screen.getByTestId('enemy-madVillager-target-arrow', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Villageois fou')).toHaveStyle({ fontFamily: textFont.bold });
    expect(screen.getByTestId('battle-power-hatching', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Il manque 1 Élan')).toBeOnTheScreen();
  });
};

autoBindSteps([loadFeature('features/tower-pixel-buttons.feature')], [steps]);
