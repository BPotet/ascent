import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { FateGaugeReading } from '../../../application/useCases/fateGauge';
import { GaugeDetailSheet } from './GaugeDetailSheet';

const reading = (overrides: Partial<FateGaugeReading> = {}): FateGaugeReading => ({
  gauge: 1,
  blessings: ['rare', 'rare', 'common'],
  done: 3,
  expected: 4,
  habits: [
    { name: 'Courir 20 minutes', done: true, atClosingOnly: false },
    { name: 'Lire 10 pages', done: true, atClosingOnly: false },
    { name: "Boire 1,5 L d'eau", done: true, atClosingOnly: false },
    { name: 'Méditer 5 minutes', done: false, atClosingOnly: false },
  ],
  sealed: false,
  unreadable: false,
  ...overrides,
});

async function open(props: Partial<Parameters<typeof GaugeDetailSheet>[0]> = {}) {
  const onClose = jest.fn();
  await render(
    <GaugeDetailSheet visible gauge={1} reading={reading()} onClose={onClose} {...props} />,
  );
  return { onClose };
}

describe('GaugeDetailSheet (#41)', () => {
  it('opens on its title, focused by the screen reader', async () => {
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    focus.mockClear();

    await open();

    expect(screen.getByRole('header', { name: 'Jauge du jour' })).toBeOnTheScreen();
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('tells the count of yesterday habit by habit, as at the closing, with the share', async () => {
    await open();

    expect(screen.getByText("Hier, compté tel qu'à la clôture")).toBeOnTheScreen();
    const rows = screen.getAllByTestId('gauge-habit');
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Courir 20 minutes, faite',
      'Lire 10 pages, faite',
      "Boire 1,5 L d'eau, faite",
      'Méditer 5 minutes, manquée',
    ]);
    expect(screen.getByText('3 sur 4, soit 75 %.')).toBeOnTheScreen();
  });

  it("tells the five levels, the level of the day marked « Aujourd'hui »", async () => {
    await open();

    const levels = screen.getAllByTestId(/^gauge-level/u);
    expect(levels).toHaveLength(5);
    expect(screen.getByTestId('gauge-level-on')).toHaveTextContent(
      "+1Faveur · 75 % ou plusAujourd'hui",
    );
    expect(screen.getByText('Malédiction forte · moins de 25 %')).toBeOnTheScreen();
  });

  it('tells the effects of the day and the four safeguards', async () => {
    await open();

    expect(screen.getByText("Ce qu'elle change aujourd'hui")).toBeOnTheScreen();
    expect(screen.getByText('Objets Rares plus fréquents')).toBeOnTheScreen();
    expect(screen.getByText("Ce qu'elle ne touche jamais")).toBeOnTheScreen();
    expect(
      screen.getByText("Jamais d'effet sur tes Éclats, tes déblocages, leurs prix ni le camp."),
    ).toBeOnTheScreen();
    expect(screen.getByText("L'ascension se lance toujours, et reste gagnable.")).toBeOnTheScreen();
  });

  it('closes from the top, from the bottom, and with the back gesture', async () => {
    const { onClose } = await open();

    const closes = screen.getAllByRole('button', { name: 'Fermer le détail de la jauge' });
    expect(closes).toHaveLength(2);
    await fireEvent.press(closes[0]!);
    await fireEvent.press(closes[1]!);
    await fireEvent(screen.getByTestId('gauge-detail'), 'requestClose');

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('says a sealed gauge only changes the experience now', async () => {
    await open({ gauge: -1, reading: reading({ gauge: -1, sealed: true }) });

    expect(screen.getByTestId('gauge-sealed')).toHaveTextContent(
      "Scellée pour aujourd'hui. Tu as lancé une ascension aujourd'hui avec cette jauge. Corriger hier ne change plus que ton expérience.",
    );
  });

  it('marks the habit expected at the closing, and says why without blame', async () => {
    await open({
      gauge: 0,
      reading: reading({
        gauge: 0,
        done: 2,
        expected: 3,
        habits: [
          { name: 'Courir', done: false, atClosingOnly: true },
          { name: 'Lire 10 pages', done: true, atClosingOnly: false },
          { name: "Boire 1,5 L d'eau", done: true, atClosingOnly: false },
        ],
      }),
    });

    expect(screen.getByTestId('gauge-closing')).toHaveTextContent(
      "Une correction d'un jour plus ancien a changé le Rappel d'hier, pas la jauge : hier est compté tel qu'à la clôture, quand « Courir » était encore attendue.",
    );
    expect(screen.getAllByTestId('gauge-habit')[0]).toHaveProp(
      'accessibilityLabel',
      'Courir, attendue à la clôture, manquée',
    );
  });

  it('explains the first use, without count', async () => {
    await open({
      gauge: 0,
      reading: reading({ gauge: 0, blessings: [], done: 0, expected: 0, habits: [] }),
    });

    expect(
      screen.getByText(
        "Aucune habitude n'était attendue hier. Dès demain, la jauge comptera tes habitudes d'aujourd'hui : faites-en une, elle penchera du bon côté.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('gauge-habit')).toBeNull();
    expect(screen.getByTestId('gauge-level-on')).toHaveTextContent(/Pas encore$/u);
    expect(
      screen.getByText(
        "Rien aujourd'hui. Chaque habitude faite aujourd'hui te donnera une bénédiction de départ demain.",
      ),
    ).toBeOnTheScreen();
  });

  it('says the habits could not be read', async () => {
    await open({
      gauge: 0,
      reading: reading({
        gauge: 0,
        blessings: [],
        done: 0,
        expected: 0,
        habits: [],
        unreadable: true,
      }),
    });

    expect(
      screen.getByText(
        "Tes habitudes n'ont pas pu être lues. La jauge reste Neutre aujourd'hui, sans effet. L'ascension se lance quand même.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Aucun effet aujourd'hui")).toBeOnTheScreen();
  });

  it('shows the gauge of the ascent in progress, without the count nor the names of yesterday', async () => {
    await open({ gauge: 2, reading: null, blessings: 3 });

    expect(screen.getByRole('header', { name: "Jauge de l'ascension" })).toBeOnTheScreen();
    expect(
      screen.getByText("Lancée avec cette jauge : l'ascension la garde jusqu'à sa fin."),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('gauge-habit')).toBeNull();
    expect(screen.getByText("Ce qu'elle change dans cette ascension")).toBeOnTheScreen();
    const effects = screen.getByTestId('gauge-effects');
    expect(within(effects).getByText('3 bénédictions de départ')).toBeOnTheScreen();
    expect(within(effects).getByText('Objets Rares plus fréquents')).toBeOnTheScreen();
    expect(screen.getByTestId('gauge-level-on')).toHaveTextContent(/Cette ascension$/u);
  });
});
