// La ligne du carnet sur les écrans de l'ascension (#282, maquette D1, D2) : sous « Étage franchi »
// (ou « Palier N franchi » après un boss), sur les écrans qui suivent le combat gagné jusqu'au choix
// d'une sortie ; jamais pendant les manches, ni après une défaite.
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { startAscent, type Ascent } from '../../../domain/ascent/Ascent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import { ascentSetUp } from '../testing/ascent';
import { renderScreen } from '../testing/renderScreen';
import { spyBattles, winShownBattle } from '../testing/winShownBattle';
import { AscentScreen } from './AscentScreen';

jest.mock('../battle/BattleCanvas', () => jest.requireActual('../battle/testing/fakeBattleCanvas'));

async function show(saved: Ascent, pages: readonly EnemyKind[] | null = null) {
  const setUp = ascentSetUp({ saved, book: true });
  await setUp.session.load();
  if (pages !== null) jest.spyOn(setUp.session, 'newPages').mockReturnValue(pages);
  const battles = spyBattles(setUp.session);
  await renderScreen(
    <AscentScreen
      session={setUp.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={jest.fn()}
    />,
    setUp.dependencies,
  );
  return { ...setUp, battles };
}

const between = (change: Partial<Ascent> = {}): Ascent => ({
  ...startAscent(42),
  encounter: null,
  exits: [
    { kind: 'combat', groupSize: 3 },
    { kind: 'campfire', groupSize: null },
  ],
  lastGold: 14,
  gold: 14,
  ...change,
});

describe('the line of the book on the screens of the ascent (#282)', () => {
  it('shows the line under « Étage franchi » on the exits (D1)', async () => {
    await show(between(), ['burningHusk']);

    const banner = await screen.findByTestId('ascent-floor-banner');
    expect(within(banner).getByText('Étage franchi · +14 Or')).toBeOnTheScreen();
    expect(within(banner).getByTestId('book-line')).toHaveProp(
      'accessibilityLabel',
      'Carnet : nouvelle page, Embrasé.',
    );
    const [gained, line] = banner.children as unknown as { props: { testID?: string } }[];
    expect(line?.props.testID).toBe('book-line');
    expect(gained).toBeDefined();
  });

  it('gives the number of pages, then the names in the order of their falls (D2)', async () => {
    await show(between(), ['mothkin', 'thornPilgrim', 'thievingMoth', 'emberPod']);

    expect(await screen.findByText(/4 nouvelles pages :/u)).toBeOnTheScreen();
    expect(
      screen.getByText('Phalénide, Pèlerin enronce, Phalène voleuse … et 1 autre'),
    ).toBeOnTheScreen();
  });

  it('shows the line on the found item and on the offer of boons, too', async () => {
    const { session } = await show(
      between({
        boonOffer: ['perfectEcho', 'frostSkin', 'trueEdge'],
      }),
      ['burningHusk'],
    );

    expect(await screen.findByTestId('ascent-boons')).toBeOnTheScreen();
    expect(screen.getByTestId('book-line')).toBeOnTheScreen();
    expect(session.current()?.boonOffer).not.toBeNull();
  });

  it('shows no line without a filled page', async () => {
    await show(between(), []);

    await screen.findByTestId('ascent-exits');
    expect(screen.queryByTestId('book-line')).not.toBeOnTheScreen();
  });

  it('shows the line under « Palier 1 franchi » after a boss', async () => {
    await show(
      {
        ...startAscent(42),
        floor: 6,
        encounter: null,
        lastGold: 40,
        gold: 40,
        shardAwards: [{ id: '42:1:6:boss', amount: 8 }],
        passage: { to: 2, step: 'bossDefeated' },
      },
      ['ossuaryWarden'],
    );

    expect(await screen.findByRole('header', { name: 'Palier 1 franchi' })).toBeOnTheScreen();
    expect(screen.getByTestId('book-line')).toHaveProp(
      'accessibilityLabel',
      'Carnet : nouvelle page, Gardienne des ossuaires.',
    );
  });

  it('never shows anything during the rounds of the battle', async () => {
    await show(startAscent(42), ['ghoul']);

    expect(await screen.findByTestId('ascent-battle')).toBeOnTheScreen();
    expect(screen.queryByTestId('book-line')).not.toBeOnTheScreen();
  });

  it('names the pages filled by the battle won, then forgets them at the choice of an exit', async () => {
    const { battles, clock, session } = await show(startAscent(42));

    expect(screen.queryByTestId('book-line')).not.toBeOnTheScreen();
    await winShownBattle(battles, clock);
    await act(async () => {
      for (let index = 0; index < 20; index += 1) await Promise.resolve();
    });
    const pages = session.newPages();
    expect(pages.length).toBeGreaterThan(0);
    expect(await screen.findByTestId('book-line')).toBeOnTheScreen();
    // Jusqu'aux sorties, puis le choix d'une sortie.
    while (session.current()!.foundItem !== null || session.current()!.boonOffer !== null) {
      await act(async () => {
        if (session.current()!.foundItem !== null) session.leaveItem();
        else session.chooseBoon(0);
      });
      expect(screen.getByTestId('book-line')).toBeOnTheScreen();
    }
    await fireEvent.press(
      screen
        .getAllByRole('button')
        .find((button) => String(button.props.accessibilityLabel).startsWith('Combat'))!,
    );
    expect(session.newPages()).toEqual([]);
    expect(screen.queryByTestId('book-line')).not.toBeOnTheScreen();
  });
});

describe('« Nouveau au carnet » on « Objet trouvé » (#284, D12, O6)', () => {
  const found = (change: Partial<Ascent> = {}) =>
    between({ exits: [], foundItem: 'hasteAmulet', ...change });

  it('shows it under the line of the book of an enemy defeated in the same battle', async () => {
    const setUp = ascentSetUp({ saved: found(), book: true });
    await setUp.session.load();
    jest.spyOn(setUp.session, 'newPages').mockReturnValue(['ashGleaner']);
    jest.spyOn(setUp.session, 'foundItemIsNew').mockReturnValue(true);
    await renderScreen(
      <AscentScreen
        session={setUp.session}
        visibility={{ onChange: () => () => {} }}
        onLeave={jest.fn()}
      />,
      setUp.dependencies,
    );

    const panel = await screen.findByTestId('ascent-item');
    expect(within(panel).getByTestId('book-line')).toBeOnTheScreen();
    expect(within(panel).getByText('Nouveau au carnet')).toBeOnTheScreen();
    const order = within(panel)
      .getAllByTestId(/^(book-line|found-item-new-to-book)$/u, { includeHiddenElements: true })
      .map((node) => node.props.testID as string);
    expect(order).toEqual(['book-line', 'found-item-new-to-book']);
  });

  it('does not show it for an item already discovered, waiting at the resume', async () => {
    const { session } = await show(found());

    expect(await screen.findByTestId('ascent-item')).toBeOnTheScreen();
    expect(session.foundItemIsNew()).toBe(false);
    expect(screen.queryByText('Nouveau au carnet', { includeHiddenElements: true })).toBeNull();
  });
});
