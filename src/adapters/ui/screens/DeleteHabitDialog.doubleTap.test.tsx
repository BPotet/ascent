import { fireEvent, render, screen } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import type { DeleteHabitOutcome } from '../state/useEditHabit';
import { DeleteHabitDialog } from './DeleteHabitDialog';

// Sur le téléphone, deux taps rapides peuvent arriver avant que « Supprimer » ne soit redessiné,
// désactivé. Ce bouton simulé laisse passer le second tap, comme le ferait le téléphone.
jest.mock('../pixelArt/PixelButton', () => {
  const { Pressable, Text } = jest.requireActual<typeof ReactNative>('react-native');
  return {
    PixelButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

describe('DeleteHabitDialog and a double tap', () => {
  it('deletes only once when « Supprimer » is touched twice before it is disabled', async () => {
    const onConfirm = jest.fn(() => new Promise<DeleteHabitOutcome>(() => undefined));
    await render(
      <DeleteHabitDialog
        name="Cuisiner"
        xpRemoved={10}
        onConfirm={onConfirm}
        onDeleted={jest.fn()}
        onGone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
