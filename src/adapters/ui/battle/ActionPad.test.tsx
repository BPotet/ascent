// La zone d'action (#31, #120, #235, #271 : maquette 269, KB1, KB6, KB9, KB12) : en phase du héros,
// deux touches seulement, « Pouvoirs » à gauche et « Attaquer » à droite, la plus large ; « Frapper »
// pendant la frappe en rythme ; Esquive et Parade en phase ennemie, inchangées.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { POWERS, type PowerKind } from '../../../domain/battle/powers';
import type { ActionPad as Pad, PowerSlot } from '../state/battleView';
import { ActionPad, POWERS_GESTURE_TEST_ID } from './ActionPad';

const hiddenToo = { includeHiddenElements: true } as const;

const slot = (power: PowerKind, change: Partial<PowerSlot> = {}): PowerSlot => ({
  power,
  cost: POWERS[power].cost,
  availability: 'available',
  missing: 0,
  ...(POWERS[power].instant && { instant: true as const }),
  ...change,
});

const WANDERER = [slot('shadowStep'), slot('rend'), slot('flurry')];

function heroPad(powers: readonly PowerSlot[] = WANDERER, change: Partial<Pad> = {}): Pad {
  return { kind: 'hero', locked: false, lock: null, powers, ...change } as Pad;
}

function props() {
  return {
    targetName: 'Goule',
    uiNow: () => 0,
    now: () => 4_321,
    onDefense: jest.fn(),
    onAttack: jest.fn(),
    onStrike: jest.fn(),
    onTogglePowers: jest.fn(),
    powersOpen: false,
    focusPowers: false,
  } as const;
}

const powersKey = () => screen.getByTestId('battle-powers-button');
const attackKey = () => screen.getByTestId('battle-attack-button');
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('ActionPad in the hero phase (#271)', () => {
  it('has two keys only: « Pouvoirs » on the left, « Attaquer » on the right, the widest (KB1)', async () => {
    await render(<ActionPad pad={heroPad()} {...props()} />);

    const keys = within(screen.getByTestId('battle-pad'))
      .getAllByRole('button')
      .map(({ props: p }) => p.testID);
    expect(keys).toEqual(['battle-powers-button', 'battle-attack-button']);
    expect(screen.queryAllByTestId(/^battle-power-button-/u)).toHaveLength(0);
    expect(style('battle-powers-button').flex).toBe(1);
    expect(style('battle-attack-button').flex).toBe(1.45);
    expect(style('battle-powers-button').minHeight).toBe(112);
    expect(style('battle-attack-button').minHeight).toBe(112);
    expect(StyleSheet.flatten(screen.getByTestId('battle-pad').props.style)).toMatchObject({
      flexDirection: 'row',
      gap: 12,
    });
  });

  it('writes « Pouvoirs » and « 3 prêts sur 3 », without a power icon, read as a closed menu (KB1)', async () => {
    await render(<ActionPad pad={heroPad()} {...props()} />);

    expect(powersKey()).toHaveTextContent('Pouvoirs3 prêts sur 3');
    expect(screen.queryAllByTestId(/^battle-power-icon-/u, hiddenToo)).toHaveLength(0);
    expect(powersKey().props.accessibilityRole).toBe('button');
    expect(powersKey().props.accessibilityLabel).toBe('Pouvoirs, 3 prêts sur 3, menu');
    expect(powersKey().props.accessibilityState).toEqual({ expanded: false, disabled: false });
  });

  it('counts the ready powers only, and stays touchable with none ready', async () => {
    const onTogglePowers = jest.fn();
    await render(
      <ActionPad
        pad={heroPad([
          slot('shadowStep', { availability: 'missing', missing: 3 }),
          slot('rend', { availability: 'active' }),
          slot('flurry', { availability: 'missing', missing: 2 }),
        ])}
        {...props()}
        onTogglePowers={onTogglePowers}
      />,
    );

    expect(powersKey()).toHaveTextContent('Pouvoirs0 prêt sur 3');
    expect(powersKey().props.accessibilityState).toEqual({ expanded: false, disabled: false });
    await fireEvent(powersKey(), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(onTogglePowers).toHaveBeenCalledTimes(1);
  });

  it('says « 1 prêt sur 1 » with one power equipped', async () => {
    await render(<ActionPad pad={heroPad([slot('bulwark')])} {...props()} />);

    expect(powersKey()).toHaveTextContent('Pouvoirs1 prêt sur 1');
  });

  it('opens and closes the list on release, and is read expanded while it is open (KB2)', async () => {
    const handlers = props();
    const { rerender } = await render(<ActionPad pad={heroPad()} {...handlers} />);

    await act(async () => {
      fireGestureHandler(getByGestureTestId(POWERS_GESTURE_TEST_ID) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      await Promise.resolve();
    });
    expect(handlers.onTogglePowers).toHaveBeenCalledTimes(1);

    await rerender(<ActionPad pad={heroPad()} {...handlers} powersOpen />);
    expect(powersKey().props.accessibilityState).toEqual({ expanded: true, disabled: false });
    expect(powersKey()).toHaveStyle({ borderColor: '#F2D49B' });
  });

  it('fades both keys during the dead time, « Attends » above, and ignores « Pouvoirs »', async () => {
    const handlers = props();
    await render(<ActionPad pad={heroPad(WANDERER, { locked: true })} {...handlers} />);

    expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
    expect(style('battle-powers-button').opacity).toBe(0.4);
    expect(style('battle-attack-button').opacity).toBe(0.4);
    expect(powersKey().props.accessibilityState).toEqual({ expanded: false, disabled: true });
    await fireEvent(powersKey(), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(handlers.onTogglePowers).not.toHaveBeenCalled();
  });

  it('attacks with the screen reader, at the JS instant', async () => {
    const handlers = props();
    await render(<ActionPad pad={heroPad()} {...handlers} />);

    await fireEvent(attackKey(), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(handlers.onAttack).toHaveBeenCalledWith(4_321, 4_321);
    expect(attackKey().props.accessibilityLabel).toBe('Attaquer, cible : Goule');
  });
});

describe('the focus of the screen reader (E2, #271)', () => {
  // Le préréglage de React Native en fait déjà une fonction simulée : ses appels sont effacés.
  beforeEach(() => jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('moves to « Attaquer » just after an instant power, Attaquer staying available (KB6)', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    const handlers = props();
    await render(<ActionPad pad={heroPad()} {...handlers} />);
    expect(focus).not.toHaveBeenCalled();

    await act(async () => {
      screen.rerender(
        <ActionPad
          pad={heroPad([slot('rend', { availability: 'active' })], { instantCast: true })}
          {...handlers}
        />,
      );
    });

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(attackKey().props.accessibilityState).toEqual({ disabled: false });
  });

  it('stays put when the instant power was already active at the start of the phase', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    await render(
      <ActionPad pad={heroPad([slot('shadowStep', { availability: 'active' })])} {...props()} />,
    );

    expect(focus).not.toHaveBeenCalled();
  });

  it('comes back to « Pouvoirs » once the list is closed without casting', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    const handlers = props();
    await render(<ActionPad pad={heroPad()} {...handlers} powersOpen />);
    expect(focus).not.toHaveBeenCalled();

    await act(async () => {
      screen.rerender(<ActionPad pad={heroPad()} {...handlers} focusPowers />);
    });

    expect(focus).toHaveBeenCalledTimes(1);
  });
});

describe('ActionPad out of the hero phase (KB9, KB12)', () => {
  it('shows nothing at the end of the battle', async () => {
    await render(<ActionPad pad={{ kind: 'none' }} {...props()} />);

    expect(screen.queryByTestId('battle-pad')).toBeNull();
  });

  it('keeps the enemy phase as it is: Esquive and Parade, pressed at the JS instant (KB12)', async () => {
    const handlers = props();
    await render(
      <ActionPad
        pad={{ kind: 'defense', locked: false, lock: null, offBalance: false }}
        {...handlers}
      />,
    );

    expect(screen.queryByTestId('battle-powers-button')).toBeNull();
    for (const id of ['battle-parry-button', 'battle-dodge-button']) {
      await fireEvent(screen.getByTestId(id), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
    }
    expect(handlers.onDefense.mock.calls).toEqual([
      ['parry', 4_321],
      ['dodge', 4_321],
    ]);
  });

  it('turns into a single « Frapper », with its bar and its mark, during the strike', async () => {
    const handlers = props();
    await render(
      <ActionPad
        pad={{ kind: 'strike', since: 1_000, impactAt: 1_700, resolved: false }}
        {...handlers}
      />,
    );

    expect(screen.getByTestId('battle-strike-button')).toHaveTextContent('Frapper');
    expect(screen.queryByTestId('battle-attack-button')).toBeNull();
    expect(screen.queryByTestId('battle-powers-button')).toBeNull();
    expect(screen.getByTestId('battle-strike-mark', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('battle-strike-button').props.accessibilityLabel).toBe('Frapper');
    await fireEvent(screen.getByTestId('battle-strike-button'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(handlers.onStrike).toHaveBeenCalledWith(4_321);
  });

  it('writes the name and the hits of a power strike under « Frapper » (K13, KB9)', async () => {
    await render(
      <ActionPad
        pad={{
          kind: 'strike',
          since: 1_000,
          impactAt: 1_700,
          resolved: false,
          power: 'flurry',
          hits: 4,
          hit: 2,
        }}
        {...props()}
      />,
    );

    const strike = within(screen.getByTestId('battle-strike-button'));
    expect(strike.getByText('Frapper')).toBeOnTheScreen();
    expect(strike.getByText('Rafale · 4 coups')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^battle-strike-hit-/u, hiddenToo)).toHaveLength(4);
    expect(screen.getByTestId('battle-strike-button').props.accessibilityLabel).toBe(
      'Frapper, Rafale, coup 2 sur 4',
    );
  });

  it('writes the name alone for a power strike of one hit', async () => {
    await render(
      <ActionPad
        pad={{
          kind: 'strike',
          since: 1_000,
          impactAt: 1_700,
          resolved: false,
          power: 'shieldBash',
          hits: 1,
          hit: 1,
        }}
        {...props()}
      />,
    );

    expect(screen.getByText('Coup de bouclier')).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^battle-strike-hit-/u, hiddenToo)).toHaveLength(0);
  });
});
