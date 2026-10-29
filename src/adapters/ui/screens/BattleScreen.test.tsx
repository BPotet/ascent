// L'écran de combat (#31, combat complet #32), sur une vraie session de combat, l'horloge
// de combat manuelle et une graine fixée. Les touchers sont simulés par Gesture Handler
// (fireGestureHandler, qui complète toujours la séquence d'un geste) : la datation au début du
// toucher se prouve par une horloge qui avance à chaque étape du geste qui suit son début
// (ADR 0005, § 2). La scène dessinée est simulée : seul ce qui est hors de la scène est vérifié.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import {
  battleWith,
  enemyWith,
  heroWith,
  stunnedEnemy,
  targetOn,
  type BattleChange,
} from '../../../application/testing/battleBuilder';
import { seedFor } from '../../../application/testing/battleSeeds';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import { glintsOf } from '../../../domain/battle/glints';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderBattle, type BattleScreenTest } from '../testing/battleScreen';

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
          name: 'Goule, cible, 50 PV sur 50, garde 15 sur 15, intention : attaque',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', {
          name: 'Spectre, 35 PV sur 35, garde 10 sur 10, intention : attaque',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: /^Nécromancien, 45 PV sur 45, garde 12 sur 12/u }),
      ).toBeOnTheScreen();
      // Jamais le type de coup, jamais les dégâts d'une attaque (C2.3).
      expect(screen.queryByText(/coup simple|coup retardé|dégâts/u)).toBeNull();
      expect(screen.getByText('Garde 15/15')).toBeOnTheScreen();
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
          enemyWith(NECROMANCER, { guard: 8, intent: { category: 'guard', gain: 3 } }),
        ),
      });

      expect(
        screen.getByRole('button', {
          name: 'Nécromancien, 45 PV sur 45, garde 8 sur 12, intention : garde, plus 3',
        }),
      ).toBeOnTheScreen();
      expect(within(screen.getByTestId('enemy-necromancer')).getByText('+3')).toBeOnTheScreen();
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
      expect(test.battle().enemies[GHOUL]).toMatchObject({ hp: 40, guard: 3 });
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
        createBattle: battleWith(targetOn(SPECTER)),
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
