// L'écran de combat avec plusieurs pouvoirs (#235, maquette 232) : la bulle d'aide des pouvoirs
// (K11), une seule fois ; le feedback de Tenir bon (K12) : l'arme levée qui brille, le halo,
// « +16 » en or et la barre de PV en or ; la scène reçoit le voile de Brume et la marque d'Entaille.
// La liste des pouvoirs (#271, maquette 269 : KB2 à KB10) : ouverte par « Pouvoirs », fermée par un
// lancer, par la transition de phase ou sans rien lancer.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { StyleSheet } from 'react-native';

import { battleWith, heroWith, targetOn } from '../../../application/testing/battleBuilder';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import type { Battle } from '../../../domain/battle/Battle';
import type { PowerKind } from '../../../domain/battle/powers';
import type { ScenePowers } from '../battle/scene/powerScene';
import { powerGestureTestId } from '../battle/ActionPad';
import { artPalette } from '../pixelArt/artPalette';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderBattle } from '../testing/battleScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

const hiddenToo = { includeHiddenElements: true } as const;

const equipped =
  (...powers: PowerKind[]) =>
  (battle: Battle): Battle => ({ ...battle, powers });

function scene(): { readonly heroPose: string; readonly powers: ScenePowers } {
  return screen.getByTestId('battle-scene', hiddenToo).props as never;
}

describe('BattleScreen with several powers (#235)', () => {
  it('shows the bubble of the powers once, at the first battle with 2 powers (K11)', async () => {
    const keyValueStore = memoryKeyValueStore();
    const test = await renderBattle({
      seed: 1,
      keyValueStore,
      createBattle: battleWith(equipped('bulwark', 'retaliation')),
    });

    expect(screen.getByTestId('battle-hint-powers')).toHaveTextContent(
      'Tes pouvoirsTouche Pouvoirs pour voir tes pouvoirs. Maintiens-en un pour lire son effet, touche-le pour le lancer.',
    );
    expect(keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.powers)).toBeUndefined();

    await test.attack();

    expect(screen.queryByTestId('battle-hint-powers')).toBeNull();
    expect(keyValueStore.values.get(BATTLE_HINT_SEEN_KEYS.powers)).toBe('1');
  });

  it('shows no bubble of the powers with the base power alone', async () => {
    await renderBattle({ seed: 1 });

    expect(screen.queryByTestId('battle-hint-powers')).toBeNull();
  });

  it('heals with Hold Fast: glowing weapon, halo, « +16 » and the HP bar in gold (K12)', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('bulwark', 'retaliation', 'holdFast'),
        heroWith({ hp: 30, momentum: 3, burn: 2 }),
      ),
    });

    await test.power(undefined, 'holdFast');

    expect(test.battle().hero).toMatchObject({ hp: 46, momentum: 0 });
    expect(test.battle().hero.burn).toBeUndefined();
    expect(scene().heroPose).toBe('cast');
    expect(scene().powers.healedAt).not.toBeNull();
    expect(screen.getByText('+16', hiddenToo)).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('battle-hero-hp', hiddenToo).props.style)
        .backgroundColor,
    ).toBe(artPalette.roles.gold);
    // Tenir bon prend l'action : la liste s'est fermée, « Pouvoirs » attend.
    expect(screen.queryByTestId('battle-power-list')).toBeNull();
    expect(screen.getByTestId('battle-powers-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('veils the Wanderer with the Mist, with its chip under the HP', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('shadowStep', 'rend', 'mist'),
        heroWith({ momentum: 5 }),
        targetOn(1),
        (battle) => ({ ...battle, heroKind: 'wanderer' }),
      ),
    });
    expect(scene().powers).toMatchObject({ mist: false, rendTarget: null });

    await test.power(undefined, 'mist');
    expect(scene().powers.mist).toBe(true);
    expect(screen.getByTestId('battle-power-chip-mist', hiddenToo)).toBeTruthy();
  });

  it('marks the target of Rend until the strike that consumes it', async () => {
    const test = await renderBattle({
      seed: 1,
      createBattle: battleWith(
        equipped('shadowStep', 'rend', 'mist'),
        heroWith({ momentum: 5 }),
        targetOn(1),
        (battle) => ({ ...battle, heroKind: 'wanderer' }),
      ),
    });

    await test.power(undefined, 'rend');

    expect(scene().powers.rendTarget).toBe(1);
  });
});

const wanderer = (momentum: number) =>
  battleWith(
    equipped('shadowStep', 'rend', 'flurry'),
    heroWith({ momentum }),
    (battle): Battle => ({ ...battle, heroKind: 'wanderer' }),
  );

const zoneLine = () => screen.getByTestId('battle-zone-line');
const powersKey = () => screen.getByTestId('battle-powers-button');

describe('BattleScreen and the power list (#271)', () => {
  it('opens the list above « Pouvoirs » with a very short vibration, the fight veiled (KB2)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(5) });
    expect(powersKey()).toHaveTextContent('Pouvoirs3 prêts sur 3');

    await test.openPowers();

    expect(test.haptics.played).toEqual(['powerTip']);
    expect(screen.getByTestId('battle-power-list')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-scene-veil', hiddenToo)).toBeTruthy();
    expect(
      screen.getByTestId('battle-powers-button', hiddenToo).props.accessibilityState,
    ).toMatchObject({ expanded: true });
    // Pour TalkBack, le reste de l'écran est caché tant que la liste est ouverte.
    expect(screen.queryByTestId('battle-hero-bar')).toBeNull();
    expect(screen.getByTestId('battle-hero-bar', hiddenToo)).toBeTruthy();
  });

  it('closes a bubble left open when the phase changes: the list opened again shows none', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(5) });
    await test.openPowers();
    // Le doigt reste posé 400 ms sur Entaille : la bulle s'ouvre, et le doigt ne se lève pas.
    const hold = getByGestureTestId(`${powerGestureTestId('rend')}-hold`) as unknown as {
      readonly handlers: Record<string, ((...args: unknown[]) => void) | undefined>;
    };
    await act(async () => {
      hold.handlers.onStart?.({});
      await Promise.resolve();
    });
    expect(screen.getByTestId('battle-power-tip')).toBeOnTheScreen();

    // La phase change (l'attaque arrive par la session), puis revient au héros.
    await test.attack();
    await test.runUntil(() => test.battle().phase.kind !== 'hero');
    expect(screen.queryByTestId('battle-power-tip', hiddenToo)).toBeNull();
    await test.runUntil(() => test.battle().phase.kind === 'hero');
    await test.openPowers();

    expect(screen.getByTestId('battle-power-list')).toBeOnTheScreen();
    expect(screen.queryByTestId('battle-power-tip', hiddenToo)).toBeNull();
  });

  it('casts an instant power, closes the list and lets the hero attack (KB5, KB6)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(5) });

    await test.power(undefined, 'rend');

    expect(test.battle().hero).toMatchObject({ momentum: 4, rend: true });
    expect(screen.queryByTestId('battle-power-list')).toBeNull();
    expect(zoneLine()).toHaveTextContent('Toujours à toi : attaque.');
    expect(powersKey()).toHaveTextContent('Pouvoirs1 prêt sur 3');
    expect(powersKey().props.accessibilityState).toMatchObject({ expanded: false });
  });

  it('says « Actif » and « Instantané déjà lancé » when it opens again (KB7)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(5) });
    await test.power(undefined, 'rend');

    await test.openPowers();

    const row = (power: string) => within(screen.getByTestId(`battle-power-button-${power}`));
    expect(row('rend').getByText('Actif')).toBeOnTheScreen();
    expect(row('shadowStep').getByText('Instantané déjà lancé')).toBeOnTheScreen();
    expect(row('flurry').getByText('Prêt')).toBeOnTheScreen();
  });

  it('keeps the list open on a row too dear, the momentum unchanged (KB3)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(1) });
    await test.openPowers();

    await test.release(powerGestureTestId('flurry'), test.clock.now(), test.clock.now() + 80);

    expect(screen.getByTestId('battle-power-list')).toBeOnTheScreen();
    expect(test.battle().hero.momentum).toBe(1);
  });

  it('closes without casting by a touch outside the list, the momentum unchanged', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(5) });
    await test.openPowers();

    await fireEvent.press(screen.getByTestId('battle-power-list-veil', hiddenToo));

    expect(screen.queryByTestId('battle-power-list')).toBeNull();
    expect(test.battle().hero.momentum).toBe(5);
    expect(test.battle().phase.kind).toBe('hero');
    expect(screen.queryByTestId('battle-power-scene-veil', hiddenToo)).toBeNull();
  });

  it('closes by itself, casting nothing, when the phase transition begins', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(5) });
    await test.openPowers();

    // L'attaque arrive par la session, la liste encore ouverte.
    await test.attack();

    expect(screen.queryByTestId('battle-power-list')).toBeNull();
    expect(test.battle().hero.rend).not.toBe(true);
    expect(test.battle().hero.shadowStep).not.toBe(true);
    expect(test.battle().phase.kind).not.toBe('hero');
  });

  it('closes on a power strike, « Frapper » taking the whole row (KB8, KB9)', async () => {
    const test = await renderBattle({ seed: 1, createBattle: wanderer(3) });

    await test.power(undefined, 'flurry');

    expect(screen.queryByTestId('battle-power-list')).toBeNull();
    expect(screen.queryByTestId('battle-powers-button')).toBeNull();
    expect(
      within(screen.getByTestId('battle-strike-button')).getByText('Rafale · 4 coups'),
    ).toBeOnTheScreen();
  });
});
