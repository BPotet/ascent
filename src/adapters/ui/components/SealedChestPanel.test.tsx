import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { SEALED_CHEST_OPEN_MS, SealedChestPanel } from './SealedChestPanel';

const hidden = { includeHiddenElements: true } as const;
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
const reduceMotion = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

async function show({ keys = 2, opening = false } = {}) {
  const onOpen = jest.fn();
  const onLeave = jest.fn();
  const onOpened = jest.fn();
  await render(
    <SealedChestPanel
      keys={keys}
      opening={opening}
      onOpen={onOpen}
      onLeave={onLeave}
      onOpened={onOpened}
    />,
  );
  // Le réglage du mouvement réduit, lu par une promesse.
  await act(async () => {});
  return { onOpen, onLeave, onOpened };
}

/** Le temps qui passe, pas de 100 ms par pas : chaque pas de la frise arme le suivant. */
async function advance(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
}

const stage = () => screen.getByTestId('chest-stage', hidden);
const shakeOf = () => StyleSheet.flatten(stage().props.style).transform?.[0]?.translateX ?? 0;
const glowOf = () =>
  StyleSheet.flatten(screen.getByTestId('chest-glow', hidden).props.style).opacity as number;
const flyingKey = () => screen.queryByTestId('sealed-chest-key', hidden);

describe('SealedChestPanel (#226)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    announce.mockClear();
    focus.mockClear();
    reduceMotion.mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('with a key (S2)', () => {
    it('shows the closed sealed chest after the Elite, its content and its loss, focus on the title', async () => {
      await show();

      const title = screen.getByRole('header', { name: 'Coffre scellé' });
      expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
      expect(title).toBeOnTheScreen();
      expect(screen.getByText("Après l'Élite")).toBeOnTheScreen();
      expect(screen.getByTestId('chest-closed', hidden)).toBeOnTheScreen();
      expect(
        screen.getByText("Il s'ouvre avec une clé. Dedans : un objet Rare, parfois Épique."),
      ).toBeOnTheScreen();
      expect(screen.getByText('Laissé fermé, il ne revient pas.')).toBeOnTheScreen();
    });

    it('offers « Laisser » on the left and « Ouvrir · 1 clé » on the right, with the keys left', async () => {
      await show({ keys: 2 });

      const buttons = screen.getAllByRole('button');
      expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
        'Laisser',
        "Ouvrir avec une clé, il t'en reste 2",
      ]);
      const open = buttons[1]!;
      expect(within(open).getByText('Ouvrir · 1 clé')).toBeOnTheScreen();
      expect(within(open).getByTestId('sealed-chest-keys', hidden)).toHaveTextContent('2');
    });

    it('opens on « Ouvrir », and leaves at once on « Laisser », without confirmation', async () => {
      const { onOpen, onLeave } = await show();

      await fireEvent.press(
        screen.getByRole('button', { name: "Ouvrir avec une clé, il t'en reste 2" }),
      );
      expect(onOpen).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/sûr/u)).toBeNull();
    });
  });

  describe('the opening (S3)', () => {
    it('plays the opening in 800 ms', () => {
      expect(SEALED_CHEST_OPEN_MS).toBe(800);
    });

    it('announces the opening with the keys left, and hides the buttons', async () => {
      await show({ keys: 1, opening: true });

      expect(announce).toHaveBeenCalledWith('Coffre scellé ouvert. Il te reste 1 clé.');
      expect(screen.getByText("Le coffre s'ouvre…")).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Laisser' })).toBeNull();
    });

    it('drops the key into the seal, shakes the chest, opens it at 500 ms, the glow rising, then ends', async () => {
      const { onOpened } = await show({ keys: 1, opening: true });

      expect(flyingKey()).toBeOnTheScreen();
      expect(screen.getByTestId('chest-closed', hidden)).toBeOnTheScreen();
      await advance(200);
      expect(flyingKey()).toBeNull();
      const shakes = [shakeOf()];
      await advance(100);
      shakes.push(shakeOf());
      await advance(100);
      shakes.push(shakeOf());
      expect(shakes.map(Math.sign)).toEqual([-1, 1, -1]);
      await advance(100);
      expect(screen.getByTestId('chest-open', hidden)).toBeOnTheScreen();
      expect(shakeOf()).toBe(0);
      const glows = [glowOf()];
      await advance(100);
      glows.push(glowOf());
      await advance(100);
      glows.push(glowOf());
      expect(glows[0]).toBeLessThan(glows[1]!);
      expect(glows[2]).toBe(1);
      expect(onOpened).not.toHaveBeenCalled();
      await advance(100);
      expect(onOpened).toHaveBeenCalledTimes(1);
    });

    it('skips to the end on a tap anywhere', async () => {
      const { onOpened } = await show({ keys: 0, opening: true });

      expect(announce).toHaveBeenCalledWith("Coffre scellé ouvert. Tu n'as plus de clé.");
      await fireEvent.press(screen.getByRole('button', { name: "Passer l'ouverture du coffre" }));
      expect(onOpened).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Touche pour passer')).toBeOnTheScreen();
    });

    it('neither shakes nor flies the key with reduced motion, same durations', async () => {
      reduceMotion.mockResolvedValue(true);
      const { onOpened } = await show({ keys: 1, opening: true });

      expect(flyingKey()).toBeNull();
      await advance(300);
      expect(shakeOf()).toBe(0);
      expect(screen.getByTestId('chest-closed', hidden)).toBeOnTheScreen();
      await advance(200);
      expect(screen.getByTestId('chest-open', hidden)).toBeOnTheScreen();
      await advance(300);
      expect(onOpened).toHaveBeenCalledTimes(1);
    });
  });

  describe('without key (S7)', () => {
    it('keeps the chest closed, « Aucune clé » unavailable and read, and « Continuer »', async () => {
      const { onOpen, onLeave } = await show({ keys: 0 });

      expect(screen.getByText("Il s'ouvre avec une clé.")).toBeOnTheScreen();
      const none = screen.getByRole('button', {
        name: 'Aucune clé : il faut une clé pour ouvrir ce coffre',
      });
      expect(none).toBeDisabled();
      expect(within(none).getByText('Aucune clé')).toBeOnTheScreen();
      expect(within(none).getByTestId('pixel-button-icon', hidden)).toBeOnTheScreen();
      await fireEvent.press(none);
      expect(onOpen).not.toHaveBeenCalled();
      expect(screen.getByText("Pas de clé : rien n'est perdu.")).toBeOnTheScreen();
      expect(screen.queryByText('Laissé fermé, il ne revient pas.')).toBeNull();

      await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
      expect(onLeave).toHaveBeenCalledTimes(1);
    });
  });
});
