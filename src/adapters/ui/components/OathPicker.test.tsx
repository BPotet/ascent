// Le choix de l'habitude d'un Serment (#237, maquette 232 : S2 et S3) : une ligne de 56 dp par
// habitude, un toucher pour choisir ; une habitude liée à un autre pouvoir le dit et ne se choisit
// pas ; sans habitude, la feuille dit où en créer une.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { CampHabit, CampView } from '../../../application/useCases/CampSession';
import { OathPicker } from './OathPicker';

const HABITS: readonly CampHabit[] = [
  { id: 1, name: 'Courir 20 minutes' },
  { id: 2, name: 'Lire 10 pages' },
  { id: 3, name: "Boire 1,5 L d'eau" },
];

async function open({
  habits = HABITS,
  oaths = {},
  error = false,
}: {
  habits?: readonly CampHabit[] | null;
  oaths?: CampView['oaths'];
  error?: boolean;
} = {}) {
  const props = {
    onSwear: jest.fn(),
    onRetryHabits: jest.fn(),
    onGoToDay: jest.fn(),
    onClose: jest.fn(),
  };
  await render(
    <OathPicker power="retaliation" habits={habits} oaths={oaths} error={error} {...props} />,
  );
  return props;
}

const row = (id: number) => screen.getByTestId(`oath-habit-${id}`);
const swear = () => screen.getByTestId('oath-swear');

describe('OathPicker (#237)', () => {
  it('lists the habits as radio buttons of 56 dp, none chosen, the button off (S2)', async () => {
    await open();

    expect(screen.getByRole('header', { name: 'Prêter serment' })).toBeOnTheScreen();
    expect(screen.getByTestId('oath-habits')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByTestId('oath-habits')).toHaveProp('accessibilityLabel', 'Habitudes');
    expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(
      HABITS.map(({ name }) => name),
    );
    expect(StyleSheet.flatten(row(1).props.style).minHeight).toBe(56);
    expect(
      screen.getByText(
        "Choisis l'habitude qui attisera Représailles : faite la veille, il coûte 1 Élan au lieu de 2, pour toute l'ascension.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Le Serment compte dès demain. Tu pourras changer d'habitude au camp."),
    ).toBeOnTheScreen();
    expect(swear()).toHaveProp(
      'accessibilityLabel',
      'Prêter serment, indisponible : choisis une habitude',
    );
    expect(swear()).toBeDisabled();
  });

  it('chooses a habit, then swears on it', async () => {
    const { onSwear } = await open();

    await fireEvent.press(row(1));

    expect(row(1)).toHaveProp('accessibilityState', { checked: true, disabled: false });
    expect(swear()).toHaveProp('accessibilityLabel', 'Prêter serment sur « Courir 20 minutes »');
    await fireEvent.press(swear());
    expect(onSwear).toHaveBeenCalledWith(1);
  });

  it('shows a habit bound to another power, which cannot be chosen', async () => {
    const { onSwear } = await open({
      oaths: { mist: { habit: 2, name: 'Lire 10 pages', since: '2026-11-01' } },
    });

    expect(within(row(2)).getByText('Déjà liée à Brume')).toBeOnTheScreen();
    expect(row(2)).toHaveProp('accessibilityLabel', 'Lire 10 pages, déjà liée à Brume');
    expect(row(2)).toBeDisabled();
    await fireEvent.press(row(2));
    expect(swear()).toBeDisabled();
    expect(onSwear).not.toHaveBeenCalled();
  });

  it('checks the habit of the current Oath, and swears only on another one', async () => {
    const { onSwear } = await open({
      oaths: { retaliation: { habit: 1, name: 'Courir 20 minutes', since: '2026-11-01' } },
    });

    expect(row(1)).toHaveProp('accessibilityState', { checked: true, disabled: false });
    expect(swear()).toBeDisabled();
    await fireEvent.press(row(3));
    await fireEvent.press(swear());
    expect(onSwear).toHaveBeenCalledWith(3);
  });

  it('says that the Oath could not be saved, and lets swear again', async () => {
    const { onSwear } = await open({ error: true });

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Le Serment n'a pas pu être enregistré. Réessaie.",
    );
    await fireEvent.press(row(2));
    await fireEvent.press(swear());
    expect(onSwear).toHaveBeenCalledWith(2);
  });

  it('says where to create a habit when there is none (S3)', async () => {
    const { onGoToDay } = await open({ habits: [] });

    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    expect(
      screen.getByText(
        "Tu n'as pas encore d'habitude. Crée-en une dans l'onglet Journée, puis reviens prêter serment.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('oath-swear')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Aller à la Journée' }));
    expect(onGoToDay).toHaveBeenCalled();
  });

  it('lets read the habits again when they could not be read', async () => {
    const { onRetryHabits } = await open({ habits: null });

    expect(screen.getByText("Tes habitudes n'ont pas pu être lues.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetryHabits).toHaveBeenCalled();
  });

  it('closes', async () => {
    const { onClose } = await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OathPicker while an Oath is being saved (#237)', () => {
  it('keeps « Prêter serment » off and says it is in progress', async () => {
    const onSwear = jest.fn();
    await render(
      <OathPicker
        power="retaliation"
        habits={HABITS}
        oaths={{}}
        error={false}
        busy
        onSwear={onSwear}
        onRetryHabits={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(row(1));
    expect(swear()).toBeDisabled();
    expect(swear()).toHaveProp('accessibilityLabel', 'Prêter serment, en cours');
    await fireEvent.press(swear());
    expect(onSwear).not.toHaveBeenCalled();
  });
});
