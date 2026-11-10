// Les pouvoirs équipés au Choix du héros (#236, #270, maquette 269 : H1 à H4) : un résumé en lecture
// seule, la rangée « Pouvoirs équipés · n sur 3 » dans l'ordre de l'arbre, le lien discret
// « Changer les pouvoirs » vers le menu des pouvoirs à partir de 4 pouvoirs possédés, et l'échec
// d'enregistrement au lancement.
import { fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { HeroChoiceScreen } from './HeroChoiceScreen';

reduceMotionInEachTest();

type ByHero = Readonly<Record<HeroKind, readonly PowerKind[]>>;

const FIVE: ByHero = {
  sentinel: ['bulwark', 'retaliation', 'holdFast'],
  wanderer: ['shadowStep', 'rend', 'flurry', 'mist', 'ambush'],
};

async function show({
  equipped = {
    sentinel: ['bulwark', 'retaliation', 'holdFast'],
    wanderer: ['shadowStep', 'rend', 'mist'],
  },
  owned = FIVE,
  starting = false,
  failed = false,
}: {
  readonly equipped?: ByHero;
  readonly owned?: ByHero;
  readonly starting?: boolean;
  readonly failed?: boolean;
} = {}) {
  const onStart = jest.fn();
  const onChangePowers = jest.fn();
  const view = await renderScreen(
    <HeroChoiceScreen
      onStart={onStart}
      onClose={jest.fn()}
      title="Choisir un héros"
      note="Il ne change plus jusqu'à la fin de l'ascension."
      confirmLabel={(hero) => `Continuer avec ${hero}`}
      equipped={equipped}
      owned={owned}
      onChangePowers={onChangePowers}
      starting={starting}
      failed={failed}
    />,
    ascentSetUp().dependencies,
  );
  return { onStart, onChangePowers, view };
}

const card = (hero: HeroKind) => within(screen.getByTestId(`hero-choice-${hero}`));
const link = () => screen.queryByTestId('hero-choice-change-powers');

describe('HeroChoiceScreen: the summary of the equipped powers (#236, #270)', () => {
  it('shows the row « Pouvoirs équipés · 3 sur 3 », without button nor panel (H1)', async () => {
    await show();

    expect(card('sentinel').getByText('Pouvoirs équipés · 3 sur 3')).toBeOnTheScreen();
    expect(link()).not.toBeOnTheScreen();
    expect(screen.queryByText(/débloqués/u)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('equipped-powers-panel')).not.toBeOnTheScreen();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });

  it('offers the discreet link to the menu for the chosen hero with 4 powers or more (H2)', async () => {
    const { onChangePowers } = await show();

    await fireEvent.press(screen.getByTestId('hero-choice-wanderer'));

    expect(link()).toHaveTextContent('Changer les pouvoirs');
    expect(link()!.props.accessibilityLabel).toBe(
      "Changer les pouvoirs de l'Errante : ouvre le menu des pouvoirs",
    );
    expect(StyleSheet.flatten(link()!.props.style).minHeight).toBe(48);
    await fireEvent.press(link()!);
    expect(onChangePowers).toHaveBeenCalledWith('wanderer');
  });

  it('offers no link with 3 powers or fewer', async () => {
    await show({ owned: { sentinel: ['bulwark', 'retaliation'], wanderer: FIVE.wanderer } });

    expect(link()).not.toBeOnTheScreen();
  });

  it('shows the chosen row in the order of the tree, « Coup de bouclier » in full', async () => {
    await show({
      equipped: {
        sentinel: ['retaliation', 'crushingBlow', 'shieldBash'],
        wanderer: ['shadowStep'],
      },
      owned: {
        sentinel: ['bulwark', 'shieldBash', 'crushingBlow', 'retaliation', 'holdFast'],
        wanderer: ['shadowStep'],
      },
    });

    const cells = card('sentinel')
      .getAllByTestId(/^equipped-power-/u)
      .map((cell) => cell.props.testID);
    expect(cells).toEqual([
      'equipped-power-shieldBash',
      'equipped-power-crushingBlow',
      'equipped-power-retaliation',
    ]);
    expect(card('sentinel').getByText('Coup de bouclier')).toBeOnTheScreen();
    expect(screen.queryByText("Coup d'écu")).not.toBeOnTheScreen();
    expect(link()).toBeOnTheScreen();
  });

  it('waits while the choice is saved, with « Continuer » disabled', async () => {
    const { onStart } = await show({ starting: true });

    const button = screen.getByTestId('hero-choice-start');
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
    await fireEvent.press(button);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('says when the choice cannot be saved, and lets the player try again (H4)', async () => {
    const { onStart } = await show({ failed: true });

    expect(
      screen.getByText(
        "Tes pouvoirs n'ont pas pu être enregistrés. Ton choix est gardé : réessaie.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onStart).toHaveBeenCalledWith('sentinel');
  });
});
