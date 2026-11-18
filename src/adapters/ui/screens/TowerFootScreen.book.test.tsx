// Le pied de la tour et le carnet de découvertes (#282, maquette 278, T1 à T3) : « Le carnet » sur
// la ligne de « Le camp », sous « Commencer l'ascension » ou « Reprendre l'ascension », avec le
// compteur d'or des entrées nouvelles ; sans `book` ni `onBook`, rien ne change.
import { fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DISCOVERY_BOOK_KEY } from '../../../application/useCases/DiscoveryBookSession';
import { startAscent } from '../../../domain/ascent/Ascent';
import {
  EMPTY_DISCOVERY_BOOK,
  serializeDiscoveryBook,
} from '../../../domain/discoveryBook/DiscoveryBook';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { TowerFootScreen } from './TowerFootScreen';

const MARKED = serializeDiscoveryBook({
  ...EMPTY_DISCOVERY_BOOK,
  enemies: {
    burningHusk: { state: 'defeated', isNew: true },
    mothkin: { state: 'encountered', isNew: true },
    ghoul: { state: 'defeated' },
  },
});

async function show({
  stored,
  saved,
  withBook = true,
}: { stored?: string; saved?: ReturnType<typeof startAscent>; withBook?: boolean } = {}) {
  const setUp = ascentSetUp({ shards: 22, ...(saved !== undefined && { saved }) });
  if (stored !== undefined) setUp.keyValueStore.values.set(DISCOVERY_BOOK_KEY, stored);
  const onBook = jest.fn();
  await renderScreen(
    <TowerFootScreen
      session={setUp.session}
      camp={setUp.camp}
      onEnter={jest.fn()}
      onCamp={jest.fn()}
      {...(withBook && { book: setUp.discoveryBook, onBook })}
    />,
    setUp.dependencies,
  );
  return { ...setUp, onBook };
}

const buttonLabels = () =>
  screen.getAllByRole('button').map((button) => button.props.accessibilityLabel as string);

describe('TowerFootScreen and the discovery book (#282)', () => {
  it("puts « Le carnet » on the row of « Le camp », under « Commencer l'ascension » (T1)", async () => {
    const { onBook } = await show({ stored: MARKED });

    await screen.findByRole('button', { name: "Commencer l'ascension" });
    const labels = buttonLabels();
    const camp = labels.indexOf('Le camp');
    expect(camp).toBe(labels.indexOf("Commencer l'ascension") + 1);
    expect(labels[camp + 1]).toBe('Le carnet, 2 nouvelles pages');
    const row = screen.getByTestId('tower-foot-camp-book');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row' });
    expect(within(row).getByRole('button', { name: 'Le camp' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Le carnet, 2 nouvelles pages' }));
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('shows the gold counter of the new entries on « Le carnet » (T1)', async () => {
    await show({ stored: MARKED });

    const counter = await screen.findByTestId('tower-foot-book-count');
    expect(counter).toHaveTextContent('2');
    expect(StyleSheet.flatten(counter.props.style)).toMatchObject({ backgroundColor: '#F2D49B' });
  });

  it('shows no counter without a new entry, read « Le carnet, bouton » (T3)', async () => {
    await show();

    const book = await screen.findByRole('button', { name: 'Le carnet' });
    expect(within(book).getByText('Le carnet')).toBeOnTheScreen();
    expect(screen.queryByTestId('tower-foot-book-count')).not.toBeOnTheScreen();
  });

  it("puts « Le carnet » on the row of « Le camp » during a paused ascent, under « Reprendre l'ascension » (T2)", async () => {
    const { onBook } = await show({ stored: MARKED, saved: startAscent(3) });

    await screen.findByRole('button', { name: "Reprendre l'ascension" });
    expect(
      buttonLabels().filter(
        (label) => !label.startsWith('Jauge') && !label.startsWith('Pouvoirs équipés'),
      ),
    ).toEqual([
      "Reprendre l'ascension",
      'Le camp',
      'Le carnet, 2 nouvelles pages',
      "Abandonner l'ascension",
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Le carnet, 2 nouvelles pages' }));
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('keeps « Le camp » alone, as before, without a book', async () => {
    await show({ withBook: false });

    await screen.findByRole('button', { name: "Commencer l'ascension" });
    expect(buttonLabels()).not.toContain('Le carnet');
    expect(screen.queryByTestId('tower-foot-camp-book')).not.toBeOnTheScreen();
  });

  it('follows the counter when the marks are cleared at the exit of the book', async () => {
    const { discoveryBook } = await show({ stored: MARKED });

    await screen.findByRole('button', { name: 'Le carnet, 2 nouvelles pages' });
    await discoveryBook.leave();
    expect(await screen.findByRole('button', { name: 'Le carnet' })).toBeOnTheScreen();
    expect(screen.queryByTestId('tower-foot-book-count')).not.toBeOnTheScreen();
  });
});
