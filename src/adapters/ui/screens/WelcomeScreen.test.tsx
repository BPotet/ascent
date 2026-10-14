import { render, screen } from '@testing-library/react-native';

import type { Clock } from '../../../application/ports/Clock';
import { Day } from '../../../domain/day/Day';
import { renderScreen } from '../testing/renderScreen';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen', () => {
  it('shows the app name and today in full', async () => {
    const clock: Clock = { today: () => Day.of(2026, 10, 14) };

    await renderScreen(<WelcomeScreen />, { clock });

    expect(screen.getByRole('header', { name: 'Ascent' })).toBeOnTheScreen();
    expect(screen.getByText('mercredi 14 octobre 2026')).toBeOnTheScreen();
  });

  it('cannot be used without dependencies', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(render(<WelcomeScreen />)).rejects.toThrow(
      'useDependencies must be used inside a DependenciesProvider',
    );
  });
});
