// L'écran de combat (#31, combat complet #32), sur une vraie session de combat, l'horloge
// de combat manuelle et une graine fixée. Les touchers sont simulés par Gesture Handler
// (fireGestureHandler, qui complète toujours la séquence d'un geste) : la datation au début du
// toucher se prouve par une horloge qui avance à chaque étape du geste qui suit son début
// (ADR 0005, § 2). La scène dessinée est simulée : seul ce qui est hors de la scène est vérifié.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { getAnimatedStyle } from 'react-native-reanimated';

import {
  battleWith,
  enemyWith,
  heroWith,
  stunnedEnemy,
  targetOn,
  type BattleChange,
} from '../../../application/testing/battleBuilder';
import { seedFor } from '../../../application/testing/battleSeeds';
import { FixedSeedSource } from '../../../application/testing/FixedSeedSource';
import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { ManualBattleClock } from '../../../application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../../application/testing/recordingBattleFeedback';
import { settableClock } from '../../../application/testing/settableClock';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import { BattleSession } from '../../../application/useCases/BattleSession';
import { glintsOf } from '../../../domain/battle/glints';
import { startTestBattle } from '../../../domain/battle/testing/testBattle';
import { Day } from '../../../domain/day/Day';
import { artPalette } from '../pixelArt/artPalette';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { preparedKinds } from '../battle/testing/fakeBattleCanvas';
import { renderBattle, type BattleScreenTest } from '../testing/battleScreen';
import { renderScreen } from '../testing/renderScreen';
import { silentHaptics } from '../testing/silentHaptics';
import { BattleScreen } from './BattleScreen';

type MeasureInWindow = (
  callback: (x: number, y: number, width: number, height: number) => void,
) => void;

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const GHOUL = 0;
const SPECTER = 1;
const NECROMANCER = 2;

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockClear());

/** Une garde qu'aucun coup ne brise : les parades et contre-attaques restent celles de #31. */
const sturdy = (enemy: number): BattleChange => enemyWith(enemy, { guard: 99 });
const onlyGhoul = battleWith(enemyWith(SPECTER, { hp: 0 }), enemyWith(NECROMANCER, { hp: 0 }));
const sturdyGhoul = battleWith(sturdy(GHOUL));

function pad() {
  return screen.getByTestId('battle-pad');
}

/** Les entrées de la scène (simulée), cachée au lecteur d'écran. */
function sceneProps(): Record<string, unknown> {
  return screen.getByTestId('battle-scene', { includeHiddenElements: true }).props as Record<
    string,
    unknown
  >;
}

function events(test: BattleScreenTest) {
  return test.snapshots.flatMap((snapshot) => snapshot.events);
}

describe('BattleScreen', () => {
  describe('hero phase (F1)', () => {
    it('shows the three enemies with their guard and their intent category, the Sentinel and her momentum', async () => {
      await renderBattle({ seed: seedFor({ ghoul: 'basic', specter: 'delayed' }) });

      expect(screen.getByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
      expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase du héros');
      expect(
        screen.getByRole('button', {
          name: 'Goule, cible, 50 PV sur 50, garde 30 sur 30, intention : attaque',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', {
          name: 'Spectre, 35 PV sur 35, garde 20 sur 20, intention : attaque',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: /^Nécromancien, 45 PV sur 45, garde 24 sur 24/u }),
      ).toBeOnTheScreen();
      // Jamais le type de coup, jamais les dégâts d'une attaque (C2.3).
      expect(screen.queryByText(/coup simple|coup retardé|dégâts/u)).toBeNull();
      expect(screen.getByText('Garde 30/30')).toBeOnTheScreen();
      expect(screen.getByText('50/50 PV')).toBeOnTheScreen();
      expect(screen.getByLabelText('La Sentinelle, PV 80 sur 80, Élan 1 sur 5')).toBeOnTheScreen();
      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Cible : Goule');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Goule' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Pouvoir : Rempart, 1 Élan' })).toBeEnabled();
    });

    it('shows the shield and the gain of the Guard intent of the Necromancer (C2.2)', async () => {
      await renderBattle({
        seed: 1,
        createBattle: battleWith(
          enemyWith(NECROMANCER, { guard: 8, intent: { category: 'guard', gain: 7 } }),
        ),
      });

      expect(
        screen.getByRole('button', {
          name: 'Nécromancien, 45 PV sur 45, garde 8 sur 24, intention : garde, plus 7',
        }),
      ).toBeOnTheScreen();
      expect(within(screen.getByTestId('enemy-necromancer')).getByText('+7')).toBeOnTheScreen();
    });

    it('starts the timed strike on release: « Frapper » replaces the buttons', async () => {
      const test = await renderBattle({ seed: 1 });

      await test.attack(10_100, 10_400);

      expect(events(test)).toContainEqual(
        expect.objectContaining({ type: 'strikeStarted', at: 10_400, enemy: GHOUL }),
      );
      expect(within(pad()).getByRole('button', { name: 'Frapper' })).toBeEnabled();
      expect(screen.queryByTestId('battle-attack-button')).toBeNull();
      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent(
        'Touche Frapper quand la barre atteint le trait.',
      );
      expect(screen.getByLabelText('La Sentinelle, PV 80 sur 80, Élan 2 sur 5')).toBeOnTheScreen();

      // Sans appui, la frappe part sans bonus ni pénalité (C6.1).
      await test.advanceTo(10_400 + 700 + 160 + 32);
      expect(test.battle().enemies[GHOUL]).toMatchObject({ hp: 40, guard: 18 });
      expect(screen.getByText('−10')).toBeOnTheScreen();
    });

    it('dates « Frapper » when the finger touches, and rewards a perfect strike (F4)', async () => {
      withMotion();
      const test = await renderBattle({ seed: 1, createBattle: sturdyGhoul });
      await test.attack(10_100, 10_180);

      // Chaque étape du geste après son début avance l'horloge de 100 ms : daté à la fin,
      // l'appui serait trop tard pour être parfait.
      await test.strike(10_180 + 700 + 40, 100);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Frappe parfaite');
      expect(screen.getByText('−15')).toBeOnTheScreen();
      expect(screen.queryByText(/critique/iu)).toBeNull();
      expect(test.sound.played).toContain('perfectStrike');
      expect(test.haptics.played).toContain('perfectStrike');
      expect(announce).toHaveBeenCalledWith('Frappe parfaite, 15 dégâts');
    });

    it('does not attack when the finger leaves the button before the release', async () => {
      const test = await renderBattle({ seed: 1 });

      await test.release('battle-attack', 10_100, 10_300, false);

      expect(test.battle().phase.kind).toBe('hero');
    });

    it('changes the target with a touch on the column of an enemy', async () => {
      const test = await renderBattle({ seed: 1 });

      await test.touchEnemy(SPECTER);

      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Cible : Spectre');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Spectre' })).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: /^Spectre, cible, 35 PV sur 35/u }),
      ).toBeOnTheScreen();
      expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/Phase/u));
    });

    it('targets, attacks and strikes with the screen reader', async () => {
      const test = await renderBattle({ seed: 1 });

      await act(async () => {
        fireEvent(screen.getByTestId('enemy-specter'), 'accessibilityAction', {
          nativeEvent: { actionName: 'activate' },
        });
      });
      await act(async () => {
        fireEvent(screen.getByTestId('battle-attack-button'), 'accessibilityAction', {
          nativeEvent: { actionName: 'activate' },
        });
      });
      await act(async () => {
        fireEvent(screen.getByTestId('battle-strike-button'), 'accessibilityAction', {
          nativeEvent: { actionName: 'activate' },
        });
      });

      expect(test.battle().phase).toMatchObject({ kind: 'heroStrike', enemy: SPECTER });
      expect(test.battle().phase).toMatchObject({ press: { judgement: 'miss' } });
    });
  });

  describe('momentum and power (C3)', () => {
    it('uses the Bulwark: 1 momentum, then the enemy phase', async () => {
      const test = await renderBattle({ seed: 1 });

      await test.power();

      expect(test.battle().hero).toMatchObject({ momentum: 0, bulwark: true });
      expect(test.sound.played).toContain('bulwark');
      expect(announce).toHaveBeenCalledWith('Rempart');
      expect(
        screen.getByLabelText('La Sentinelle, PV 80 sur 80, Élan 0 sur 5, Rempart'),
      ).toBeOnTheScreen();
      await test.runUntil(() => test.battle().phase.kind === 'transition');
    });

    it('keeps Pouvoir visible but unavailable without momentum, telling what it misses', async () => {
      await renderBattle({ seed: 1, createBattle: battleWith(heroWith({ momentum: 0 })) });

      expect(
        screen.getByRole('button', {
          name: 'Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan',
        }),
      ).toBeDisabled();
      expect(screen.getByText('Il manque 1 Élan')).toBeOnTheScreen();
    });
  });

  describe('guard break and stun (F5, P3b)', () => {
    it('stuns the Specter: « Cassure », « Étourdi ×1,5 » and the barred circle', async () => {
      const test = await renderBattle({
        seed: 1,
        // Le Spectre à 10 de garde (20 depuis #244) : la frappe sans appui la casse.
        createBattle: battleWith(targetOn(SPECTER), enemyWith(SPECTER, { guard: 10 })),
      });

      await test.attack();
      await test.runUntil(() => test.battle().enemies[SPECTER]!.stun !== null);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Cassure');
      expect(
        within(screen.getByTestId('enemy-specter')).getByText('Étourdi ×1,5'),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByTestId('enemy-specter')).getByTestId('enemy-specter-intent-skip', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Cassure, Spectre étourdi');
      expect(test.haptics.played).toContain('guardBreak');
      expect(sceneProps().enemies).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: 'specter', down: true })]),
      );
    });

    it('plays the lost action of a stunned enemy without transition nor pill (F5b)', async () => {
      const test = await renderBattle({
        seed: 1,
        createBattle: battleWith(stunnedEnemy(GHOUL), sturdy(SPECTER), targetOn(SPECTER)),
      });

      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'enemy');

      expect(test.battle().phase).toMatchObject({ step: { kind: 'lostAction', enemy: GHOUL } });
      expect(announce).toHaveBeenCalledWith("Goule, étourdie, n'agit pas");
      expect(screen.queryByTestId('battle-phase')).toBeNull();
      expect(screen.queryByTestId('phase-banner')).toBeNull();
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Spectre' })).toBeDisabled();
      expect(
        StyleSheet.flatten(screen.getByTestId('enemy-specter').props.style).opacity,
      ).toBeUndefined();
    });

    it('announces « À toi » without transition when every enemy lost its action (P15)', async () => {
      const test = await renderBattle({
        seed: 1,
        createBattle: battleWith(
          stunnedEnemy(GHOUL),
          stunnedEnemy(SPECTER),
          stunnedEnemy(NECROMANCER),
        ),
      });

      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'hero');

      expect(screen.getByTestId('phase-banner')).toHaveTextContent('À toiVise et attaque');
      expect(announce).toHaveBeenCalledWith('À toi. Vise et attaque.');
      expect(events(test).some((event) => event.type === 'phaseTransitionStarted')).toBe(false);
      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Cible : Goule · ×1,5');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Goule' })).toBeEnabled();
    });
  });

  describe('first use (F2, P9)', () => {
    it('shows the hero hint at the first battle, until it is closed', async () => {
      const keyValueStore = memoryKeyValueStore();
      await renderBattle({ seed: 1, hintsSeen: false, keyValueStore });

      const hint = screen.getByRole('button', {
        name: 'Première ascension. Touche un ennemi pour le viser, puis Attaquer.',
      });
      await act(async () => {
        fireEvent.press(hint);
      });

      expect(screen.queryByTestId('battle-hint-hero')).toBeNull();
      expect(keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.hero)).toBe('1');
    });

    it('shows the defense hint before the transition, which starts only when it is closed', async () => {
      const test = await renderBattle({ seed: 1, hintsSeen: false });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'defenseHint');

      expect(screen.getByTestId('battle-hint-defense')).toHaveTextContent(
        "Lis son gesteTouche Parade au moment de l'impact. Sceau rouge : Esquive.",
      );
      expect(screen.queryByTestId('phase-banner')).toBeNull();
      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeDisabled();

      await act(async () => {
        fireEvent.press(screen.getByTestId('battle-hint-defense'));
      });

      expect(screen.queryByTestId('battle-hint-defense')).toBeNull();
      expect(screen.getByTestId('phase-banner')).toHaveTextContent(
        'Phase ennemiePrépare ta parade',
      );
    });

    it('shows no hint once they are seen', async () => {
      await renderBattle({ seed: 1 });

      expect(screen.queryByTestId('battle-hint-hero')).toBeNull();
    });
  });

  describe('phase transition (P0, F0)', () => {
    it('announces the enemy phase and shows its buttons inactive, without hatching', async () => {
      const test = await renderBattle({ seed: 1 });

      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'transition');

      expect(screen.getByTestId('phase-banner')).toHaveTextContent(
        'Phase ennemiePrépare ta parade',
      );
      expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase ennemie');
      expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
      expect(within(pad()).getByRole('button', { name: 'Esquive' })).toBeDisabled();
      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeDisabled();
      expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
      expect(announce).toHaveBeenCalledWith('Phase ennemie. Prépare ta parade.');
      expect(test.sound.played).toContain('enemyPhase');
      expect(test.haptics.played).toEqual(['enemyPhase']);
    });

    it('announces the hero phase and shows « Attaquer » and « Pouvoir » inactive, at their place', async () => {
      const test = await renderBattle({ seed: 1, createBattle: onlyGhoul });
      await test.toWindUpOf(GHOUL);

      await test.runUntil(() => test.battle().phase.kind === 'transition');

      expect(screen.getByTestId('phase-banner')).toHaveTextContent('À toiVise et attaque');
      expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Goule' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Pouvoir : Rempart, 1 Élan' })).toBeDisabled();
      expect(announce).toHaveBeenCalledWith('À toi. Vise et attaque.');
      expect(test.sound.played.at(-1)).toBe('heroPhase');
      expect(test.haptics.played).not.toContain('heroPhase');
    });

    it('ignores a touch on a button during the transition, without off-balance', async () => {
      const test = await renderBattle({ seed: 1 });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'transition');

      await test.touchDefense('parry', test.clock.now() + 300);

      expect(test.battle().offBalanceUntil).toBeNull();
      expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
      expect(screen.queryByTestId('battle-off-balance')).toBeNull();
    });
  });

  describe('trimmed enemy phase (P1, P2)', () => {
    it('creates no new gesture from one snapshot to the next', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'double' }) });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'enemy');
      const tap = jest.spyOn(Gesture, 'Tap');

      await test.toWindUpOf(GHOUL);
      await test.advanceTo(test.attackStep()!.impacts[0]!.at);

      expect(test.snapshots.length).toBeGreaterThan(2);
      expect(tap).not.toHaveBeenCalled();
      tap.mockRestore();
    });

    it('hides the names, the HP figures and the line; the active enemy in front, the others faded', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'double' }) });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'enemy');

      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeEnabled();
      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('');
      expect(screen.queryByText('Goule')).toBeNull();
      expect(screen.queryByText(/\/50 PV/u)).toBeNull();

      await test.toWindUpOf(GHOUL);

      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('');
      expect(screen.queryByText(/double frappe/u)).toBeNull();
      expect(sceneProps().timeline).toMatchObject({
        enemy: GHOUL,
        impacts: test.attackStep()!.impacts.map((impact) => impact.at),
      });
      expect(StyleSheet.flatten(screen.getByTestId('enemy-specter').props.style).opacity).toBe(
        0.25,
      );
      expect(sceneProps().enemies).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: 'ghoul', active: true })]),
      );
      // Le type de coup se dit au lecteur d'écran au début de la préparation, jamais avant (C2.4).
      expect(announce).toHaveBeenCalledWith('Goule, double frappe');
      // Le lecteur d'écran garde les noms et les PV.
      expect(screen.getByRole('button', { name: /^Goule, 40 PV sur 50/u })).toBeOnTheScreen();
    });

    it('shows the red seal over an enemy that prepares a perilous attack, never during its step in, read by the screen reader', async () => {
      const test = await renderBattle({ seed: seedFor({ specter: 'perilous' }) });

      await test.attack();
      await test.runUntil(() => {
        const { phase } = test.battle();
        return (
          phase.kind === 'enemy' && phase.step.kind === 'stepIn' && phase.step.enemy === SPECTER
        );
      });
      expect(screen.queryByLabelText('Sceau rouge : coup imparable')).toBeNull();
      expect(sceneProps().timeline).toMatchObject({ kind: 'stepIn', attack: null });

      await test.toWindUpOf(SPECTER);

      const seal = screen.getByLabelText('Sceau rouge : coup imparable');
      expect(within(screen.getByTestId('enemy-specter')).getByTestId('peril-seal')).toBe(seal);
      expect(sceneProps().timeline).toMatchObject({ kind: 'attack', attack: 'perilous' });
      expect(announce).toHaveBeenCalledWith('Spectre, coup imparable, esquive');
      expect(test.sound.played).toContain('seal');
    });

    it('gives the scene the glints of the wind-up, computed by the domain (C2.10)', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'double' }) });

      await test.toWindUpOf(GHOUL);

      expect(sceneProps().timeline).toMatchObject({
        kind: 'attack',
        attack: 'double',
        glints: glintsOf(test.attackStep()!),
      });
      expect(sceneProps().spark).toBeNull();
      expect(sceneProps().hurtAt).toBeNull();
    });

    it('says that a perilous attack must be dodged when it is parried (P8)', async () => {
      const test = await renderBattle({ seed: seedFor({ specter: 'perilous' }) });
      const impact = await test.toWindUpOf(SPECTER);

      await test.touchDefense('parry', impact - 20);

      expect(screen.getByText('−8')).toBeOnTheScreen();
      expect(screen.getByTestId('battle-off-balance')).toHaveTextContent('Déséquilibré');
      expect(announce).toHaveBeenCalledWith('Coup imparable : la parade échoue, 8 dégâts');
    });
  });

  describe('defense buttons (P3 to P7)', () => {
    it('dates a press when the finger touches, not when it is released', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);

      // Chaque étape du geste après son début avance l'horloge de 100 ms : daté à la fin, l'appui
      // serait 250 ms après l'impact, raté.
      await test.touchDefense('parry', impact - 50, 100);

      expect(events(test)).toContainEqual(
        expect.objectContaining({ type: 'blowResolved', outcome: 'perfectParry', delta: -50 }),
      );
    });

    it('judges two simultaneous touches on Parade and Esquive, each one', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'double' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('dodge', impact - 10);
      await test.touchDefense('parry', impact - 10);

      expect(events(test)).toContainEqual(
        expect.objectContaining({ type: 'blowResolved', button: 'dodge' }),
      );
      expect(events(test)).toContainEqual(
        expect.objectContaining({ type: 'whiffed', button: 'parry' }),
      );
    });

    it('presses with the screen reader', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);
      await test.advanceTo(impact);

      await act(async () => {
        fireEvent(screen.getByTestId('battle-dodge-button'), 'accessibilityAction', {
          nativeEvent: { actionName: 'activate' },
        });
      });

      expect(announce).toHaveBeenCalledWith('Esquive, aucun dégât');
      expect(screen.queryByTestId('battle-feedback')).toBeNull();
    });

    it('rewards a perfect parry: « Parfait », freeze, flash, sound, vibration, then the counter', async () => {
      withMotion();
      const test = await renderBattle({
        seed: seedFor({ ghoul: 'basic' }),
        createBattle: sturdyGhoul,
      });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact - 50);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parfait');
      expect(sceneProps().spark).toEqual({ kind: 'gold', at: impact - 50 });
      expect(sceneProps().heroPose).toBe('counter');
      expect(sceneProps().heroPoseSince).toBe(impact - 50);
      expect(test.sound.played.at(-1)).toBe('perfectParry');
      expect(test.haptics.played.at(-1)).toBe('perfectParry');
      expect(test.battle().hitStop).toEqual({ at: impact - 50, until: impact + 40 });
      expect(screen.getByLabelText('La Sentinelle, PV 80 sur 80, Élan 3 sur 5')).toBeOnTheScreen();

      await test.advanceTo(impact + 40);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parfait · contre-attaque');
      expect(screen.getByText('−6')).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Contre-attaque, 6 dégâts');
      expect(screen.getByRole('button', { name: /^Goule, 34 PV sur 50/u })).toBeOnTheScreen();
    });

    it('breaks the guard with the counter: « Cassure », the only word, and « Étourdie ×1,5 » (P3b)', async () => {
      const test = await renderBattle({
        seed: seedFor({ ghoul: 'basic' }),
        createBattle: battleWith(
          enemyWith(GHOUL, { guard: 10 }),
          sturdy(SPECTER),
          targetOn(SPECTER),
        ),
      });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact - 20);
      await test.advanceTo(impact + 70);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent(/^Cassure$/u);
      expect(
        within(screen.getByTestId('enemy-ghoul')).getByText('Étourdie ×1,5'),
      ).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Cassure, Goule étourdie');
    });

    it('shows a good parry and a hit by their figures only, above the hero', async () => {
      withMotion();
      const test = await renderBattle({ seed: seedFor({ ghoul: 'double' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact + 120);
      expect(screen.getByText('−1')).toBeOnTheScreen();
      expect(screen.queryByTestId('battle-feedback')).toBeNull();
      expect(announce).toHaveBeenCalledWith('Parade, 1 dégât');
      expect(sceneProps().heroPose).toBe('parry');
      expect(sceneProps().spark).toEqual({ kind: 'steel', at: impact + 120 });

      await test.advanceTo(impact + 420 + 161 + 32);
      expect(screen.getByText('−2')).toBeOnTheScreen();
      expect(screen.queryByText(/Touché/u)).toBeNull();
      expect(sceneProps().hurtAt).toBe(impact + 420 + 160);
      expect(screen.getByLabelText('La Sentinelle, PV 77 sur 80, Élan 2 sur 5')).toBeOnTheScreen();
      expect(sceneProps().heroPose).toBe('hit');
    });

    it('greys and hatches the buttons while off-balance, still active, then clears them', async () => {
      const test = await renderBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact - 400);

      expect(screen.getByTestId('battle-pad-hatching')).toBeOnTheScreen();
      expect(screen.getByTestId('battle-off-balance')).toHaveTextContent('Déséquilibré');
      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeEnabled();
      expect(sceneProps().heroPose).toBe('off');
      expect(announce).toHaveBeenCalledWith('Trop tôt, déséquilibré');

      await test.touchDefense('dodge', impact - 200);
      expect(announce).toHaveBeenCalledWith('Déséquilibré');

      await test.advanceTo(impact + 251);
      expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
    });
  });

  describe('reduced motion', () => {
    reduceMotionInEachTest();

    it('shows the banner without slide, and a perfect parry without flash nor shake', async () => {
      const test = await renderBattle({
        seed: seedFor({ ghoul: 'basic' }),
        createBattle: sturdyGhoul,
      });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'transition');
      expect(screen.getByTestId('phase-banner-still')).toHaveTextContent(/^Phase ennemie/u);
      expect(screen.queryByTestId('phase-banner')).toBeNull();

      const impact = await test.toWindUpOf(GHOUL);
      await test.touchDefense('parry', impact - 30);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parfait');
      expect(sceneProps().hurtAt).toBeNull();
      expect(sceneProps().reducedMotion).toBe(true);
      expect(test.sound.played.at(-1)).toBe('perfectParry');
      expect(test.haptics.played.at(-1)).toBe('perfectParry');
    });
  });

  describe('end of the battle', () => {
    /** Des ennemis à 10 PV : une frappe chacun. */
    const weakEnemies = battleWith(
      enemyWith(GHOUL, { hp: 10 }),
      enemyWith(SPECTER, { hp: 10 }),
      enemyWith(NECROMANCER, { hp: 10 }),
    );

    async function win(test: BattleScreenTest): Promise<void> {
      for (let round = 0; test.battle().phase.kind !== 'over' && round < 8; round += 1) {
        await test.runUntil(() => ['hero', 'over'].includes(test.battle().phase.kind));
        if (test.battle().phase.kind === 'hero') await test.attack();
      }
      await test.runUntil(() => test.battle().phase.kind === 'over');
    }

    /** Sous la scène, plus rien : ni barre du héros, ni zone d'action, ni écran de fin. */
    function expectNothingUnderTheScene(): void {
      expect(screen.queryByTestId('battle-pad')).toBeNull();
      expect(screen.queryByTestId('battle-zone-line')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Rejouer' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Quitter' })).toBeNull();
      expect(screen.queryByTestId('trial-tuning-panel')).toBeNull();
      expect(screen.queryByTestId('battle-measures-panel')).toBeNull();
    }

    it('announces the victory and its respite, and shows nothing under the scene', async () => {
      const test = await renderBattle({
        seed: 3,
        createBattle: battleWith(
          enemyWith(GHOUL, { hp: 10 }),
          enemyWith(SPECTER, { hp: 0 }),
          enemyWith(NECROMANCER, { hp: 0 }),
          heroWith({ hp: 50 }),
        ),
      });

      await win(test);

      expect(announce).toHaveBeenCalledWith('Combat gagné.');
      expect(announce).toHaveBeenCalledWith('Répit, plus 8 PV');
      expect(screen.queryByText('Combat gagné')).toBeNull();
      expect(screen.queryByText(/Répit/u)).toBeNull();
      expectNothingUnderTheScene();
    });

    it('keeps the scene of a won battle, without the feedback words', async () => {
      const test = await renderBattle({ seed: 3, createBattle: weakEnemies });

      await win(test);

      expect(screen.getByTestId('battle-scene-frame')).toBeOnTheScreen();
      expect(screen.queryByTestId('battle-feedback')).toBeNull();
      expectNothingUnderTheScene();
    });

    it('shows the fallen hero when the battle is lost, and nothing under the scene', async () => {
      const test = await renderBattle({
        seed: seedFor({ ghoul: 'basic' }),
        createBattle: battleWith(heroWith({ hp: 4 })),
      });
      await test.toWindUpOf(GHOUL);

      await test.runUntil(() => test.battle().phase.kind === 'over');

      expect(announce).toHaveBeenCalledWith('Combat perdu.');
      expect(screen.queryByText('La Sentinelle est tombée.')).toBeNull();
      expect(sceneProps().heroPose).toBe('fallen');
      expectNothingUnderTheScene();
    });
  });
});

describe('BattleScreen: the heroine of the ascent in the scene (#140)', () => {
  it('gives the scene the heroine of the battle, the Sentinel by default', async () => {
    await renderBattle({ seed: 1 });

    expect(sceneProps().heroKind).toBe('sentinel');
  });

  it('gives the scene the Wanderer when she is the heroine of the battle', async () => {
    await renderBattle({
      seed: 1,
      createBattle: battleWith((battle) => ({ ...battle, heroKind: 'wanderer' })),
    });

    expect(sceneProps().heroKind).toBe('wanderer');
  });
});

describe('BattleScreen: the atlases prepared on demand (#38)', () => {
  it('prepares the enemies of the battle, its front line and its reserve, before they show', async () => {
    preparedKinds.length = 0;

    await renderBattle({
      seed: 1,
      createBattle: battleWith((battle) => ({ ...battle, reserve: ['ashBramble'] })),
    });

    expect(preparedKinds).toContainEqual(['ghoul', 'specter', 'necromancer', 'ashBramble']);
  });

  it('tells the scene that a boss has shifted to phase 2 (#38)', async () => {
    await renderBattle({ seed: 1, createBattle: battleWith(enemyWith(GHOUL, { phase2: true })) });

    const [ghoul] = sceneProps().enemies as { readonly phase2: boolean }[];
    expect(ghoul!.phase2).toBe(true);
  });
});

describe('BattleScreen on the tier backdrop (#176)', () => {
  /** Le cadre mesuré dans la fenêtre : `measureInWindow` des vues, simulé sous Jest. */
  function measuredAt(y: number, height: number) {
    return jest
      .spyOn(
        (View as unknown as { prototype: { measureInWindow: MeasureInWindow } }).prototype,
        'measureInWindow',
      )
      .mockImplementation((callback) => callback(0, y, 390, height));
  }

  afterEach(() => jest.restoreAllMocks());

  it('lets the tier backdrop show through the battle screen, which has no background of its own', async () => {
    await renderBattle({ seed: 1 });

    expect(StyleSheet.flatten(screen.getByTestId('battle-screen').props.style)).toMatchObject({
      backgroundColor: 'transparent',
    });
  });

  it('lets the tier backdrop show through « Préparation du combat… » too', async () => {
    const keyValueStore = memoryKeyValueStore();
    // La lecture des bulles d'aide ne répond pas : le combat reste en préparation.
    keyValueStore.get = () => new Promise<string | null>(() => undefined);
    const session = new BattleSession(
      {
        clock: new ManualBattleClock(0),
        seeds: new FixedSeedSource(1),
        sound: silentBattleSound(),
        haptics: silentBattleHaptics(),
        keyValueStore,
      },
      { createBattle: startTestBattle },
    );
    await renderScreen(<BattleScreen session={session} title="Étage 1" />, {
      clock: settableClock(Day.of(2026, 11, 1)),
      unitOfWork: new InMemoryUnitOfWork(),
      keyValueStore,
      haptics: silentHaptics(),
    });

    expect(screen.getByText('Préparation du combat…')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('battle-loading').props.style)).toMatchObject({
      backgroundColor: 'transparent',
    });
  });

  it('gives the frame of the scene, measured in the window, at each layout', async () => {
    const measure = measuredAt(150, 440);
    const onSceneArea = jest.fn();
    await renderBattle({ seed: 1, onSceneArea });

    await fireEvent(screen.getByTestId('battle-scene-frame'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 440 } },
    });

    expect(measure).toHaveBeenCalled();
    expect(onSceneArea).toHaveBeenLastCalledWith(150, 590);

    measure.mockImplementation((callback) => callback(0, 190, 390, 400));
    await fireEvent(screen.getByTestId('battle-scene-frame'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 400 } },
    });
    expect(onSceneArea).toHaveBeenLastCalledWith(190, 590);
  });

  it('still lays the scene out without anyone to tell its frame', async () => {
    measuredAt(150, 440);
    await renderBattle({ seed: 1 });

    await fireEvent(screen.getByTestId('battle-scene-frame'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 300 } },
    });

    expect(screen.getByTestId('battle-scene-frame')).toBeOnTheScreen();
  });
});

describe('BattleScreen: the veil of the enemy phase (#188)', () => {
  const hiddenToo = { includeHiddenElements: true } as const;
  /** Tout le cadre de la scène. */
  const wholeFrame = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

  function veil() {
    return screen.queryByTestId('enemy-phase-veil', hiddenToo);
  }

  function shaking() {
    return screen.getByTestId('battle-scene-shake', hiddenToo);
  }

  /** Le voile suit la pastille de l'en-tête : présent si et seulement si elle dit « Phase ennemie ». */
  function expectVeilWithThePill(): void {
    const pill = screen.queryByTestId('battle-phase');
    const enemy = pill !== null && /Phase ennemie/u.test(String(pill.props.children));
    if (enemy) expect(veil()).not.toBeNull();
    else expect(veil()).toBeNull();
  }

  it('lays no veil in the hero phase', async () => {
    await renderBattle({ seed: 1 });

    expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase du héros');
    expect(veil()).toBeNull();
  });

  it('lays no veil during the strike of the hero', async () => {
    const test = await renderBattle({ seed: 1 });

    await test.attack(10_100, 10_400);

    expect(test.battle().phase.kind).toBe('heroStrike');
    expect(veil()).toBeNull();
  });

  it('lays the veil with the defense hint, which is above it', async () => {
    const test = await renderBattle({ seed: 1, hintsSeen: false });
    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'defenseHint');

    expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase ennemie');
    expect(veil()).not.toBeNull();
    expect(within(shaking()).getByTestId('battle-hint-defense')).toBeOnTheScreen();
  });

  it('lays the veil at the same render as « Phase ennemie », the banner above it', async () => {
    const test = await renderBattle({ seed: 1 });
    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'transition');

    expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase ennemie');
    expect(veil()).not.toBeNull();
    expect(within(shaking()).getByTestId('phase-banner')).toBeOnTheScreen();
    expect(within(shaking()).getByTestId('battle-phase')).toBeOnTheScreen();
  });

  it('keeps the veil while an enemy prepares a perilous attack, its seal and the enemies above it', async () => {
    const test = await renderBattle({ seed: seedFor({ specter: 'perilous' }) });

    await test.toWindUpOf(SPECTER);

    expectVeilWithThePill();
    expect(veil()).not.toBeNull();
    expect(within(shaking()).getByLabelText('Sceau rouge : coup imparable')).toBeOnTheScreen();
    expect(within(shaking()).getByTestId('enemy-specter')).toBeOnTheScreen();
    expect(within(veil()!).queryAllByTestId(/./u, hiddenToo)).toHaveLength(0);
  });

  it('lifts the veil at the same render as « Phase du héros »', async () => {
    const test = await renderBattle({ seed: 1, createBattle: onlyGhoul });
    await test.toWindUpOf(GHOUL);
    expect(veil()).not.toBeNull();

    await test.runUntil(() => test.battle().phase.kind === 'transition');

    expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase du héros');
    expect(veil()).toBeNull();
  });

  it('lays no veil for a lost action just after the hero, without pill (C5.4)', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: battleWith(stunnedEnemy(GHOUL), sturdy(SPECTER), targetOn(SPECTER)),
    });

    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'enemy');

    expect(screen.queryByTestId('battle-phase')).toBeNull();
    expect(veil()).toBeNull();
  });

  it('lifts the veil when the battle is lost during the enemy phase', async () => {
    const test = await renderBattle({
      seed: seedFor({ ghoul: 'basic' }),
      createBattle: battleWith(heroWith({ hp: 4 })),
    });
    await test.toWindUpOf(GHOUL);
    expect(veil()).not.toBeNull();

    await test.runUntil(() => test.battle().phase.kind === 'over');

    expect(veil()).toBeNull();
    expect(screen.getByTestId('battle-scene-frame')).toBeOnTheScreen();
  });

  it('lifts the veil when the battle is won', async () => {
    const test = await renderBattle({
      seed: 3,
      createBattle: battleWith(
        enemyWith(GHOUL, { hp: 10 }),
        enemyWith(SPECTER, { hp: 0 }),
        enemyWith(NECROMANCER, { hp: 0 }),
      ),
    });

    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'over');

    expect(test.battle().phase).toMatchObject({ outcome: 'victory' });
    expect(veil()).toBeNull();
  });

  it('covers the whole fixed frame of the scene in ink at 38 %, under the shaking scene, hidden and untouchable', async () => {
    const test = await renderBattle({ seed: seedFor({ ghoul: 'basic' }) });
    await test.toWindUpOf(GHOUL);

    const frame = screen.getByTestId('battle-scene-frame');
    expect(within(frame).getByTestId('enemy-phase-veil', hiddenToo)).toBe(veil());
    expect(within(shaking()).queryByTestId('enemy-phase-veil', hiddenToo)).toBeNull();
    expect(
      within(frame)
        .getAllByTestId(/^(enemy-phase-veil|battle-scene-shake)$/u, hiddenToo)
        .map((view) => view.props.testID as string),
    ).toEqual(['enemy-phase-veil', 'battle-scene-shake']);
    expect(artPalette.roles.enemyPhaseVeil).toBe('rgba(6,7,12,0.38)');
    expect(StyleSheet.flatten(veil()!.props.style)).toMatchObject({
      ...wholeFrame,
      backgroundColor: 'rgba(6,7,12,0.38)',
    });
    expect(veil()).toHaveProp('pointerEvents', 'none');
    expect(veil()).toHaveProp('accessibilityElementsHidden', true);
    expect(veil()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(screen.queryByTestId('enemy-phase-veil')).toBeNull();
  });

  it('puts the enemies, the hero, the figures and the words of the scene above the veil', async () => {
    const test = await renderBattle({
      seed: seedFor({ ghoul: 'basic' }),
      createBattle: sturdyGhoul,
    });
    const impact = await test.toWindUpOf(GHOUL);

    await test.touchDefense('parry', impact - 50);
    await test.advanceTo(impact + 40);

    expect(veil()).not.toBeNull();
    const scene = within(shaking());
    expect(scene.getByTestId('battle-scene', hiddenToo)).toBeTruthy();
    expect(scene.getByTestId('enemy-ghoul')).toBeOnTheScreen();
    expect(scene.getByTestId('battle-feedback')).toHaveTextContent('Parfait · contre-attaque');
    expect(scene.getByText('−6')).toBeOnTheScreen();
  });

  it('keeps the header, the action track, the hero bar and the action zone out of the frame', async () => {
    const test = await renderBattle({
      seed: seedFor({ ghoul: 'basic' }),
      createBattle: battleWith((battle) => ({ ...battle, initiative: true })),
    });
    await test.toWindUpOf(GHOUL);

    const frame = within(screen.getByTestId('battle-scene-frame'));
    expect(veil()).not.toBeNull();
    expect(frame.queryByRole('header')).toBeNull();
    expect(frame.queryByTestId('battle-action-track')).toBeNull();
    expect(frame.queryByTestId('battle-pad')).toBeNull();
    expect(frame.queryByTestId('battle-zone-line')).toBeNull();
    expect(frame.queryByLabelText(/^La Sentinelle, PV/u)).toBeNull();
  });

  it('shakes the scene above the veil, never the fixed frame nor the veil', async () => {
    withMotion();
    const test = await renderBattle({ seed: seedFor({ ghoul: 'basic' }) });
    await test.toWindUpOf(GHOUL);

    expect(getAnimatedStyle(shaking()).transform).toBeDefined();
    expect(StyleSheet.flatten(shaking().props.style)).toMatchObject({
      ...wholeFrame,
      overflow: 'hidden',
    });
    const frame = StyleSheet.flatten(screen.getByTestId('battle-scene-frame').props.style);
    expect(frame.transform).toBeUndefined();
    expect(frame.overflow).toBeUndefined();
    expect(frame).toMatchObject({ flexBasis: 440, flexGrow: 0, flexShrink: 1, minHeight: 240 });
    expect(StyleSheet.flatten(veil()!.props.style).transform).toBeUndefined();
  });

  it('dims the action track with the veil, and gives it back with the hero phase', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        (battle) => ({ ...battle, initiative: true }),
        enemyWith(SPECTER, { hp: 0 }),
        enemyWith(NECROMANCER, { hp: 0 }),
      ),
    });
    const track = () => screen.getByTestId('battle-action-track');
    const shades = () => within(track()).queryAllByTestId('track-shade', hiddenToo);
    const opacities = () =>
      shades().map((shade) => StyleSheet.flatten(shade.props.style).opacity as number);
    expect(shades()).not.toHaveLength(0);
    expect(opacities().every((opacity) => opacity === 0.38)).toBe(true);

    await test.attack();
    await test.runUntil(() => test.battle().phase.kind === 'transition');

    expect(opacities()).toContain(0.68);
    expect(opacities()).not.toContain(0.38);

    await test.runUntil(() => test.battle().phase.kind === 'hero');

    expect(veil()).toBeNull();
    expect(shades()).not.toHaveLength(0);
    expect(opacities().every((opacity) => opacity === 0.38)).toBe(true);
  });

  it('lets the hero parry in the window exactly as before, the veil laid', async () => {
    const test = await renderBattle({
      seed: seedFor({ ghoul: 'basic' }),
      createBattle: sturdyGhoul,
    });
    const impact = await test.toWindUpOf(GHOUL);
    expect(veil()).not.toBeNull();

    await test.touchDefense('parry', impact - 50);

    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parfait');
    expect(events(test)).toContainEqual(
      expect.objectContaining({ type: 'blowResolved', outcome: 'perfectParry', delta: -50 }),
    );
  });

  describe('with reduced motion', () => {
    reduceMotionInEachTest();

    it('lays the same still veil, at once', async () => {
      const test = await renderBattle({ seed: 1 });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'transition');

      expect(screen.getByTestId('phase-banner-still')).toBeOnTheScreen();
      expect(StyleSheet.flatten(veil()!.props.style)).toMatchObject({
        ...wholeFrame,
        backgroundColor: 'rgba(6,7,12,0.38)',
      });
      expect(StyleSheet.flatten(shaking().props.style).transform).toBeUndefined();
    });
  });
});
