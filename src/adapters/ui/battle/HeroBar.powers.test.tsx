// Les charges des pouvoirs sous les PV (#173, #235 : maquettes 170 et 232, E2 à E6, K5, K6) : une
// étiquette par charge active ; elles restent visibles, liste des pouvoirs ouverte ou fermée (#271).
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { HeroState } from '../../../domain/battle/Battle';
import { contrast } from '../testing/contrast';
import { battleColors } from '../theme/battleColors';
import { HeroBar } from './HeroBar';

const hiddenToo = { includeHiddenElements: true } as const;

function style(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);
}

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

  it('comes after the Bleed chip, and is read last (E2, chips of the mockup)', async () => {
    await render(
      <HeroBar
        hero={{ ...wanderer, shadowStep: true, bleed: { damage: 2, rounds: 3 } }}
        kind="wanderer"
      />,
    );

    const bar = screen.getByTestId('battle-hero-bar');
    const chips = screen
      .getAllByTestId(/^battle-(bleed|shadow-step)-chip$/u, hiddenToo)
      .map((chip) => chip.props.testID);
    expect(chips).toEqual(['battle-bleed-chip', 'battle-shadow-step-chip']);
    expect(bar.props.accessibilityLabel).toBe(
      "L'Errante, PV 41 sur 55, Élan 0 sur 5, Saignement ×3, Pas de l'ombre",
    );
  });

  it('is gone once the Shadow Step is used', async () => {
    await render(<HeroBar hero={{ ...wanderer, shadowStep: false }} kind="wanderer" />);

    expect(screen.queryByTestId('battle-shadow-step-chip', hiddenToo)).toBeNull();
    expect(screen.getByLabelText("L'Errante, PV 41 sur 55, Élan 0 sur 5")).toBeOnTheScreen();
  });
});
