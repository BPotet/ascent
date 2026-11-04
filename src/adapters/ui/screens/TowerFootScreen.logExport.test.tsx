// « Exporter le journal » au Pied de la tour (#196, maquette 193 : P1 à P4, E3, A1).
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { LogExport } from '../../../application/useCases/exportAscentLog';
import { startAscent } from '../../../domain/ascent/Ascent';
import { ascentSetUp } from '../testing/ascent';
import { fakeLogExport } from '../testing/fakeLogExport';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
beforeEach(() => announce.mockClear());

async function show(logExport?: LogExport, saved = startAscent(3)) {
  const setUp = ascentSetUp({ saved });
  await renderScreen(
    <TowerFootScreen session={setUp.session} onEnter={jest.fn()} logExport={logExport} />,
    setUp.dependencies,
  );
  return setUp;
}

/** La ligne de compte, lue dans l'indice du bouton : cachée au lecteur d'écran. */
const countLine = (text: string) => screen.findByText(text, { includeHiddenElements: true });

const button = () =>
  screen.getByRole('button', { name: /Exporter le journal|Préparation du journal/u });

describe('TowerFootScreen with the log export', () => {
  it('shows the button at the bottom, with the count of the ascents, the one in progress included (P1)', async () => {
    const { logExport } = fakeLogExport({ count: 7, inProgress: true });
    await show(logExport);
    expect(await countLine('7 ascensions, dont celle en cours')).toBeOnTheScreen();
    expect(button().props.accessibilityHint).toBe(
      "7 ascensions, dont celle en cours. Ouvre le menu de partage d'Android.",
    );
    expect(screen.getByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
  });

  it('says « 20 dernières ascensions » without an ascent in progress (P2)', async () => {
    const { logExport } = fakeLogExport({ count: 20, inProgress: false });
    await show(logExport, undefined);
    expect(await countLine('20 dernières ascensions')).toBeOnTheScreen();
  });

  it.each([
    [{ count: 1, inProgress: false }, '1 ascension'],
    [{ count: 1, inProgress: true }, '1 ascension, celle en cours'],
    [{ count: 4, inProgress: false }, '4 ascensions'],
    [{ count: 20, inProgress: true }, '20 dernières ascensions, dont celle en cours'],
  ])('counts the ascents of %o as « %s »', async (status, line) => {
    const { logExport } = fakeLogExport(status);
    await show(logExport);
    expect(await countLine(line)).toBeOnTheScreen();
  });

  it('greys the button out when the log is empty, and says why (P3)', async () => {
    const { logExport } = fakeLogExport({ count: 0, inProgress: false });
    await show(logExport, undefined);
    expect(await countLine("Aucune ascension dans le journal pour l'instant.")).toBeOnTheScreen();
    expect(button()).toBeDisabled();
    expect(button().props.accessibilityHint).toBe(
      "Aucune ascension dans le journal pour l'instant.",
    );
    await fireEvent.press(button());
    expect(logExport.exports).not.toHaveBeenCalled();
  });

  it('opens the share menu, then comes back unchanged, without a success message', async () => {
    const { logExport } = fakeLogExport();
    await show(logExport);
    await countLine('7 ascensions');
    await fireEvent.press(button());
    expect(logExport.exports).toHaveBeenCalledTimes(1);
    expect(await countLine('7 ascensions')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('shows « Préparation du journal » only beyond 300 ms, inactive meanwhile (E3)', async () => {
    jest.useFakeTimers();
    try {
      const { logExport, willExport } = fakeLogExport();
      let finish: () => void = () => undefined;
      willExport(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ result: 'shared', ignoredLogs: 0 });
          }),
      );
      await show(logExport);
      await countLine('7 ascensions');
      await fireEvent.press(button());
      await act(() => jest.advanceTimersByTime(299));
      expect(screen.queryByText('Préparation du journal')).not.toBeOnTheScreen();
      await fireEvent.press(button());
      expect(logExport.exports).toHaveBeenCalledTimes(1);
      await act(() => jest.advanceTimersByTime(1));
      expect(screen.getByText('Préparation du journal')).toBeOnTheScreen();
      expect(button()).toBeBusy();
      expect(button()).toBeDisabled();
      await act(async () => finish());
      expect(await screen.findByText('Exporter le journal')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the red error line, and a new press retries (E4)', async () => {
    const { logExport, willExport } = fakeLogExport();
    willExport(() => Promise.reject(new Error('No share menu')));
    await show(logExport);
    await countLine('7 ascensions');
    await fireEvent.press(button());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Le journal n'a pas pu être exporté. Réessaie.");
    expect(button()).toBeEnabled();
    willExport(async () => ({ result: 'shared', ignoredLogs: 0 }));
    await fireEvent.press(button());
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('clears the red error line when leaving the tower foot, and reads the status again on return', async () => {
    const { logExport, willExport, setStatus } = fakeLogExport();
    willExport(() => Promise.reject(new Error('No share menu')));
    const setUp = ascentSetUp({ saved: startAscent(3) });
    const element = (focused: boolean) => (
      <TowerFootScreen
        session={setUp.session}
        onEnter={jest.fn()}
        logExport={logExport}
        focused={focused}
      />
    );
    await renderScreen(element(true), setUp.dependencies);
    await countLine('7 ascensions');
    await fireEvent.press(button());
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    await screen.rerender(element(false));
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    setStatus({ count: 8, inProgress: false });
    await screen.rerender(element(true));
    expect(await countLine('8 ascensions')).toBeOnTheScreen();
  });

  it('shows the gold line for the unreadable logs left out, announced politely (P4)', async () => {
    const { logExport, willExport } = fakeLogExport();
    willExport(async () => ({ result: 'shared', ignoredLogs: 1 }));
    await show(logExport);
    await countLine('7 ascensions');
    await fireEvent.press(button());
    expect(await screen.findByText('1 ascension illisible laissée de côté.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('1 ascension illisible laissée de côté.');
    willExport(async () => ({ result: 'shared', ignoredLogs: 2 }));
    await fireEvent.press(button());
    expect(await screen.findByText('2 ascensions illisibles laissées de côté.')).toBeOnTheScreen();
  });

  it('keeps the button usable when the status cannot be read, and survives leaving mid-export', async () => {
    const { logExport, willExport } = fakeLogExport();
    logExport.status = () => Promise.reject(new Error('The store failed'));
    let finish: () => void = () => undefined;
    willExport(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ result: 'shared', ignoredLogs: 1 });
        }),
    );
    await show(logExport);
    await screen.findByRole('button', { name: "Reprendre l'ascension" });
    expect(button()).toBeEnabled();
    await fireEvent.press(button());
    await screen.unmount();
    await act(async () => finish());
    expect(announce).not.toHaveBeenCalled();
  });

  it('shows no button without the log export (production build)', async () => {
    await show(undefined);
    await screen.findByRole('button', { name: "Reprendre l'ascension" });
    expect(screen.queryByText('Exporter le journal')).not.toBeOnTheScreen();
  });
});
