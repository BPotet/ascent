// Le choix des pouvoirs équipés au Choix du héros (#236, maquette 232 : H3 à H8) : « Changer les
// pouvoirs » à partir de 4 pouvoirs possédés, le panneau « Pouvoirs équipés · n sur 3 », la
// nouvelle rangée dans l'ordre de l'arbre, et l'échec d'enregistrement au lancement.
import { fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

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
const panel = () => within(screen.getByTestId('equipped-powers-panel'));
const row = (power: PowerKind) => screen.getByTestId(`equipped-powers-row-${power}`);

async function openPanel(hero: HeroKind = 'wanderer') {
  await fireEvent.press(screen.getByTestId(`hero-choice-${hero}`));
  await fireEvent.press(screen.getByRole('button', { name: /^Changer les pouvoirs/u }));
  return panel();
}

describe('HeroChoiceScreen: changing the equipped powers (#236)', () => {
  it('shows « Changer les pouvoirs » from 4 owned powers only, with their number (H3)', async () => {
    await show();

    expect(screen.queryByRole('button', { name: /^Changer les pouvoirs/u })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('hero-choice-wanderer'));

    expect(
      screen.getByRole('button', { name: 'Changer les pouvoirs, 5 débloqués' }),
    ).toBeOnTheScreen();
  });

  it('lists every owned power in the order of the tree, ticked or not (H4)', async () => {
    await show();
    const sheet = await openPanel();

    const rows = screen.getAllByTestId(/^equipped-powers-row-/u).map((cell) => cell.props.testID);
    expect(rows).toEqual([
      'equipped-powers-row-shadowStep',
      'equipped-powers-row-rend',
      'equipped-powers-row-flurry',
      'equipped-powers-row-mist',
      'equipped-powers-row-ambush',
    ]);
    expect(sheet.getByText('3 sur 3')).toBeOnTheScreen();
    expect(row('rend').props.accessibilityState).toMatchObject({ checked: true });
    expect(row('flurry').props.accessibilityState).toMatchObject({ checked: false });
    expect(row('flurry').props.accessibilityLabel).toBe(
      'Rafale, 2 Élan, Frappe. Une frappe en 4 coups.',
    );
    expect(within(row('shadowStep')).getByText('base')).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'Valider' })).toBeOnTheScreen();
  });

  it('refuses a 4th power and says what to do, nothing unticked by itself (H5)', async () => {
    await show();
    await openPanel();

    await fireEvent.press(row('flurry'));

    expect(row('flurry').props.accessibilityState).toMatchObject({ checked: false });
    expect(
      panel().getByText("3 sur 3 : retire d'abord un pouvoir pour équiper Rafale."),
    ).toBeOnTheScreen();
    expect(row('shadowStep').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('cannot validate with fewer than 3 powers, the base power left aside (H6)', async () => {
    const { onChangePowers } = await show();
    await openPanel();

    await fireEvent.press(row('shadowStep'));

    expect(panel().getByText('2 sur 3')).toBeOnTheScreen();
    const button = panel().getByRole('button', {
      name: 'Valider, indisponible : choisis encore 1 pouvoir',
    });
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
    expect(panel().getByText('Choisis encore 1 pouvoir')).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onChangePowers).not.toHaveBeenCalled();
    await fireEvent.press(row('mist'));
    expect(panel().getByText('Choisis encore 2 pouvoirs')).toBeOnTheScreen();
  });

  it('validates a new choice, in the order of the tree, and announces it (H7)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onChangePowers } = await show();
    await openPanel();

    await fireEvent.press(row('shadowStep'));
    await fireEvent.press(row('flurry'));
    await fireEvent.press(panel().getByRole('button', { name: 'Valider' }));

    expect(onChangePowers).toHaveBeenCalledWith('wanderer', ['rend', 'flurry', 'mist']);
    expect(screen.queryByTestId('equipped-powers-panel')).not.toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('3 pouvoirs équipés : Entaille, Rafale, Brume.');
  });

  it('closes the panel without changing anything', async () => {
    const { onChangePowers } = await show();
    await openPanel();
    await fireEvent.press(row('shadowStep'));

    await fireEvent.press(panel().getByRole('button', { name: 'Fermer' }));

    expect(onChangePowers).not.toHaveBeenCalled();
    expect(screen.queryByTestId('equipped-powers-panel')).not.toBeOnTheScreen();
  });

  it('shows the chosen row in the order of the tree, « Coup de bouclier » in full (H8)', async () => {
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
    expect(
      screen.getByRole('button', { name: 'Changer les pouvoirs, 5 débloqués' }),
    ).toBeOnTheScreen();
  });

  it('waits while the choice is saved, with « Continuer » disabled', async () => {
    const { onStart } = await show({ starting: true });

    const button = screen.getByTestId('hero-choice-start');
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
    await fireEvent.press(button);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('says when the choice cannot be saved, and lets the player try again', async () => {
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
