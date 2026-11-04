// « Exporter le journal » sur l'écran de fin de l'ascension (#196, maquette 193 : E1, E2, E4, A1).
import { fireEvent, screen } from '@testing-library/react-native';

import type { LogExport } from '../../../application/useCases/exportAscentLog';
import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import { ascentSetUp } from '../testing/ascent';
import { fakeLogExport } from '../testing/fakeLogExport';
import { renderScreen } from '../testing/renderScreen';
import { AscentScreen } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

async function show(saved: Ascent, logExport?: LogExport) {
  const setUp = ascentSetUp({ saved });
  await setUp.session.load();
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={jest.fn()}
      logExport={logExport}
    />,
    setUp.dependencies,
  );
}

const ended = (outcome: 'fall' | 'victory'): Ascent => ({
  ...startAscent(42),
  tier: 2,
  floor: 4,
  encounter: null,
  outcome,
});

describe('AscentScreen end with the log export', () => {
  it.each([
    ['a fall (E1)', ended('fall'), "Fin de l'ascension"],
    ['the Summit (E2)', ended('victory'), 'Sommet atteint'],
  ])('shows the button under « Retour au pied de la tour » after %s', async (_, ascent, title) => {
    const { logExport } = fakeLogExport();
    await show(ascent, logExport);
    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button');
    const names = buttons.map((each) => each.props.accessibilityLabel as string | undefined);
    expect(names.slice(-2)).toEqual(['Retour au pied de la tour', 'Exporter le journal']);
    expect(await screen.findByRole('button', { name: 'Exporter le journal' })).toBeEnabled();
    // Pas de ligne de compte sur l'écran de fin.
    expect(screen.queryByText('7 ascensions')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter le journal' }));
    expect(logExport.exports).toHaveBeenCalledTimes(1);
  });

  it('shows the red error line under the button (E4)', async () => {
    const { logExport, willExport } = fakeLogExport();
    willExport(() => Promise.reject(new Error('No share menu')));
    await show(ended('fall'), logExport);
    await fireEvent.press(screen.getByRole('button', { name: 'Exporter le journal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le journal n'a pas pu être exporté. Réessaie.",
    );
  });

  it('shows no button without the log export (production build)', async () => {
    await show(ended('fall'));
    expect(screen.queryByText('Exporter le journal')).not.toBeOnTheScreen();
  });
});
