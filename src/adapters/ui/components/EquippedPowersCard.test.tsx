// La carte « Pouvoirs équipés » du pied de la tour (#270, T1, T4 à T8) : une seule cible, une ligne
// par héros (portrait, mini-cases, « n sur 3 »), le lien « Changer » ou « Voir », la note d'un pouvoir
// en attente, le badge « nouveau », et les cases changées qui se retournent après « Valider » (T5).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { EquippedPowersCard, type EquippedPowersCardRow } from './EquippedPowersCard';

const { roles } = artPalette;

reduceMotionInEachTest();

const ROWS: readonly EquippedPowersCardRow[] = [
  { hero: 'sentinel', powers: ['bulwark', 'retaliation', 'holdFast'], kindled: ['retaliation'] },
  { hero: 'wanderer', powers: ['shadowStep', 'rend', 'mist'], kindled: [] },
];

const card = () => screen.getByTestId('equipped-powers-card');
const cells = (hero: string) =>
  within(screen.getByTestId(`powers-card-row-${hero}`))
    .getAllByTestId(/^powers-card-(cell|free)-/u)
    .map((cell) => cell.props.testID as string);

describe('EquippedPowersCard (#270)', () => {
  it('is one button that shows a row by hero, with its portrait, its icons and « 3 sur 3 » (T1)', async () => {
    const onPress = jest.fn();
    await render(<EquippedPowersCard rows={ROWS} waiting={[]} onPress={onPress} />);

    expect(card().props.accessibilityRole).toBe('button');
    expect(card().props.accessibilityLabel).toBe(
      "Pouvoirs équipés. La Sentinelle : Rempart, Représailles, attisé, Tenir bon. L'Errante : Pas de l'ombre, Entaille, Brume. Changer les pouvoirs",
    );
    expect(screen.getByText('Pouvoirs équipés')).toBeOnTheScreen();
    expect(screen.getByText('Changer')).toBeOnTheScreen();
    expect(
      screen.getByTestId('powers-card-portrait-sentinel', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(cells('sentinel')).toEqual([
      'powers-card-cell-bulwark',
      'powers-card-cell-retaliation',
      'powers-card-cell-holdFast',
    ]);
    expect(
      within(screen.getByTestId('powers-card-row-wanderer')).getByText('3 sur 3'),
    ).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('powers-card-cell-retaliation').props.style)
        .borderColor,
    ).toBe(roles.ember);

    await fireEvent.press(card());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the free slots, hatched', async () => {
    await render(
      <EquippedPowersCard
        rows={[{ hero: 'sentinel', powers: ['bulwark', 'retaliation'], kindled: [] }]}
        waiting={[]}
        onPress={jest.fn()}
      />,
    );

    expect(cells('sentinel')).toEqual([
      'powers-card-cell-bulwark',
      'powers-card-cell-retaliation',
      'powers-card-free-2',
    ]);
    expect(screen.getByText('2 sur 3')).toBeOnTheScreen();
    const free = screen.getByTestId('powers-card-free-2');
    expect(StyleSheet.flatten(free.props.style).borderStyle).not.toBe('dashed');
    expect(
      within(free).getByTestId('powers-card-free-2-hatching', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('says in gold that a power waits for a slot, with « nouveau » (T4)', async () => {
    await render(<EquippedPowersCard rows={ROWS} waiting={['flurry']} onPress={jest.fn()} />);

    const note = screen.getByTestId('powers-card-waiting-flurry');
    expect(within(note).getByText('nouveau')).toBeOnTheScreen();
    expect(within(note).getByText('Rafale attend une place.')).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(within(note).getByText('Rafale attend une place.').props.style).color,
    ).toBe(roles.gold);
    expect(card().props.accessibilityLabel).toMatch(
      / Nouveau : Rafale attend une place\. Changer les pouvoirs$/u,
    );
  });

  it('shows the hero of the ascent alone, locked, with « Voir » (T6)', async () => {
    await render(
      <EquippedPowersCard rows={ROWS.slice(0, 1)} waiting={[]} locked onPress={jest.fn()} />,
    );

    expect(screen.getByText('Voir')).toBeOnTheScreen();
    expect(screen.queryByText('Changer')).not.toBeOnTheScreen();
    expect(
      screen.getByTestId('powers-card-lock', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Fixés jusqu'à la fin de l'ascension.")).toBeOnTheScreen();
    expect(screen.queryByTestId('powers-card-row-wanderer')).not.toBeOnTheScreen();
    expect(card().props.accessibilityLabel).toBe(
      "Pouvoirs équipés. La Sentinelle : Rempart, Représailles, attisé, Tenir bon. Fixés jusqu'à la fin de l'ascension. Voir les pouvoirs",
    );
  });

  it('carries « nouveau » in its title on the first visit (T8)', async () => {
    await render(<EquippedPowersCard rows={ROWS} waiting={[]} isNew onPress={jest.fn()} />);

    expect(within(screen.getByTestId('powers-card-head')).getByText('nouveau')).toBeOnTheScreen();
  });

  describe('after « Valider » (T5)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const flip = (power: string) =>
      StyleSheet.flatten(screen.getByTestId(`powers-card-flip-${power}`).props.style);
    const frame = (power: string) =>
      StyleSheet.flatten(screen.getByTestId(`powers-card-cell-${power}`).props.style).borderColor;

    it('frames the changed cells in gold and turns them over one after the other', async () => {
      withMotion();
      await render(
        <EquippedPowersCard
          rows={ROWS}
          waiting={[]}
          fresh={{ id: 1, powers: ['retaliation', 'mist'] }}
          onPress={jest.fn()}
        />,
      );
      await act(async () => undefined);

      expect(frame('mist')).toBe(roles.gold);
      expect(frame('rend')).not.toBe(roles.gold);
      expect(flip('retaliation').transform).toEqual([{ scaleX: 0.1 }]);
      expect(flip('mist').transform).toEqual([{ scaleX: 0.1 }]);
      // Représailles est la 2e case de sa ligne, Brume la 3e : 90 ms, puis 180 ms de décalage.
      await act(async () => jest.advanceTimersByTime(450));
      expect(flip('retaliation').transform).toEqual([{ scaleX: 1 }]);
      expect(flip('mist').transform).not.toEqual([{ scaleX: 1 }]);
      await act(async () => jest.advanceTimersByTime(90));
      expect(flip('mist').transform).toEqual([{ scaleX: 1 }]);
      expect(frame('mist')).toBe(roles.gold);
    });

    it('fades the changed cells in under reduced motion, with the same timing', async () => {
      await render(
        <EquippedPowersCard
          rows={ROWS}
          waiting={[]}
          fresh={{ id: 1, powers: ['mist'] }}
          onPress={jest.fn()}
        />,
      );
      await act(async () => undefined);

      expect(flip('mist').transform).toBeUndefined();
      expect(flip('mist').opacity).toBe(0);
      await act(async () => jest.advanceTimersByTime(180 + 360));
      expect(flip('mist').opacity).toBe(1);
    });
  });

  it('puts the name of the hero under his portrait with a large text', async () => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale: 2 },
      screen: { ...Dimensions.get('screen'), fontScale: 2 },
    });
    await render(<EquippedPowersCard rows={ROWS} waiting={[]} onPress={jest.fn()} />);

    expect(
      StyleSheet.flatten(screen.getByTestId('powers-card-who-sentinel').props.style).flexDirection,
    ).toBe('column');
  });
});
