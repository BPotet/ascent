// Le pouvoir attisé en combat (#237, maquette 232 : S11 et S12) : sa touche bordée de braise, avec
// la flamme et « 2 → 1 Élan » ; la bulle du toucher maintenu dit « Attisé · 1 Élan » ; le mot de
// scène a la ligne « Attisé · 1 Élan » dessous.
import { act, render, screen, within } from '@testing-library/react-native';

import type { PowerKind } from '../../../domain/battle/powers';
import { artPalette } from '../pixelArt/artPalette';
import type { ActionPad as Pad, PowerSlot } from '../state/battleView';
import { ActionPad } from './ActionPad';
import { FeedbackLabel } from './BattleEffects';

const { roles } = artPalette;
const hiddenToo = { includeHiddenElements: true } as const;

const slot = (power: PowerKind, change: Partial<PowerSlot> = {}): PowerSlot => ({
  power,
  cost: 1,
  availability: 'available',
  missing: 0,
  ...change,
});

function heroPad(...powers: PowerSlot[]): Pad {
  return { kind: 'hero', locked: false, lock: null, powers };
}

const handlers = {
  targetName: 'Goule',
  uiNow: () => 0,
  now: () => 0,
  onDefense: jest.fn(),
  onAttack: jest.fn(),
  onPower: jest.fn(),
  onStrike: jest.fn(),
  onPowerTip: jest.fn(),
};

const KINDLED_RETALIATION = slot('retaliation', {
  cost: 1,
  baseCost: 2,
  kindled: true,
  instant: true,
});
const key = (power: PowerKind) => screen.getByTestId(`battle-power-button-${power}`);

describe('the key of a kindled power (#237, S11)', () => {
  it('shows the flame and « 2 → 1 Élan », bordered with ember, and reads it', async () => {
    await render(
      <ActionPad
        pad={heroPad(slot('bulwark'), KINDLED_RETALIATION, slot('holdFast', { cost: 3 }))}
        {...handlers}
      />,
    );

    expect(within(key('retaliation')).getByText('2 → 1 Élan')).toBeOnTheScreen();
    expect(screen.getByTestId('battle-power-kindled-retaliation', hiddenToo)).toBeOnTheScreen();
    expect(key('retaliation')).toHaveStyle({ borderColor: roles.ember });
    expect(key('retaliation').props.accessibilityLabel).toBe(
      'Pouvoir : Représailles, attisé, 1 Élan au lieu de 2, instantané',
    );
    expect(screen.queryByTestId('battle-power-kindled-holdFast', hiddenToo)).toBeNull();
    expect(within(key('holdFast')).getByText('3 Élan')).toBeOnTheScreen();
  });

  it('says what is missing at the kindled cost', async () => {
    await render(
      <ActionPad
        pad={heroPad(
          slot('holdFast', {
            cost: 2,
            baseCost: 3,
            kindled: true,
            availability: 'missing',
            missing: 1,
          }),
        )}
        {...handlers}
      />,
    );

    expect(within(key('holdFast')).getByText('Il manque\n1 Élan')).toBeOnTheScreen();
    expect(key('holdFast').props.accessibilityLabel).toBe(
      'Pouvoir : Tenir bon, attisé, 2 Élan au lieu de 3, indisponible : il manque 1 Élan',
    );
  });

  it('writes « Attisé · 1 Élan » in the bubble of the long press', async () => {
    await render(<ActionPad pad={heroPad(KINDLED_RETALIATION)} {...handlers} />);

    await act(async () => {
      key('retaliation').props.onAccessibilityAction({ nativeEvent: { actionName: 'longpress' } });
    });

    expect(
      within(screen.getByTestId('battle-power-tip')).getByText(
        'Attisé · 1 Élan · Instantané · reste actif',
      ),
    ).toBeOnTheScreen();
  });
});

describe('the scene word of a kindled power (#237, S12)', () => {
  it('writes « Attisé · 1 Élan » under the name of the power', async () => {
    await render(
      <FeedbackLabel
        texts={[{ tone: 'perfect', title: 'Représailles', sub: 'Attisé · 1 Élan' }]}
      />,
    );

    expect(screen.getByText('Représailles')).toBeOnTheScreen();
    expect(screen.getByText('Attisé · 1 Élan')).toBeOnTheScreen();
  });
});
