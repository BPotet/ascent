// La liste des pouvoirs en combat (#271, maquette 269 : KB2 à KB11) : une ligne par pouvoir équipé,
// dans l'ordre de l'arbre, avec son icône, son nom entier, son coût, son type, ses losanges d'Élan et
// son état en mot ; lancer au relâcher, l'effet au toucher maintenu, et les trois fermetures sans
// lancer. Les tests des touches de pouvoir de #235, #173 et #237 y sont repris pour les lignes.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, DeviceEventEmitter, StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { ReduceMotion, getAnimatedStyle } from 'react-native-reanimated';

import { POWERS, type PowerKind } from '../../../domain/battle/powers';
import { artPalette } from '../pixelArt/artPalette';
import { contrast } from '../testing/contrast';
import type { PowerSlot } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { powerGestureTestId } from './ActionPad';
import { POWER_LIST_MS, PowerList, powerListRise } from './PowerList';

const { roles } = artPalette;
const hiddenToo = { includeHiddenElements: true } as const;

const slot = (power: PowerKind, change: Partial<PowerSlot> = {}): PowerSlot => ({
  power,
  cost: POWERS[power].cost,
  availability: 'available',
  missing: 0,
  ...(POWERS[power].instant && { instant: true as const }),
  ...change,
});

function props() {
  return {
    uiNow: () => 0,
    now: () => 4_321,
    reducedMotion: false,
    onCast: jest.fn(),
    onDismiss: jest.fn(),
    onTip: jest.fn(),
  } as const;
}

const row = (power: PowerKind) => screen.getByTestId(`battle-power-button-${power}`);
function pipsOf(power: PowerKind) {
  const all = within(screen.getByTestId(`battle-power-pips-${power}`, hiddenToo));
  return {
    full: all.queryAllByTestId('battle-power-pip-full', hiddenToo),
    empty: all.queryAllByTestId('battle-power-pip-empty', hiddenToo),
  };
}

async function release(power: PowerKind, inside = true) {
  await act(async () => {
    fireGestureHandler(
      getByGestureTestId(powerGestureTestId(power)) as never,
      inside
        ? [{ state: State.BEGAN }, { state: State.ACTIVE }, { state: State.END }]
        : [{ state: State.BEGAN }, { state: State.FAILED }],
    );
    await Promise.resolve();
  });
}

const WANDERER = [slot('shadowStep'), slot('rend'), slot('flurry')];

describe('the power list (#271)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is a menu « Pouvoirs équipés », one row per power, in the order given (KB2)', async () => {
    await render(<PowerList slots={WANDERER} {...props()} />);

    const list = screen.getByTestId('battle-power-list');
    expect(list.props.accessibilityRole).toBe('menu');
    expect(list.props.accessibilityLabel).toBe('Pouvoirs équipés');
    expect(screen.getByTestId('battle-power-list-column').props.accessibilityViewIsModal).toBe(
      true,
    );
    expect(screen.getAllByTestId(/^battle-power-button-/u).map(({ props: p }) => p.testID)).toEqual(
      ['battle-power-button-shadowStep', 'battle-power-button-rend', 'battle-power-button-flurry'],
    );
    const head = screen.getByTestId('battle-power-list-head', hiddenToo);
    expect(head).toHaveTextContent('Pouvoirs équipés3 prêts sur 3');
    expect(head.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('shows the icon, the full name, the cost, the type, the diamonds and « Prêt » (KB2)', async () => {
    await render(<PowerList slots={WANDERER} {...props()} />);

    const flurry = within(row('flurry'));
    expect(flurry.getByText('Rafale')).toBeOnTheScreen();
    expect(flurry.getByText('2 Élan · Frappe')).toBeOnTheScreen();
    expect(flurry.getByText('Prêt')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-icon-flurry', hiddenToo)).toBeTruthy();
    expect(pipsOf('flurry').full).toHaveLength(2);
    expect(pipsOf('flurry').empty).toHaveLength(0);
    expect(StyleSheet.flatten(row('flurry').props.style).minHeight).toBe(64);
    expect(row('flurry').props.accessibilityRole).toBe('menuitem');
    expect(row('flurry').props.accessibilityLabel).toBe('Pouvoir : Rafale, 2 Élan');
    expect(row('flurry').props.accessibilityHint).toMatch(/^Frappe de pouvoir, 2 Élan/u);
    expect(row('flurry').props.accessibilityState).toEqual({ disabled: false });
    expect(row('flurry').props.accessibilityActions).toEqual([
      { name: 'activate' },
      { name: 'longpress', label: "Voir l'effet" },
    ]);
    expect(screen.getByTestId('battle-power-pips-flurry', hiddenToo).props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  it('writes « Instantané » after the crescent, on one line, in light violet (E1, KB2)', async () => {
    await render(<PowerList slots={[slot('shadowStep'), slot('bulwark')]} {...props()} />);

    expect(within(row('shadowStep')).getByText('3 Élan ·')).toBeOnTheScreen();
    const instant = screen.getByTestId('battle-power-instant-shadowStep', hiddenToo);
    expect(StyleSheet.flatten(instant.props.style)).toMatchObject({ flexDirection: 'row' });
    const [crescent, word] = instant.children as unknown as {
      props: { testID?: string; style: unknown; children?: unknown };
    }[];
    expect(crescent!.props.testID).toBe('battle-power-crescent-shadowStep');
    expect(word!.props.children).toBe('Instantané');
    expect(StyleSheet.flatten(word!.props.style)).toMatchObject({
      color: battleColors.onShadowStep,
    });
    expect(row('shadowStep').props.accessibilityLabel).toBe(
      "Pouvoir : Pas de l'ombre, 3 Élan, instantané",
    );
    expect(within(row('bulwark')).getByText('1 Élan · Action')).toBeOnTheScreen();
    expect(within(row('bulwark')).queryByText(/Instantané/u)).toBeNull();
  });

  it('writes « Coup de bouclier » in full on its row (#236, K14)', async () => {
    await render(
      <PowerList
        slots={[slot('shieldBash'), slot('crushingBlow'), slot('retaliation')]}
        {...props()}
      />,
    );

    expect(within(row('shieldBash')).getByText('Coup de bouclier')).toBeOnTheScreen();
    expect(within(row('shieldBash')).queryByText("Coup d'écu")).toBeNull();
    expect(row('shieldBash').props.accessibilityLabel).toBe('Pouvoir : Coup de bouclier, 2 Élan');
    expect(within(row('crushingBlow')).getByText('Fracas')).toBeOnTheScreen();
  });

  it('hatches the rows too dear, their diamonds empty, and says what they miss (KB3)', async () => {
    await render(
      <PowerList
        slots={[
          slot('shadowStep', { availability: 'missing', missing: 2 }),
          slot('rend'),
          slot('flurry', { availability: 'missing', missing: 1 }),
        ]}
        {...props()}
      />,
    );

    expect(within(row('shadowStep')).getByText('Il manque 2 Élan')).toBeOnTheScreen();
    expect(within(row('flurry')).getByText('Il manque 1 Élan')).toBeOnTheScreen();
    expect(within(row('flurry')).queryByText('Prêt')).toBeNull();
    expect(within(row('rend')).getByText('Prêt')).toBeOnTheScreen();
    expect(pipsOf('shadowStep')).toMatchObject({
      full: { length: 1 },
      empty: { length: 2 },
    });
    expect(pipsOf('flurry')).toMatchObject({ full: { length: 1 }, empty: { length: 1 } });
    expect(screen.getByTestId('battle-power-hatching-flurry', hiddenToo)).toBeTruthy();
    expect(screen.queryByTestId('battle-power-hatching-rend', hiddenToo)).toBeNull();
    expect(row('flurry').props.accessibilityState).toEqual({ disabled: true });
    expect(row('flurry').props.accessibilityLabel).toBe(
      'Pouvoir : Rafale, 2 Élan, indisponible : il manque 1 Élan',
    );
    expect(screen.getByTestId('battle-power-list-head', hiddenToo)).toHaveTextContent(
      /1 prêt sur 3$/u,
    );
  });

  it('borders a kindled row with ember: the flame, « Attisé · 2 → 1 Élan », one ember diamond (KB4)', async () => {
    await render(
      <PowerList
        slots={[
          slot('bulwark'),
          slot('retaliation', { cost: 1, baseCost: 2, kindled: true }),
          slot('holdFast', { availability: 'missing', missing: 2 }),
        ]}
        {...props()}
      />,
    );

    expect(within(row('retaliation')).getByText('Attisé · 2 → 1 Élan ·')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-kindled-retaliation', hiddenToo)).toBeTruthy();
    expect(row('retaliation')).toHaveStyle({ borderColor: roles.ember });
    const { full, empty } = pipsOf('retaliation');
    expect(full).toHaveLength(1);
    expect(empty).toHaveLength(0);
    expect(StyleSheet.flatten(full[0]!.props.style).backgroundColor).toBe(roles.ember);
    expect(StyleSheet.flatten(pipsOf('bulwark').full[0]!.props.style).backgroundColor).toBe(
      roles.gold,
    );
    expect(row('retaliation').props.accessibilityLabel).toBe(
      'Pouvoir : Représailles, attisé, 1 Élan au lieu de 2, instantané',
    );
    expect(screen.queryByTestId('battle-power-kindled-holdFast', hiddenToo)).toBeNull();
  });

  it('says what a kindled power misses at its kindled cost', async () => {
    await render(
      <PowerList
        slots={[
          slot('holdFast', {
            cost: 2,
            baseCost: 3,
            kindled: true,
            availability: 'missing',
            missing: 1,
          }),
        ]}
        {...props()}
      />,
    );

    expect(within(row('holdFast')).getByText('Il manque 1 Élan')).toBeOnTheScreen();
    expect(row('holdFast').props.accessibilityLabel).toBe(
      'Pouvoir : Tenir bon, attisé, 2 Élan au lieu de 3, indisponible : il manque 1 Élan',
    );
  });

  it('ticks the active power in gold, unhatched, and says « Instantané déjà lancé » and « Utilisé ce combat » (KB7, KB10)', async () => {
    await render(
      <PowerList
        slots={[
          slot('bulwark', { availability: 'active' }),
          slot('retaliation', { availability: 'instantUsed' }),
          slot('holdFast', { availability: 'usedThisBattle' }),
        ]}
        {...props()}
      />,
    );

    expect(within(row('bulwark')).getByText('Actif')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-active-check-bulwark', hiddenToo)).toBeTruthy();
    expect(row('bulwark')).toHaveStyle({ borderColor: roles.gold });
    expect(screen.queryByTestId('battle-power-hatching-bulwark', hiddenToo)).toBeNull();
    expect(within(row('retaliation')).getByText('Instantané déjà lancé')).toBeOnTheScreen();
    expect(within(row('holdFast')).getByText('Utilisé ce combat')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-hatching-holdFast', hiddenToo)).toBeTruthy();
    expect(screen.getByTestId('battle-power-hatching-retaliation', hiddenToo)).toBeTruthy();
    for (const power of ['bulwark', 'retaliation', 'holdFast'] as const) {
      expect(row(power).props.accessibilityState).toEqual({ disabled: true });
    }
    expect(row('bulwark').props.accessibilityLabel).toBe('Pouvoir : Rempart, 1 Élan, actif');
    expect(screen.getByTestId('battle-power-list-head', hiddenToo)).toHaveTextContent(
      /0 prêt sur 3$/u,
    );
  });

  it('casts the touched power on release, and nothing when released outside (KB5)', async () => {
    const handlers = props();
    await render(<PowerList slots={WANDERER} {...handlers} />);

    await release('rend', false);
    expect(handlers.onCast).not.toHaveBeenCalled();

    await release('rend');
    expect(handlers.onCast).toHaveBeenCalledWith('rend', 0, 0);
  });

  it('passes the touch of an unavailable row to the battle, which ignores it', async () => {
    const handlers = props();
    await render(
      <PowerList slots={[slot('flurry', { availability: 'missing', missing: 1 })]} {...handlers} />,
    );

    await release('flurry');

    expect(handlers.onCast).toHaveBeenCalledWith('flurry', 0, 0);
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it('casts with the screen reader at the JS instant, an unavailable row doing nothing', async () => {
    const handlers = props();
    await render(
      <PowerList
        slots={[slot('rend'), slot('flurry', { availability: 'missing', missing: 1 })]}
        {...handlers}
      />,
    );

    await fireEvent(row('flurry'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(handlers.onCast).not.toHaveBeenCalled();
    await fireEvent(row('rend'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(handlers.onCast).toHaveBeenCalledWith('rend', 4_321, 4_321);
  });

  it('shows the effect above the list on a 400 ms hold, and casts nothing on release (KB11)', async () => {
    const handlers = props();
    await render(<PowerList slots={WANDERER} {...handlers} />);
    const hold = getByGestureTestId(`${powerGestureTestId('rend')}-hold`) as unknown as {
      readonly config: { readonly minDurationMs?: number };
      readonly handlers: Record<string, ((...args: unknown[]) => void) | undefined>;
    };
    expect(hold.config.minDurationMs).toBe(400);

    await act(async () => {
      hold.handlers.onStart?.({});
      await Promise.resolve();
    });
    const tip = within(screen.getByTestId('battle-power-tip'));
    expect(tip.getByText('Entaille')).toBeOnTheScreen();
    expect(tip.getByText('1 Élan · Instantané')).toBeOnTheScreen();
    expect(tip.getByText("Relâche : rien n'est lancé.")).toBeOnTheScreen();
    expect(handlers.onTip).toHaveBeenCalledWith('rend');
    const column = screen.getByTestId('battle-power-list-column').children as unknown as {
      props: { testID?: string };
    }[];
    expect(column[0]!.props.testID).toBe('battle-power-tip');

    await act(async () => {
      fireGestureHandler(getByGestureTestId(powerGestureTestId('rend')) as never, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]);
      hold.handlers.onFinalize?.({}, true);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('battle-power-tip')).toBeNull();
    expect(screen.getByTestId('battle-power-list')).toBeOnTheScreen();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
  });

  it('closes the bubble of the effect when a power is cast (K10)', async () => {
    const handlers = props();
    await render(<PowerList slots={[slot('rend'), slot('mist')]} {...handlers} />);
    await fireEvent(row('rend'), 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    });
    expect(screen.getByTestId('battle-power-tip')).toBeOnTheScreen();

    await fireEvent(row('mist'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(handlers.onCast).toHaveBeenCalledWith('mist', 4_321, 4_321);
    expect(screen.queryByTestId('battle-power-tip')).toBeNull();
  });

  it('opens again without the bubble left open when it was closed (K10)', async () => {
    const { unmount } = await render(<PowerList slots={WANDERER} {...props()} />);
    await fireEvent(row('rend'), 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    });
    expect(screen.getByTestId('battle-power-tip')).toBeOnTheScreen();

    // La liste se ferme (changement de phase), puis s'ouvre de nouveau.
    await unmount();
    await render(<PowerList slots={WANDERER} {...props()} />);

    expect(screen.queryByTestId('battle-power-tip')).toBeNull();
  });

  it("shows the effect to the screen reader by « Voir l'effet », kindled at its cost", async () => {
    const handlers = props();
    await render(
      <PowerList
        slots={[slot('retaliation', { cost: 1, baseCost: 2, kindled: true })]}
        {...handlers}
      />,
    );

    await fireEvent(row('retaliation'), 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    });

    expect(
      within(screen.getByTestId('battle-power-tip')).getByText(
        'Attisé · 1 Élan · Instantané · reste actif',
      ),
    ).toBeOnTheScreen();
    expect(handlers.onCast).not.toHaveBeenCalled();
  });

  it('gives the focus to the first row when it opens (KB2)', async () => {
    // Le préréglage de React Native en fait déjà une fonction simulée : ses appels sont effacés.
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear();
    focus.mockReturnValue();
    await render(<PowerList slots={WANDERER} {...props()} />);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('closes without casting by a touch on the veil, outside the list', async () => {
    const handlers = props();
    await render(<PowerList slots={WANDERER} {...handlers} />);

    const veil = screen.getByTestId('battle-power-list-veil', hiddenToo);
    expect(veil.props.importantForAccessibility).toBe('no-hide-descendants');
    await fireEvent.press(veil);

    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
    expect(handlers.onCast).not.toHaveBeenCalled();
  });

  it('closes without casting by the back gesture, then lets it go once closed', async () => {
    const remove = jest.fn();
    let onBack: ((event: never) => boolean | null | undefined) | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
      expect(event).toBe('hardwareBackPress');
      onBack = handler;
      return { remove };
    });
    const handlers = props();
    const { unmount } = await render(<PowerList slots={WANDERER} {...handlers} />);

    let handled: boolean | null | undefined;
    await act(async () => {
      handled = onBack?.({} as never);
    });
    expect(handled).toBe(true);
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('closes without casting by the escape gesture of the screen reader', async () => {
    const handlers = props();
    await render(<PowerList slots={WANDERER} {...handlers} />);

    await act(async () => {
      screen.getByTestId('battle-power-list').props.onAccessibilityEscape();
    });

    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('rises in 160 ms, and only fades in with reduced motion, in the same time', () => {
    expect(POWER_LIST_MS).toBe(160);
    expect(powerListRise(false)).toBeGreaterThan(0);
    expect(powerListRise(true)).toBe(0);
  });

  it.each([false, true])(
    'plays its entrance even with the reduced motion of the phone (reduced motion: %s)',
    async (reducedMotion) => {
      await render(<PowerList slots={WANDERER} {...props()} reducedMotion={reducedMotion} />);

      const entering = screen.getByTestId('battle-power-list-column').props.entering as {
        readonly reduceMotionV: ReduceMotion;
        readonly durationV: number;
        readonly definitions: Record<string, { readonly transform: unknown }>;
      };
      // Reanimated sauterait le fondu avec le réglage par défaut (`ReduceMotion.System`).
      expect(entering.reduceMotionV).toBe(ReduceMotion.Never);
      expect(entering.durationV).toBe(POWER_LIST_MS);
      expect(entering.definitions['0']!.transform).toEqual([
        { translateY: powerListRise(reducedMotion) },
      ]);
    },
  );

  it('writes « Instantané » readable on a row: #DCCFEA on #1C2133, 10.8:1', () => {
    expect(battleColors.onShadowStep).toBe('#DCCFEA');
    expect(contrast(battleColors.onShadowStep, roles.surface)).toBeGreaterThan(10.7);
  });

  it('does not press an active row down when the finger rests on it (C7b, #120)', async () => {
    await render(
      <PowerList slots={[slot('shadowStep', { availability: 'active' })]} {...props()} />,
    );
    // Une image du fil UI : Reanimated branche le style animé (`setTimeout` de 0 ms), puis le
    // doigt se pose sur la ligne désactivée, sans se lever.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const { handlerTag } = getByGestureTestId('battle-power-shadowStep-look');
    await act(async () => {
      DeviceEventEmitter.emit('onGestureHandlerStateChange', {
        handlerTag,
        state: State.BEGAN,
        oldState: State.UNDETERMINED,
      });
    });

    expect(getAnimatedStyle(row('shadowStep'))).toMatchObject({ transform: [{ translateY: 0 }] });
    expect(
      getAnimatedStyle(screen.getByTestId('battle-power-shadowStep-edge', hiddenToo)),
    ).toMatchObject({ backgroundColor: roles.raised });
  });
});
