import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { CAMP_KEY, POWER_TREES_SEEN_KEY } from '../../../application/useCases/CampSession';
import { startAscent } from '../../../domain/ascent/Ascent';
import type { Unlock } from '../../../domain/ascent/unlocks';
import { ascentSetUp } from '../testing/ascent';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { CampScreen } from './CampScreen';

reduceMotionInEachTest();

/** Le décor et le feedback de jeu, cachés au lecteur d'écran. */
const HIDDEN = { includeHiddenElements: true };

/** Le camp ouvert depuis le pied de la tour, qui a déjà chargé la session d'ascension. */
async function show(options: Parameters<typeof ascentSetUp>[0] = {}) {
  const setUp = ascentSetUp(options);
  await setUp.session.load();
  const onLeave = jest.fn();
  const onOpenTree = jest.fn();
  await renderScreen(
    <CampScreen camp={setUp.camp} onLeave={onLeave} onOpenTree={onOpenTree} />,
    setUp.dependencies,
  );
  await screen.findByTestId('camp-purse');
  return { ...setUp, onLeave, onOpenTree };
}

const card = (unlock: Unlock) => within(screen.getByTestId(`camp-card-${unlock}`));

/** Avance l'horloge des animations, 100 ms à la fois, chaque image rendue avant la suivante. */
async function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
}

async function confirm(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

describe('CampScreen (#40)', () => {
  it('shows the Flame Keeper and skeletons while loading, with no price nor button (C9)', async () => {
    const setUp = ascentSetUp({ shards: 82 });
    await setUp.session.load();
    let read: (value: string | null) => void = () => undefined;
    setUp.keyValueStore.get = (key) =>
      key === CAMP_KEY ? new Promise((resolve) => (read = resolve)) : Promise.resolve(null);
    await renderScreen(<CampScreen camp={setUp.camp} onLeave={jest.fn()} />, setUp.dependencies);

    expect(screen.getByTestId('camp-flame-keeper', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('camp-fire', HIDDEN)).toBeOnTheScreen();
    expect(screen.getAllByTestId('camp-skeleton', HIDDEN).length).toBeGreaterThan(0);
    expect(screen.getByTestId('camp-scroll')).toHaveProp('accessibilityState', { busy: true });
    expect(screen.queryByText(/Éclats/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Débloquer/ })).not.toBeOnTheScreen();

    await act(async () => read(null));
    expect(await screen.findByLabelText('82 Éclats disponibles')).toBeOnTheScreen();
  });

  it('greets the first visit: 0 Shard, where Shards come from, what each card misses (C3)', async () => {
    await show();

    expect(screen.getByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
    expect(screen.getByLabelText('0 Éclat disponible')).toBeOnTheScreen();
    expect(screen.getByText('Le Gardien de la flamme')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Approche. Rapporte-moi des Éclats de la tour : je les change en ce qu'elle te donnera ensuite.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(/^Les Éclats se gagnent en battant une Élite/)).toBeOnTheScreen();
    expect(screen.getByText('Il manque 20 Éclats')).toBeOnTheScreen();
    expect(screen.getByText('Il manque 40 Éclats')).toBeOnTheScreen();
    expect(screen.getAllByText('Il manque 80 Éclats')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Débloquer/ })).not.toBeOnTheScreen();
  });

  it('shows each card in its own state, sorted by price (C4)', async () => {
    await show({ shards: 82, unlocks: ['huntingSpear'] });

    expect(screen.getByLabelText('62 Éclats disponibles')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('62 Éclats disponibles : 82 gagnés, 20 dépensés'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Déblocages')).toBeOnTheScreen();
    expect(
      screen.getAllByTestId(/^camp-card-/).map((element) => element.props.testID as string),
    ).toEqual([
      'camp-card-huntingSpear',
      'camp-card-watchBell',
      'camp-card-emberHeart',
      'camp-card-flamberge',
    ]);
    expect(card('huntingSpear').getByText('Déjà dans la tour')).toBeOnTheScreen();
    expect(card('huntingSpear').queryByRole('button')).not.toBeOnTheScreen();
    expect(
      card('watchBell').getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
    ).toBeEnabled();
    expect(card('watchBell').getByText('◆◆ Accessoire · Rare')).toBeOnTheScreen();
    expect(card('watchBell').getByText('Contre-attaque ×1,3 · Initiative 0')).toBeOnTheScreen();
    const flamberge = card('flamberge').getByRole('button', {
      name: 'Flamberge, 80 Éclats, il manque 18 Éclats.',
    });
    expect(flamberge).toBeDisabled();
    expect(card('flamberge').getByText('Il manque 18 Éclats')).toBeOnTheScreen();
    expect(card('flamberge').getByText('Seulement sur une Élite.')).toBeOnTheScreen();
    expect(
      card('emberHeart').getByLabelText(/^Cœur de braise, bienfait, Épique\. .* Il manque 18/),
    ).toBeOnTheScreen();
  });

  it('opens the confirmation sheet with the price and what will be left, and cancels (C5)', async () => {
    await show({ shards: 82, unlocks: ['huntingSpear'] });
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
    );

    const sheet = within(screen.getByTestId('camp-sheet'));
    expect(
      sheet.getByRole('header', { name: 'Débloquer la Clochette du guet ?' }),
    ).toBeOnTheScreen();
    expect(sheet.getByText('Il te restera')).toBeOnTheScreen();
    expect(sheet.getByText('22 Éclats')).toBeOnTheScreen();
    expect(
      sheet.getByText('Il rejoint la tour dès ta prochaine ascension, pour toujours.'),
    ).toBeOnTheScreen();
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    focus.mockClear();

    await fireEvent.press(sheet.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('camp-sheet')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('62 Éclats disponibles')).toBeOnTheScreen();
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('unlocks: the balance, the card and the message change together, with sound and vibration (C6)', async () => {
    const { campSound, campHaptics, keyValueStore } = await show({
      shards: 82,
      unlocks: ['huntingSpear'],
    });
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
    );
    await confirm('Débloquer pour 40 Éclats');

    expect(screen.queryByTestId('camp-sheet')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('22 Éclats disponibles')).toBeOnTheScreen();
    expect(card('watchBell').getByText('Déjà dans la tour')).toBeOnTheScreen();
    expect(screen.getByText('La Clochette du guet est dans la tour.')).toBeOnTheScreen();
    expect(screen.getByText("Ce qui brûle ici t'attend là-haut.")).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(
      'Déblocage réussi : Clochette du guet. 22 Éclats disponibles.',
    );
    expect(campSound.played).toEqual(['burnCrackle']);
    expect(campHaptics.successes()).toBe(1);
    expect(card('watchBell').getByTestId('camp-fresh')).toBeOnTheScreen();
    expect(JSON.parse(keyValueStore.values.get(CAMP_KEY)!).unlocks).toHaveLength(2);
  });

  it.each([
    ['with motion', false, -2],
    ['in reduced motion, a quarter as far', true, -0.5],
  ])('flies « −40 » from the balance and sparks the well, %s', async (_, reduced, at400) => {
    if (!reduced) withMotion();
    jest.useFakeTimers();
    try {
      await show({ shards: 82 });
      await fireEvent.press(
        screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
      );
      await confirm('Débloquer pour 40 Éclats');

      expect(
        within(screen.getByTestId('camp-minus', HIDDEN)).getByText('−40', HIDDEN),
      ).toBeOnTheScreen();
      expect(screen.getByTestId('camp-spark', HIDDEN)).toBeOnTheScreen();
      await advance(400);
      const style = StyleSheet.flatten(screen.getByTestId('camp-minus', HIDDEN).props.style);
      expect(style.transform).toEqual([{ translateY: at400 }]);

      await advance(600);
      expect(screen.queryByTestId('camp-minus', HIDDEN)).not.toBeOnTheScreen();
      expect(screen.getByTestId('camp-spark', HIDDEN)).toBeOnTheScreen();
      await advance(3100);
      expect(screen.queryByTestId('camp-spark', HIDDEN)).not.toBeOnTheScreen();
      expect(card('watchBell').getByText('Déjà dans la tour')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides the message after 4 s', async () => {
    jest.useFakeTimers();
    try {
      await show({ shards: 40 });
      await fireEvent.press(
        screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
      );
      await confirm('Débloquer pour 40 Éclats');
      expect(screen.getByTestId('toast')).toBeOnTheScreen();

      await act(async () => {
        jest.advanceTimersByTime(3900);
      });
      expect(screen.getByTestId('toast')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('waits for the next ascent when bought during an ascent (C7)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show({ shards: 80, saved: { ...startAscent(3), floor: 3 } });

    expect(
      screen.getByText(
        "Ascension en cours · Palier 1, étage 3. Ce que tu débloques maintenant n'entre pas dans cette ascension.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Débloquer Flamberge, 80 Éclats' }));
    expect(
      screen.getByText("Dès ta prochaine ascension. L'ascension en cours ne change pas."),
    ).toBeOnTheScreen();
    await confirm('Débloquer pour 80 Éclats');

    expect(card('flamberge').getByText('Dès ta prochaine ascension')).toBeOnTheScreen();
    expect(card('flamberge').queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByText("La Flamberge t'attend à ta prochaine ascension.")).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(
      'Déblocage réussi : Flamberge. Dès ta prochaine ascension. 0 Éclat disponible.',
    );
    expect(
      screen.getByText(
        "Ton ascension n'est pas finie. Ce que tu prends ici t'attendra à la prochaine.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Ce qui brûle ici t'attend là-haut.")).not.toBeOnTheScreen();
  });

  it('never offers to retry when the camp is read-only, and leaves the stored value alone', async () => {
    const setUp = ascentSetUp({ shards: 82 });
    setUp.keyValueStore.values.set(CAMP_KEY, '{oops');
    const set = setUp.keyValueStore.set;
    setUp.keyValueStore.set = (key, value) =>
      key === `${CAMP_KEY}.unreadable` ? Promise.reject(new Error('full')) : set(key, value);
    await setUp.session.load();
    await renderScreen(<CampScreen camp={setUp.camp} onLeave={jest.fn()} />, setUp.dependencies);
    await screen.findByTestId('camp-purse');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
    );
    await confirm('Débloquer pour 40 Éclats');

    const sheet = within(screen.getByTestId('camp-sheet'));
    expect(sheet.getByRole('alert')).toHaveTextContent(
      "Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts.",
    );
    expect(sheet.queryByRole('button', { name: 'Réessayer' })).not.toBeOnTheScreen();
    expect(screen.getByLabelText('82 Éclats disponibles')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByTestId('camp-sheet')).not.toBeOnTheScreen();
    expect(setUp.keyValueStore.values.get(CAMP_KEY)).toBe('{oops');
  });

  it('keeps the sheet open and the Shards intact when the purchase fails, then retries (C8)', async () => {
    const { keyValueStore } = await show({ shards: 82, unlocks: ['huntingSpear'] });
    keyValueStore.failWrites();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Débloquer Clochette du guet, 40 Éclats' }),
    );
    await confirm('Débloquer pour 40 Éclats');

    const sheet = within(screen.getByTestId('camp-sheet'));
    expect(sheet.getByRole('alert')).toHaveTextContent(
      "Le déblocage n'a pas pu être enregistré. Tes Éclats sont intacts.",
    );
    expect(screen.getByLabelText('62 Éclats disponibles')).toBeOnTheScreen();
    expect(card('watchBell').queryByText('Déjà dans la tour')).not.toBeOnTheScreen();

    keyValueStore.failWrites(false);
    await confirm('Réessayer');

    expect(screen.queryByTestId('camp-sheet')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('22 Éclats disponibles')).toBeOnTheScreen();
  });

  it('keeps the cards in green and the Shards when all is unlocked (C10)', async () => {
    await show({
      shards: 260,
      unlocks: ['huntingSpear', 'watchBell', 'emberHeart', 'flamberge'],
    });

    expect(screen.getByLabelText('40 Éclats disponibles')).toBeOnTheScreen();
    expect(screen.getAllByText('Déjà dans la tour')).toHaveLength(4);
    expect(screen.getByText('Tous les déblocages du Gardien sont dans la tour.')).toBeOnTheScreen();
    expect(
      screen.getByText("Tout ce que j'avais brûle déjà dans la tour. Garde tes Éclats."),
    ).toBeOnTheScreen();
  });

  it('goes back to the tower foot with ‹, a 48 dp target, as every button', async () => {
    const { onLeave } = await show({ shards: 82 });
    const back = screen.getByRole('button', { name: 'Retour au pied de la tour' });

    const style = StyleSheet.flatten(back.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(back);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe('CampScreen: the power trees (#235, C1)', () => {
  it('shows a card per hero between the Available shards and the Unlocks, with a « new » tag', async () => {
    await show({ shards: 50, powers: ['retaliation'] });

    expect(screen.getByText('Arbres de pouvoirs')).toBeOnTheScreen();
    expect(screen.getByText('nouveau')).toBeOnTheScreen();
    const sentinel = screen.getByRole('button', {
      name: 'Arbre de pouvoirs de la Sentinelle, 2 pouvoirs sur 5 débloqués',
    });
    expect(within(sentinel).getByText(/sur 5 débloqués/)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: "Arbre de pouvoirs de l'Errante, 1 pouvoir sur 5 débloqué",
      }),
    ).toBeOnTheScreen();
  });

  it('opens the tree of a hero', async () => {
    const { onOpenTree } = await show({ shards: 50 });

    await fireEvent.press(screen.getByRole('button', { name: /Arbre de pouvoirs de l'Errante/ }));

    expect(onOpenTree).toHaveBeenCalledWith('wanderer');
  });

  it('drops the « new » tag once a tree was opened', async () => {
    const setUp = ascentSetUp({ shards: 50 });
    setUp.keyValueStore.values.set(POWER_TREES_SEEN_KEY, '1');
    await setUp.session.load();
    await renderScreen(
      <CampScreen camp={setUp.camp} onLeave={jest.fn()} onOpenTree={jest.fn()} />,
      setUp.dependencies,
    );
    await screen.findByTestId('camp-purse');

    expect(screen.queryByText('nouveau')).not.toBeOnTheScreen();
  });

  it('shares the Shards of the powers and of the Flame Keeper', async () => {
    await show({ shards: 50, powers: ['retaliation'], unlocks: ['huntingSpear'] });

    expect(screen.getByLabelText('0 Éclat disponible')).toBeOnTheScreen();
  });
});
