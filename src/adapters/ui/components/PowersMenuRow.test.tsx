// La ligne d'un pouvoir du menu des pouvoirs (#270, M1 à M10) : toute la ligne coche ou décoche ;
// équipé d'office ou fixé, du texte sans case ; l'attisé, le Serment, « nouveau », le cadre d'or d'un
// pouvoir équipé tout seul et la secousse d'un refus.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { PowersMenuRow } from './PowersMenuRow';

const { roles } = artPalette;

reduceMotionInEachTest();

const row = () => screen.getByTestId('powers-menu-row-flurry');
const style = () => StyleSheet.flatten(row().props.style);

describe('PowersMenuRow (#270)', () => {
  it('shows the icon, the name, the cost and type, the effect, and checks on a touch of the whole row', async () => {
    const onPress = jest.fn();
    await render(<PowersMenuRow power="flurry" mode="check" checked={false} onPress={onPress} />);

    expect(row().props.accessibilityRole).toBe('checkbox');
    expect(row().props.accessibilityState).toMatchObject({ checked: false });
    expect(row().props.accessibilityLabel).toBe('Rafale, 2 Élan, Frappe. Une frappe en 4 coups.');
    expect(
      screen.getByTestId('power-icon-flurry', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Rafale')).toBeOnTheScreen();
    expect(screen.getByText('2 Élan · Frappe')).toBeOnTheScreen();
    expect(screen.getByText('Une frappe en 4 coups.')).toBeOnTheScreen();
    expect(style().minHeight).toBe(64);

    await fireEvent.press(row());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks a checked row in gold, and the base power with « base »', async () => {
    await render(<PowersMenuRow power="shadowStep" mode="check" checked onPress={jest.fn()} />);

    const checked = screen.getByTestId('powers-menu-row-shadowStep');
    expect(checked.props.accessibilityState).toMatchObject({ checked: true });
    expect(StyleSheet.flatten(checked.props.style).borderColor).toBe(roles.gold);
    expect(screen.getByText('base')).toBeOnTheScreen();
  });

  it('says « Équipé » in green, without a box, for a power equipped by default (M4)', async () => {
    await render(<PowersMenuRow power="flurry" mode="office" checked onPress={jest.fn()} />);

    expect(row().props.accessibilityRole).toBeUndefined();
    expect(row().props.accessibilityState).toBeUndefined();
    expect(row().props.accessibilityLabel).toBe(
      "Rafale, 2 Élan, Frappe. Une frappe en 4 coups. Équipé d'office.",
    );
    const tag = screen.getByTestId('powers-menu-row-flurry-tag');
    expect(within(tag).getByText('Équipé')).toBeOnTheScreen();
    expect(StyleSheet.flatten(tag.props.style).backgroundColor).toBe(roles.doneBg);
  });

  it('says « Fixé » with the padlock for an equipped power during an ascent (M10)', async () => {
    const onPress = jest.fn();
    await render(<PowersMenuRow power="flurry" mode="fixed" checked onPress={onPress} />);

    expect(row().props.accessibilityRole).toBeUndefined();
    expect(row().props.accessibilityLabel).toBe(
      "Rafale, 2 Élan, Frappe. Une frappe en 4 coups. Fixé jusqu'à la fin de l'ascension.",
    );
    expect(within(row()).getByText('Fixé')).toBeOnTheScreen();
    expect(
      screen.getByTestId('powers-menu-row-flurry-lock', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows no box and no tag for a power left aside during an ascent', async () => {
    await render(<PowersMenuRow power="flurry" mode="fixed" checked={false} onPress={jest.fn()} />);

    expect(screen.queryByText('Fixé')).not.toBeOnTheScreen();
    expect(row().props.accessibilityLabel).toBe(
      'Rafale, 2 Élan, Frappe. Une frappe en 4 coups. Pas équipé.',
    );
  });

  it('shows a kindled power in ember, with the flame, « Attisé · 2 → 1 Élan » and its Oath (M5)', async () => {
    await render(
      <PowersMenuRow
        power="retaliation"
        mode="check"
        checked
        kindled
        oath={{
          tone: 'kindled',
          text: "Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension.",
        }}
        onPress={jest.fn()}
      />,
    );

    const lit = screen.getByTestId('powers-menu-row-retaliation');
    expect(StyleSheet.flatten(lit.props.style).borderColor).toBe(roles.ember);
    expect(screen.getByTestId('powers-menu-row-retaliation-flame')).toBeOnTheScreen();
    expect(screen.getByText('Attisé · 2 → 1 Élan · Instantané')).toBeOnTheScreen();
    expect(
      screen.getByText("Attisé : « Courir » faite hier. 1 Élan pour toute l'ascension."),
    ).toBeOnTheScreen();
    expect(lit.props.accessibilityLabel).toMatch(/^Représailles, attisé, 1 Élan au lieu de 2/u);
  });

  it('says the Oath of a power left aside in blue (M6)', async () => {
    await render(
      <PowersMenuRow
        power="retaliation"
        mode="check"
        checked={false}
        oath={{ tone: 'oath', text: 'Serment tenu hier : équipé, il sera attisé (1 Élan).' }}
        onPress={jest.fn()}
      />,
    );

    const line = screen.getByText('Serment tenu hier : équipé, il sera attisé (1 Élan).');
    expect(StyleSheet.flatten(line.props.style).color).toBe(roles.blue);
    expect(screen.queryByText(/^Attisé/u)).not.toBeOnTheScreen();
  });

  it('says « nouveau », and frames in gold a power that equipped itself (M8, M9)', async () => {
    await render(
      <PowersMenuRow power="flurry" mode="check" checked isNew fresh onPress={jest.fn()} />,
    );

    expect(screen.getByText('nouveau')).toBeOnTheScreen();
    expect(style().borderColor).toBe(roles.gold);
    expect(row().props.accessibilityLabel).toMatch(/ Nouveau\.$/u);
  });

  describe('in motion', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('turns the icon of a fresh power over in 4 steps of 90 ms', async () => {
      withMotion();
      await render(<PowersMenuRow power="flurry" mode="check" checked fresh onPress={jest.fn()} />);
      await act(async () => undefined);
      const flip = () =>
        StyleSheet.flatten(
          screen.getByTestId('powers-menu-row-flurry-icon', { includeHiddenElements: true }).props
            .style,
        );

      expect(flip().transform).toEqual([{ scaleX: 0.1 }]);
      await act(async () => jest.advanceTimersByTime(90));
      expect(flip().transform).toEqual([{ scaleX: 0.325 }]);
      await act(async () => jest.advanceTimersByTime(270));
      expect(flip().transform).toEqual([{ scaleX: 1 }]);
    });

    it('nudges a refused row twice by 3 dp, in steps of 60 ms (M2)', async () => {
      withMotion();
      await render(
        <PowersMenuRow power="flurry" mode="check" checked={false} shake={1} onPress={jest.fn()} />,
      );
      await act(async () => undefined);

      const moves = [style().transform];
      for (let step = 0; step < 8; step += 1) {
        await act(async () => jest.advanceTimersByTime(60));
        moves.push(style().transform);
      }
      expect(
        moves.map((transform) => (transform as { translateX: number }[])[0]!.translateX),
      ).toEqual([-3, 0, 3, 0, -3, 0, 3, 0, 0]);
    });

    it('does not move a refused row under reduced motion', async () => {
      await render(
        <PowersMenuRow power="flurry" mode="check" checked={false} shake={1} onPress={jest.fn()} />,
      );
      await act(async () => undefined);

      expect(style().transform).toEqual([{ translateX: 0 }]);
    });
  });
});
