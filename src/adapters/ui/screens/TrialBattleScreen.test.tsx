// L'écran du combat d'essai (#31), sur une vraie session de combat, l'horloge de combat manuelle
// et une graine fixée. Les touchers sont simulés par Gesture Handler (fireGestureHandler, qui
// complète toujours la séquence d'un geste) : la datation au début du toucher se prouve par une
// horloge qui avance à chaque étape du geste qui suit son début (ADR 0005, § 2).
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { seedFor } from '../../../application/testing/trialBattleSeeds';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import { TRIAL_TUNING_KEY } from '../../../application/useCases/trialTuning';
import { startTrialBattle, type Battle } from '../../../domain/battle/Battle';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderTrialBattle, type TrialBattleTest } from '../testing/trialBattle';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const GHOUL = 0;
const SPECTER = 1;

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockClear());

function changed(change: (battle: Battle) => Battle) {
  return (options: Parameters<typeof startTrialBattle>[0]) => {
    const update = startTrialBattle(options);
    return { ...update, battle: change(update.battle) };
  };
}

const specterDown = changed((battle) => ({
  ...battle,
  enemies: battle.enemies.map((enemy, index) => (index === SPECTER ? { ...enemy, hp: 0 } : enemy)),
}));

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

/** La case vide de la phase du héros, cachée au lecteur d'écran. */
function emptySlot() {
  return screen.getByTestId('battle-empty-slot', { includeHiddenElements: true });
}

describe('TrialBattleScreen', () => {
  describe('hero phase (F1)', () => {
    it('shows the trial battle, its two enemies, the Sentinel and « Attaquer » on the right', async () => {
      await renderTrialBattle({ seed: seedFor({ ghoul: 'basic', specter: 'delayed' }) });

      expect(screen.getByRole('header', { name: "Combat d'essai" })).toBeOnTheScreen();
      expect(screen.getByTestId('battle-phase')).toHaveTextContent('Phase du héros');
      expect(
        screen.getByRole('button', {
          name: 'Goule, cible, PV 20 sur 20, intention : coup simple, 5 dégâts',
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', {
          name: 'Spectre, PV 14 sur 14, intention : coup retardé, 6 dégâts',
        }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('La Sentinelle, PV 80 sur 80')).toHaveTextContent(
        'La SentinellePV 80/80',
      );
      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Cible : Goule');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Goule' })).toBeOnTheScreen();
    });

    it('leaves the left cell empty: no control, nothing read, no « Pouvoir » nor « Élan »', async () => {
      await renderTrialBattle({ seed: 1 });

      expect(emptySlot()).toBeOnTheScreen();
      expect(screen.queryByTestId('battle-empty-slot')).toBeNull();
      expect(within(emptySlot()).queryAllByText(/./u, { includeHiddenElements: true })).toEqual([]);
      expect(within(pad()).getAllByRole('button')).toHaveLength(1);
      expect(screen.queryByText(/Pouvoir/u)).toBeNull();
      expect(screen.queryByText(/Élan/u)).toBeNull();
      expect(screen.queryByText(/Palier|Étage|Or\b|Pause/u)).toBeNull();
    });

    it('validates « Attaquer » on release, when the finger is still on the button', async () => {
      const test = await renderTrialBattle({ seed: 1 });

      await test.attack(10_100, 10_400);

      expect(test.battle().enemies[GHOUL]!.hp).toBe(10);
      expect(test.snapshots.flatMap((snapshot) => snapshot.events)).toContainEqual(
        expect.objectContaining({ type: 'heroAttacked', at: 10_400, enemy: GHOUL, damage: 10 }),
      );
    });

    it('does not attack when the finger leaves the button before the release', async () => {
      const test = await renderTrialBattle({ seed: 1 });

      await test.release('battle-attack', 10_100, 10_300, false);

      expect(test.battle().enemies[GHOUL]!.hp).toBe(20);
      expect(test.battle().phase.kind).toBe('hero');
    });

    it('changes the target with a touch on the column of an enemy', async () => {
      const test = await renderTrialBattle({ seed: 1 });

      await test.touchEnemy(SPECTER);

      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Cible : Spectre');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Spectre' })).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: /^Spectre, cible, PV 14 sur 14/u }),
      ).toBeOnTheScreen();
      expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/Phase/u));
    });

    it('targets and attacks with the screen reader', async () => {
      const test = await renderTrialBattle({ seed: 1 });

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

      expect(test.battle().enemies[SPECTER]!.hp).toBe(4);
    });
  });

  describe('first use (F2, P9)', () => {
    it('shows the hero hint at the first battle, until it is closed', async () => {
      const keyValueStore = memoryKeyValueStore();
      await renderTrialBattle({ seed: 1, hintsSeen: false, keyValueStore });

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
      const test = await renderTrialBattle({ seed: 1, hintsSeen: false });
      await test.attack();
      await test.advanceTo(test.clock.now() + 500);

      expect(screen.getByTestId('battle-hint-defense')).toHaveTextContent(
        "Lis son gesteQuand il frappe, touche Parade. S'il porte un sceau rouge, touche Esquive.",
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
      await renderTrialBattle({ seed: 1 });

      expect(screen.queryByTestId('battle-hint-hero')).toBeNull();
    });
  });

  describe('phase transition (P0, F0)', () => {
    it('announces the enemy phase and shows its buttons inactive, without hatching', async () => {
      const test = await renderTrialBattle({ seed: 1 });

      await test.attack();
      await test.advanceTo(test.clock.now() + 500);

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

    it('announces the hero phase and shows « Attaquer » inactive, alone, at its place', async () => {
      const test = await renderTrialBattle({ seed: 1, createBattle: specterDown });
      await test.toWindUpOf(GHOUL);

      await test.runUntil(() => test.battle().phase.kind === 'transition');

      expect(screen.getByTestId('phase-banner')).toHaveTextContent('À toiVise et attaque');
      expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
      expect(screen.getByRole('button', { name: 'Attaquer, cible : Goule' })).toBeDisabled();
      expect(emptySlot()).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('À toi. Vise et attaque.');
      expect(test.sound.played.at(-1)).toBe('heroPhase');
      expect(test.haptics.played).not.toContain('heroPhase');
    });

    it('ignores a touch on a button during the transition, without off-balance', async () => {
      const test = await renderTrialBattle({ seed: 1 });
      await test.attack();
      await test.advanceTo(test.clock.now() + 500);

      await test.touchDefense('parry', test.clock.now() + 300);

      expect(test.battle().offBalanceUntil).toBeNull();
      expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
      expect(screen.queryByTestId('battle-off-balance')).toBeNull();
    });
  });

  describe('enemy phase (P0b, P1, P2)', () => {
    it('shows the enemy stepping in, then its wind-up; the others fade', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'double' }) });
      await test.attack();
      await test.runUntil(() => test.battle().phase.kind === 'enemy');

      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Goule s’avance');
      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeEnabled();

      await test.toWindUpOf(GHOUL);

      expect(screen.getByTestId('battle-zone-line')).toHaveTextContent('Goule : double frappe');
      expect(sceneProps().timeline).toMatchObject({
        enemy: GHOUL,
        impacts: test.attackStep()!.impacts.map((impact) => impact.at),
      });
      expect(StyleSheet.flatten(screen.getByTestId('enemy-specter').props.style).opacity).toBe(
        0.45,
      );
      expect(announce).toHaveBeenCalledWith('Goule : double frappe');
    });

    it('shows the red seal over an enemy that prepares a perilous attack, read by the screen reader', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ specter: 'perilous' }) });

      await test.toWindUpOf(SPECTER);

      const seal = screen.getByLabelText('Sceau rouge : coup imparable');
      expect(within(screen.getByTestId('enemy-specter')).getByTestId('peril-seal')).toBe(seal);
      expect(seal).toHaveTextContent('!');
      expect(announce).toHaveBeenCalledWith('Spectre : coup imparable, esquive');
      expect(test.sound.played).toContain('seal');
    });

    it('says that a perilous attack must be dodged when it is parried (P8)', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ specter: 'perilous' }) });
      const impact = await test.toWindUpOf(SPECTER);

      await test.touchDefense('parry', impact - 20);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Imparable : esquive !−8 PV');
      expect(screen.getByTestId('battle-off-balance')).toHaveTextContent('Déséquilibré');
    });
  });

  describe('defense buttons (P3 to P7)', () => {
    it('dates a press when the finger touches, not when it is released', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);

      // Chaque étape du geste après son début avance l'horloge de 100 ms : daté à la fin, l'appui
      // serait 250 ms après l'impact, raté.
      await test.touchDefense('parry', impact - 50, 100);

      expect(test.snapshots.flatMap((snapshot) => snapshot.events)).toContainEqual(
        expect.objectContaining({ type: 'blowResolved', outcome: 'perfectParry', delta: -50 }),
      );
    });

    it('judges two simultaneous touches on Parade and Esquive, each one', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'double' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('dodge', impact - 10);
      await test.touchDefense('parry', impact - 10);

      const events = test.snapshots.flatMap((snapshot) => snapshot.events);
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'blowResolved', button: 'dodge' }),
      );
      expect(events).toContainEqual(expect.objectContaining({ type: 'whiffed', button: 'parry' }));
    });

    it('presses with the screen reader', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);
      await test.advanceTo(impact);

      await act(async () => {
        fireEvent(screen.getByTestId('battle-dodge-button'), 'accessibilityAction', {
          nativeEvent: { actionName: 'activate' },
        });
      });

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('EsquiveAucun dégât');
    });

    it('rewards a perfect parry: freeze, flash, sound, vibration, shake, then the counter', async () => {
      withMotion();
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact - 50);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parade parfaite');
      expect(screen.getByTestId('battle-flash-light')).toBeOnTheScreen();
      expect(sceneProps().heroPose).toBe('counter');
      expect(test.sound.played.at(-1)).toBe('perfectParry');
      expect(test.haptics.played.at(-1)).toBe('perfectParry');
      expect(test.battle().hitStop).toEqual({ at: impact - 50, until: impact + 40 });

      await test.advanceTo(impact + 40);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent(
        'Parade parfaiteContre-attaque · 6 dégâts',
      );
      expect(announce).toHaveBeenCalledWith('Parade parfaite, Contre-attaque · 6 dégâts');
      expect(screen.getByRole('button', { name: /^Goule, cible, PV 4 sur 20/u })).toBeOnTheScreen();
    });

    it('shows a good parry, a dodge and a hit with their damage', async () => {
      withMotion();
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'double' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact + 120);
      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parade1 dégât au lieu de 3');
      expect(sceneProps().heroPose).toBe('lean');

      await test.advanceTo(impact + 420 + 161 + 32);
      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Touché−2 PV');
      expect(screen.getByTestId('battle-flash-red')).toBeOnTheScreen();
      expect(screen.getByLabelText('La Sentinelle, PV 77 sur 80')).toBeOnTheScreen();
      expect(sceneProps().heroPose).toBe('hit');
    });

    it('greys and hatches the buttons while off-balance, still active, then clears them', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'basic' }) });
      const impact = await test.toWindUpOf(GHOUL);

      await test.touchDefense('parry', impact - 400);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Trop tôt');
      expect(screen.getByTestId('battle-pad-hatching')).toBeOnTheScreen();
      expect(screen.getByTestId('battle-off-balance')).toHaveTextContent('Déséquilibré');
      expect(within(pad()).getByRole('button', { name: 'Parade' })).toBeEnabled();
      expect(sceneProps().heroPose).toBe('off');

      await test.touchDefense('dodge', impact - 200);
      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Déséquilibré');

      await test.advanceTo(impact + 251);
      expect(screen.queryByTestId('battle-pad-hatching')).toBeNull();
    });
  });

  describe('reduced motion', () => {
    reduceMotionInEachTest();

    it('shows the banner without slide, and a perfect parry without flash nor shake', async () => {
      const test = await renderTrialBattle({ seed: seedFor({ ghoul: 'basic' }) });
      await test.attack();
      await test.advanceTo(test.clock.now() + 500);
      expect(screen.getByTestId('phase-banner-still')).toHaveTextContent(/^Phase ennemie/u);
      expect(screen.queryByTestId('phase-banner')).toBeNull();

      const impact = await test.toWindUpOf(GHOUL);
      await test.touchDefense('parry', impact - 30);

      expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Parade parfaite');
      expect(screen.queryByTestId('battle-flash-light')).toBeNull();
      expect(sceneProps().reducedMotion).toBe(true);
      expect(test.sound.played.at(-1)).toBe('perfectParry');
      expect(test.haptics.played.at(-1)).toBe('perfectParry');
    });
  });

  describe('end of the battle', () => {
    async function win(test: TrialBattleTest): Promise<void> {
      for (let round = 0; test.battle().phase.kind !== 'over' && round < 8; round += 1) {
        await test.runUntil(() => ['hero', 'over'].includes(test.battle().phase.kind));
        if (test.battle().phase.kind === 'hero') await test.attack();
      }
      await test.runUntil(() => test.battle().phase.kind === 'over');
    }

    it('is won, and the player can replay from the start', async () => {
      const test = await renderTrialBattle({ seed: 3 });

      await win(test);

      expect(screen.getByRole('header', { name: 'Combat gagné' })).toBeOnTheScreen();
      expect(screen.getByText('La Goule et le Spectre sont tombés.')).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Combat gagné.');
      expect(screen.queryByTestId('trial-tuning-panel')).toBeNull();
      expect(screen.queryByTestId('battle-measures-panel')).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Rejouer' }));
      });

      expect(
        await screen.findByRole('button', { name: 'Attaquer, cible : Goule' }),
      ).toBeOnTheScreen();
      expect(test.battle().round).toBe(1);
      expect(screen.queryByTestId('battle-feedback')).toBeNull();
    });

    it('is lost when the Sentinel falls, and the player can replay or leave', async () => {
      const test = await renderTrialBattle({
        seed: seedFor({ ghoul: 'basic' }),
        createBattle: changed((battle) => ({ ...battle, hero: { ...battle.hero, hp: 4 } })),
      });
      await test.toWindUpOf(GHOUL);

      await test.runUntil(() => test.battle().phase.kind === 'over');

      expect(screen.getByRole('header', { name: 'Combat perdu' })).toBeOnTheScreen();
      expect(screen.getByText('La Sentinelle est tombée.')).toBeOnTheScreen();
      expect(sceneProps().heroPose).toBe('fallen');
      await fireEvent.press(screen.getByRole('button', { name: 'Quitter' }));
      expect(test.onClose).toHaveBeenCalledTimes(1);
    });

    it('offers the trial tuning and the measures on the preview build', async () => {
      const keyValueStore = memoryKeyValueStore();
      const test = await renderTrialBattle({ seed: 3, trialTools: true, keyValueStore });
      const impact = await test.toWindUpOf(GHOUL);
      await test.touchDefense('parry', impact - 30);
      await win(test);

      expect(screen.getByTestId('trial-tuning-phaseTransitionMs')).toHaveTextContent('800 ms');
      expect(screen.getByTestId('trial-tuning-stepInMs')).toHaveTextContent('400 ms');
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Allonger la transition de phase' }));
      });
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: "Raccourcir l'avancée" }));
      });
      expect(screen.getByTestId('trial-tuning-phaseTransitionMs')).toHaveTextContent('850 ms');
      expect(screen.getByTestId('trial-tuning-stepInMs')).toHaveTextContent('350 ms');
      expect(JSON.parse(keyValueStore.values.get(TRIAL_TUNING_KEY)!)).toEqual({
        phaseTransitionMs: 850,
        stepInMs: 350,
      });

      const measures = screen.getByTestId('battle-measures-panel');
      expect(measures).toHaveTextContent(/Toucher → JS \(1 appuis\) : médiane 0 ms, p95 0 ms/u);
      expect(measures).toHaveTextContent(/Méthode recalculée : a/u);
      expect(measures).toHaveTextContent(/Appuis redatés : 0/u);
      expect(measures).toHaveTextContent(/Latence du son : médiane 18 ms, p95 40 ms/u);
      expect(measures).toHaveTextContent(/Écarts jugés \(1\) : médiane 30 ms/u);
      expect(screen.queryByText(/preview\/|sonde/iu)).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Rejouer' }));
      });
      await test.attack();
      await test.advanceTo(test.clock.now() + 500);
      expect(test.battle().phase).toMatchObject({ kind: 'transition' });
      expect(
        (test.battle().phase as { until: number }).until -
          (test.battle().phase as { since: number }).since,
      ).toBe(850);
    });
  });
});
