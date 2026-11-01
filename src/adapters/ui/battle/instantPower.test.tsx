// #173 : le pouvoir instantané de l'Errante sur l'écran de combat (maquette 170, écrans E1 à E6) :
// la touche Pouvoir et sa mention « Instantané », le focus sur Attaquer après le lancer, et
// l'étiquette « Pas de l'ombre » sous les PV.
import { act, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import type { ActionPad as Pad, PowerSlot } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { ActionPad } from './ActionPad';
import { HeroBar } from './HeroBar';

const hiddenToo = { includeHiddenElements: true } as const;

function style(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);
}

function padProps() {
  return {
    targetName: 'Goule',
    uiNow: () => 0,
    now: () => 4_321,
    onDefense: jest.fn(),
    onAttack: jest.fn(),
    onPower: jest.fn(),
    onStrike: jest.fn(),
  } as const;
}

const ready: PowerSlot = { power: 'shadowStep', cost: 3, missing: 0, instant: true };

function heroPad(power: PowerSlot): Pad {
  return { kind: 'hero', locked: false, lock: null, power };
}

/** La luminance relative d'une couleur `#RRGGBB` (WCAG 2.1). */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe('the Power key of an instant power (E1, E5, E6)', () => {
  it("says « Pas de l'ombre » and, under it, « 3 Élan · Instantané » with its crescent (E1)", async () => {
    await render(<ActionPad pad={heroPad(ready)} {...padProps()} />);

    const power = screen.getByTestId('battle-power-button');
    expect(power).toHaveTextContent("PouvoirPas de l'ombre3 Élan · Instantané");
    expect(power.props.accessibilityLabel).toBe("Pouvoir : Pas de l'ombre, 3 Élan, instantané");
    expect(power.props.accessibilityState).toEqual({ disabled: false });
    expect(within(power).getByTestId('battle-power-crescent', hiddenToo)).toBeTruthy();
    expect(style('battle-power-instant')).toMatchObject({ color: battleColors.onShadowStep });
  });

  it('puts the crescent right before « Instantané », after « 3 Élan · », on one line (E1)', async () => {
    await render(<ActionPad pad={heroPad(ready)} {...padProps()} />);

    const row = screen.getByTestId('battle-power-instant-row', hiddenToo);
    expect(row).toHaveTextContent('3 Élan · Instantané');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row' });
    const parts = row.children.map((part) =>
      typeof part === 'string' ? part : (part.props.testID ?? part.props.children),
    );
    expect(parts).toEqual(['3 Élan · ', 'battle-power-crescent', 'battle-power-instant']);
    expect(screen.getByTestId('battle-power-instant', hiddenToo)).toHaveTextContent('Instantané');
  });

  it('writes « Instantané » readable on the key: #DCCFEA on #1C2133, 10.8:1', () => {
    expect(battleColors.onShadowStep).toBe('#DCCFEA');
    expect(contrast(battleColors.onShadowStep, '#1C2133')).toBeGreaterThan(10.7);
  });

  it('is hatched and tells the momentum it misses (E5)', async () => {
    await render(<ActionPad pad={heroPad({ ...ready, missing: 1 })} {...padProps()} />);

    const power = screen.getByTestId('battle-power-button');
    expect(power).toHaveTextContent('PouvoirIl manque 1 Élan');
    expect(power.props.accessibilityLabel).toBe(
      "Pouvoir : Pas de l'ombre, 3 Élan, instantané, indisponible : il manque 1 Élan",
    );
    expect(power.props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByTestId('battle-power-hatching', hiddenToo)).toBeTruthy();
  });

  it('says « ✓ Actif » and is unavailable while it is active (E6)', async () => {
    await render(<ActionPad pad={heroPad({ ...ready, active: true })} {...padProps()} />);

    const power = screen.getByTestId('battle-power-button');
    expect(power).toHaveTextContent('PouvoirActif');
    expect(power.props.accessibilityLabel).toBe(
      "Pouvoir : Pas de l'ombre, 3 Élan, instantané, actif",
    );
    expect(power.props.accessibilityState).toEqual({ disabled: true });
    expect(within(power).getByTestId('battle-power-active-check', hiddenToo)).toBeTruthy();
  });

  it('never says « Instantané » on the Bulwark', async () => {
    await render(
      <ActionPad pad={heroPad({ power: 'bulwark', cost: 1, missing: 0 })} {...padProps()} />,
    );

    expect(screen.getByTestId('battle-power-button')).toHaveTextContent('PouvoirRempart · 1 Élan');
    expect(screen.queryByText(/Instantané/, hiddenToo)).toBeNull();
  });
});

describe('the focus after the instant power (E2)', () => {
  // Le préréglage de React Native en fait déjà une fonction simulée : ses appels sont effacés.
  beforeEach(() => jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('moves to « Attaquer » just after the cast, Attaquer staying available', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    const props = padProps();
    await render(<ActionPad pad={heroPad(ready)} {...props} />);
    expect(focus).not.toHaveBeenCalled();

    await act(async () => {
      screen.rerender(
        <ActionPad pad={heroPad({ ...ready, active: true, instantCast: true })} {...props} />,
      );
    });

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(screen.getByTestId('battle-attack-button').props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it('stays put when the Shadow Step was already active at the start of the phase', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    await render(<ActionPad pad={heroPad({ ...ready, active: true })} {...padProps()} />);

    expect(focus).not.toHaveBeenCalled();
  });
});

describe("the « Pas de l'ombre » chip under the HP (E2 to E4, E6)", () => {
  const wanderer = { hp: 41, maxHp: 55, momentum: 0, bulwark: false } as const;

  it('shows the crescent and the word while the Shadow Step is active', async () => {
    await render(<HeroBar hero={{ ...wanderer, shadowStep: true }} kind="wanderer" />);

    const chip = screen.getByTestId('battle-shadow-step-chip', hiddenToo);
    expect(chip).toHaveTextContent("Pas de l'ombre");
    expect(within(chip).getByTestId('battle-shadow-step-crescent', hiddenToo)).toBeTruthy();
    expect(StyleSheet.flatten(chip.props.style)).toMatchObject({
      backgroundColor: battleColors.shadowStepBg,
      borderColor: battleColors.shadowStep,
    });
    expect(
      screen.getByLabelText("L'Errante, PV 41 sur 55, Élan 0 sur 5, Pas de l'ombre"),
    ).toBeOnTheScreen();
  });

  it('is outlined brighter just after the cast', async () => {
    await render(
      <HeroBar hero={{ ...wanderer, shadowStep: true }} kind="wanderer" shadowStepNew />,
    );

    expect(style('battle-shadow-step-chip')).toMatchObject({
      borderColor: battleColors.shadowStepNew,
    });
  });

  it('reads #DCCFEA on #2A2236, 10.3:1', () => {
    expect(battleColors.shadowStepBg).toBe('#2A2236');
    expect(contrast(battleColors.onShadowStep, battleColors.shadowStepBg)).toBeGreaterThan(10.2);
  });

  it('is gone once the Shadow Step is used', async () => {
    await render(<HeroBar hero={{ ...wanderer, shadowStep: false }} kind="wanderer" />);

    expect(screen.queryByTestId('battle-shadow-step-chip', hiddenToo)).toBeNull();
    expect(screen.getByLabelText("L'Errante, PV 41 sur 55, Élan 0 sur 5")).toBeOnTheScreen();
  });
});
