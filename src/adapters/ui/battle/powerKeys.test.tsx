// Le combat à 1 à 3 touches de pouvoir (#235, maquette 232 : K1 à K11) : une touche par pouvoir
// équipé sur la rangée d'« Attaquer », sa raison d'indisponibilité, le toucher maintenu qui montre
// l'effet sans rien lancer, et les étiquettes des charges sous les PV.
import { act, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { HeroState } from '../../../domain/battle/Battle';
import type { PowerKind } from '../../../domain/battle/powers';
import type { ActionPad as Pad, PowerSlot } from '../state/battleView';
import { ActionPad, powerGestureTestId } from './ActionPad';
import { HeroBar } from './HeroBar';

const hiddenToo = { includeHiddenElements: true } as const;

const slot = (power: PowerKind, change: Partial<PowerSlot> = {}): PowerSlot => ({
  power,
  cost: { bulwark: 1, retaliation: 2, holdFast: 3, shadowStep: 3, rend: 1, mist: 2 }[power],
  availability: 'available',
  missing: 0,
  ...(['retaliation', 'shadowStep', 'rend', 'mist'].includes(power) && { instant: true as const }),
  ...change,
});

function heroPad(...powers: PowerSlot[]): Pad {
  return { kind: 'hero', locked: false, lock: null, powers };
}

function props() {
  return {
    targetName: 'Goule',
    uiNow: () => 0,
    now: () => 4_321,
    onDefense: jest.fn(),
    onAttack: jest.fn(),
    onPower: jest.fn(),
    onStrike: jest.fn(),
    onPowerTip: jest.fn(),
  } as const;
}

const key = (power: PowerKind) => screen.getByTestId(`battle-power-button-${power}`);
const flex = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).flex;

describe('the power keys (#235)', () => {
  it('shows one key next to « Attaquer » without any power unlocked (K1)', async () => {
    await render(<ActionPad pad={heroPad(slot('shadowStep'))} {...props()} />);

    expect(within(key('shadowStep')).getByText("Pas de l'ombre")).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^battle-power-button-/u)).toHaveLength(1);
    expect(flex('battle-attack-button')).toBe(1.45);
  });

  it('puts 3 keys then « Attaquer » on one row, in the order given, Attack the widest (K3)', async () => {
    await render(
      <ActionPad pad={heroPad(slot('shadowStep'), slot('rend'), slot('mist'))} {...props()} />,
    );

    const keys = screen.getAllByTestId(/^battle-power-button-/u).map(({ props: p }) => p.testID);
    expect(keys).toEqual([
      'battle-power-button-shadowStep',
      'battle-power-button-rend',
      'battle-power-button-mist',
    ]);
    expect(flex('battle-attack-button')).toBe(1.15);
    expect(flex('battle-power-button-mist')).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId('battle-pad').props.style)).toMatchObject({
      flexDirection: 'row',
      gap: 8,
    });
    expect(StyleSheet.flatten(key('rend').props.style).minHeight).toBe(112);
    expect(within(key('mist')).getByText('2 Élan')).toBeOnTheScreen();
    expect(within(key('mist')).getByText('Instantané')).toBeOnTheScreen();
    expect(key('mist').props.accessibilityLabel).toBe('Pouvoir : Brume, 2 Élan, instantané');
    expect(key('mist').props.accessibilityHint).toMatch(/^Pouvoir instantané, 2 Élan, à charge/u);
  });

  it('gives 2 powers a wider Attack (K2)', async () => {
    await render(<ActionPad pad={heroPad(slot('bulwark'), slot('retaliation'))} {...props()} />);

    expect(flex('battle-attack-button')).toBe(1.25);
    expect(within(key('bulwark')).queryByText('Instantané')).not.toBeOnTheScreen();
  });

  it('says why a key is unavailable, hatched (K4, K5, K7)', async () => {
    await render(
      <ActionPad
        pad={heroPad(
          slot('bulwark', { availability: 'active' }),
          slot('retaliation', { availability: 'instantUsed' }),
          slot('holdFast', { availability: 'usedThisBattle' }),
        )}
        {...props()}
      />,
    );

    expect(within(key('bulwark')).getByText('Actif')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-active-check-bulwark', hiddenToo)).toBeTruthy();
    expect(within(key('retaliation')).getByText('Instantané\ndéjà lancé')).toBeOnTheScreen();
    expect(within(key('holdFast')).getByText('Utilisé\nce combat')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-hatching-holdFast', hiddenToo)).toBeTruthy();
    expect(screen.queryByTestId('battle-power-hatching-bulwark', hiddenToo)).toBeNull();
    for (const power of ['bulwark', 'retaliation', 'holdFast'] as const) {
      expect(key(power).props.accessibilityState).toEqual({ disabled: true });
    }
  });

  it('tells the momentum a power misses (« Il manque 1 Élan »)', async () => {
    await render(
      <ActionPad
        pad={heroPad(slot('holdFast', { availability: 'missing', missing: 1 }))}
        {...props()}
      />,
    );

    expect(within(key('holdFast')).getByText('Il manque\n1 Élan')).toBeOnTheScreen();
    expect(key('holdFast').props.accessibilityLabel).toBe(
      'Pouvoir : Tenir bon, 3 Élan, indisponible : il manque 1 Élan',
    );
  });

  it('casts the touched power on release', async () => {
    const handlers = props();
    await render(<ActionPad pad={heroPad(slot('bulwark'), slot('retaliation'))} {...handlers} />);

    await act(async () => {
      fireGestureHandler(getByGestureTestId(powerGestureTestId('retaliation')) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      await Promise.resolve();
    });

    expect(handlers.onPower).toHaveBeenCalledWith('retaliation', 0, 0);
  });

  it('shows the effect on a long press, and casts nothing on release (K10)', async () => {
    const handlers = props();
    await render(<ActionPad pad={heroPad(slot('shadowStep'), slot('mist'))} {...handlers} />);

    // Le doigt se pose, reste 400 ms (l'effet s'ouvre, puis se referme quand il se lève), puis la
    // touche est relâchée : rien n'est lancé, même sur la touche.
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${powerGestureTestId('mist')}-hold`) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      fireGestureHandler(getByGestureTestId(powerGestureTestId('mist')) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      await Promise.resolve();
    });

    expect(handlers.onPowerTip).toHaveBeenCalledWith('mist');
    expect(handlers.onPower).not.toHaveBeenCalled();
    expect(screen.queryByTestId('battle-power-tip')).not.toBeOnTheScreen();

    // Un toucher court suivant lance le pouvoir, comme aujourd'hui.
    await act(async () => {
      fireGestureHandler(getByGestureTestId(powerGestureTestId('mist')) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      await Promise.resolve();
    });
    expect(handlers.onPower).toHaveBeenCalledWith('mist', 0, 0);
  });

  it('writes the name, the cost, the type and the effect in the bubble (K10)', async () => {
    await render(<ActionPad pad={heroPad(slot('mist'))} {...props()} />);

    await act(async () => {
      key('mist').props.onAccessibilityAction({ nativeEvent: { actionName: 'longpress' } });
    });

    const tip = within(screen.getByTestId('battle-power-tip'));
    expect(tip.getByText('Brume')).toBeOnTheScreen();
    expect(tip.getByText('2 Élan · Instantané · reste actif')).toBeOnTheScreen();
    expect(tip.getByText(/^Pouvoir instantané, 2 Élan, à charge\./u)).toBeOnTheScreen();
    expect(tip.getByText("Relâche : rien n'est lancé.")).toBeOnTheScreen();
  });

  it("shows the effect to the screen reader by its « Voir l'effet » action", async () => {
    const handlers = props();
    await render(<ActionPad pad={heroPad(slot('rend'))} {...handlers} />);

    await act(async () => {
      key('rend').props.onAccessibilityAction({ nativeEvent: { actionName: 'longpress' } });
    });

    expect(screen.getByTestId('battle-power-tip')).toBeOnTheScreen();
    expect(handlers.onPower).not.toHaveBeenCalled();
    await act(async () => {
      key('rend').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    });
    expect(handlers.onPower).toHaveBeenCalledWith('rend', 4_321, 4_321);
  });

  it('keeps the enemy phase as it is: Esquive and Parade, no power key (K9)', async () => {
    await render(
      <ActionPad
        pad={{ kind: 'defense', locked: false, lock: null, offBalance: false }}
        {...props()}
      />,
    );

    expect(screen.queryAllByTestId(/^battle-power-button-/u)).toHaveLength(0);
    expect(screen.getByTestId('battle-parry-button')).toBeOnTheScreen();
  });
});

describe('the charges under the HP (#235, K5, K6)', () => {
  const hero: HeroState = { hp: 41, maxHp: 55, momentum: 2, bulwark: false };

  it('shows one chip per active charge, together, and reads them', async () => {
    await render(
      <HeroBar hero={{ ...hero, shadowStep: true, mist: true, rend: true }} kind="wanderer" />,
    );

    expect(screen.getByTestId('battle-shadow-step-chip', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-power-chip-mist', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-power-chip-rend', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-hero-bar').props.accessibilityLabel).toBe(
      "L'Errante, PV 41 sur 55, Élan 2 sur 5, Pas de l'ombre, Entaille active, Brume active",
    );
  });

  it('shows the Bulwark and Retaliation together', async () => {
    await render(<HeroBar hero={{ ...hero, bulwark: true, retaliation: true }} />);

    expect(screen.getByTestId('battle-power-chip-retaliation', hiddenToo)).toBeTruthy();
    expect(screen.getByText('Rempart', hiddenToo)).toBeTruthy();
  });
});
