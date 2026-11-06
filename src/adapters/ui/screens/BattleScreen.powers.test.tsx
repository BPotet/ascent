// L'écran de combat avec plusieurs pouvoirs (#235, maquette 232) : la bulle d'aide des pouvoirs
// (K11), une seule fois ; le feedback de Tenir bon (K12) : l'arme levée qui brille, le halo,
// « +16 » en or et la barre de PV en or ; la scène reçoit le voile de Brume et la marque d'Entaille.
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { battleWith, heroWith, targetOn } from '../../../application/testing/battleBuilder';
import { BATTLE_HINT_SEEN_KEYS } from '../../../application/useCases/battleHints';
import type { Battle } from '../../../domain/battle/Battle';
import type { PowerKind } from '../../../domain/battle/powers';
import type { ScenePowers } from '../battle/scene/powerScene';
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

    expect(screen.getByTestId('battle-hint-powers')).toHaveTextContent(/Tes pouvoirs/u);
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
    expect(screen.getByTestId('battle-power-button-holdFast').props.accessibilityState).toEqual({
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
