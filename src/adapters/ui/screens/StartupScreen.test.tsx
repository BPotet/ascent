import { fireEvent, screen } from '@testing-library/react-native';

import { Day } from '../../../domain/day/Day';
import { renderScreen } from '../testing/renderScreen';
import { StartupErrorScreen, StartupLoadingScreen } from './StartupScreen';

const dependencies = { clock: { today: () => Day.of(2026, 10, 14) } };

describe('Startup screens', () => {
  it('shows a loading indicator', async () => {
    await renderScreen(<StartupLoadingScreen />, dependencies);

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
  });

  it('explains the error and offers to retry', async () => {
    const onRetry = jest.fn();
    await renderScreen(<StartupErrorScreen onRetry={onRetry} />, dependencies);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Impossible d’ouvrir les données enregistrées sur le téléphone.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
