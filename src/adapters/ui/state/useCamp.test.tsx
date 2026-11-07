// Le camp affiché relit les habitudes quand une autre vue en crée, renomme ou supprime une (#237) :
// le choix du Serment et l'état « rompu » suivent sans relancer l'app.
import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { CampSession } from '../../../application/useCases/CampSession';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { useTrackingChanges } from './TrackingRevision';
import { useCamp } from './useCamp';

function Habits({ camp }: { readonly camp: CampSession }) {
  const view = useCamp(camp);
  return <Text testID="habits">{(view.habits ?? []).map(({ name }) => name).join(', ')}</Text>;
}

function OtherView() {
  const changed = useTrackingChanges(() => undefined);
  return <Pressable accessibilityRole="button" accessibilityLabel="Changer" onPress={changed} />;
}

describe('useCamp (#237)', () => {
  it('reads the habits again after a change saved by another view', async () => {
    const { camp, dependencies } = ascentSetUp();
    const add = (name: string) =>
      dependencies.unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse(name), Day.of(2026, 10, 1)),
      );
    await add('Courir');
    await renderScreen(
      <>
        <Habits camp={camp} />
        <OtherView />
      </>,
      dependencies,
    );
    expect(await screen.findByText('Courir')).toBeOnTheScreen();

    await add('Lire');
    await fireEvent.press(screen.getByRole('button', { name: 'Changer' }));

    expect(await screen.findByText('Courir, Lire')).toBeOnTheScreen();
  });
});
