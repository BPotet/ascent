// Le Choix du héros (#235, maquette 232 : H1, H2) : la carte de chaque héros montre ses pouvoirs
// équipés à la place du seul pouvoir de base. Rien à choisir dans cette story.
import { fireEvent, screen, within } from '@testing-library/react-native';

import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { HeroChoiceScreen } from './HeroChoiceScreen';

async function show(equipped?: Readonly<Record<HeroKind, readonly PowerKind[]>>) {
  const onStart = jest.fn();
  await renderScreen(
    <HeroChoiceScreen
      onStart={onStart}
      onClose={jest.fn()}
      title="Choisir un héros"
      note="Il ne change plus jusqu'à la fin de l'ascension."
      confirmLabel={(hero) => `Continuer avec ${hero}`}
      {...(equipped && { equipped })}
    />,
    ascentSetUp().dependencies,
  );
  return { onStart };
}

const card = (hero: HeroKind) => within(screen.getByTestId(`hero-choice-${hero}`));

describe('HeroChoiceScreen: the equipped powers (#235)', () => {
  it('shows the base power then two free places without any power unlocked (H1)', async () => {
    await show();

    expect(card('sentinel').getByText('Pouvoirs équipés · 1 sur 3')).toBeOnTheScreen();
    expect(card('sentinel').getByText('Rempart')).toBeOnTheScreen();
    expect(card('sentinel').getAllByText('Place libre')).toHaveLength(2);
    expect(screen.getByTestId('hero-choice-sentinel').props.accessibilityLabel).toContain(
      'Pouvoirs équipés : Rempart, 1 Élan.',
    );
    expect(card('wanderer').getByText('Pouvoirs · 1 sur 3')).toBeOnTheScreen();
  });

  it('shows the 3 equipped powers in the order of the tree, nothing to choose (H2)', async () => {
    await show({
      sentinel: ['bulwark', 'retaliation', 'holdFast'],
      wanderer: ['shadowStep', 'rend', 'mist'],
    });

    expect(card('sentinel').getByText('Pouvoirs équipés · 3 sur 3')).toBeOnTheScreen();
    const names = card('sentinel')
      .getAllByTestId(/^equipped-power-/u)
      .map((cell) => cell.props.testID);
    expect(names).toEqual([
      'equipped-power-bulwark',
      'equipped-power-retaliation',
      'equipped-power-holdFast',
    ]);
    expect(card('sentinel').queryByText('Place libre')).not.toBeOnTheScreen();
    expect(card('sentinel').getByText('2 Élan')).toBeOnTheScreen();
    expect(screen.queryByText(/Changer les pouvoirs/)).not.toBeOnTheScreen();
    expect(screen.getByTestId('hero-choice-sentinel').props.accessibilityLabel).toContain(
      'Pouvoirs équipés : Rempart, 1 Élan ; Représailles, 2 Élan ; Tenir bon, 3 Élan.',
    );
  });

  it('describes each equipped power by the text of the Codex', async () => {
    await show();

    expect(card('sentinel').getByTestId('equipped-power-bulwark').props.accessibilityLabel).toMatch(
      /^Rempart, 1 Élan : Elle plante son bouclier/u,
    );
  });

  it('starts with the chosen hero', async () => {
    const { onStart } = await show();

    await fireEvent.press(screen.getByTestId('hero-choice-wanderer'));
    await fireEvent.press(screen.getByTestId('hero-choice-start'));

    expect(onStart).toHaveBeenCalledWith('wanderer');
    expect(card('wanderer').getByText('Pouvoirs équipés · 1 sur 3')).toBeOnTheScreen();
  });
});
