import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { STARTING_EQUIPMENT, type ItemKind } from '../../../domain/ascent/items';
import { artPalette } from '../pixelArt/artPalette';
import { ChestStage } from './ChestStage';
import { CHEST_OPEN_MS, FoundItemPanel } from './FoundItemPanel';
import { CHEST_IMAGE, CHEST_OPEN_IMAGE } from '../pixelArt/sprites/atelier/data/chest';

const hidden = { includeHiddenElements: true } as const;
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const reduceMotion = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);

const AXE_TEXT = 'Hache rouillée · Arme · Commun · Brise-garde ×1,1 · Initiative −1';
const AXE_ANNOUNCEMENT = 'Coffre ouvert. Hache rouillée, Commun, Brise-garde ×1,1, Initiative −1.';

async function show({
  item = 'axe',
  animate = true,
  chest,
}: { item?: ItemKind; animate?: boolean; chest?: boolean } = {}) {
  const onLeave = jest.fn();
  const onEquip = jest.fn();
  await render(
    <FoundItemPanel
      item={item}
      equipment={STARTING_EQUIPMENT}
      animate={animate}
      {...(chest !== undefined && { chest })}
      onLeave={onLeave}
      onEquip={onEquip}
    />,
  );
  // Le réglage du mouvement réduit, lu par une promesse.
  await act(async () => {});
  return { onLeave, onEquip };
}

/** Le temps qui passe, pas de 100 ms par pas : chaque pas de la frise arme le suivant. */
async function advance(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
}

const stage = () => screen.queryByTestId('chest-stage', hidden);
const closed = () => screen.queryByTestId('chest-closed', hidden);
const opened = () => screen.queryByTestId('chest-open', hidden);
const itemImage = () => screen.queryByTestId('item-image', hidden);
const buttons = () => screen.queryAllByRole('button', { name: /^(Laisser|Équiper)$/ });
const shakeOf = () => StyleSheet.flatten(stage()!.props.style).transform?.[0]?.translateX ?? 0;
const glowOf = () =>
  StyleSheet.flatten(screen.getByTestId('chest-glow', hidden).props.style).opacity as number;
const itemOpacity = () =>
  StyleSheet.flatten(screen.getByTestId('found-item-reveal', hidden).props.style).opacity;

describe('FoundItemPanel (#227)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    announce.mockClear();
    reduceMotion.mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays the opening of the Chest in 600 ms', () => {
    expect(CHEST_OPEN_MS).toBe(600);
  });

  it('shows the closed Chest at 0 ms, shaking, the item lines hidden and no buttons', async () => {
    await show();

    expect(screen.getByRole('header', { name: 'Objet trouvé' })).toBeOnTheScreen();
    expect(closed()).toHaveProp('sprite', 'chest-closed');
    expect(closed()).toHaveProp('scale', 4);
    expect(closed()).toHaveProp('pixelWidth', 32);
    expect(closed()).toHaveProp('pixelHeight', 24);
    expect(opened()).toBeNull();
    expect(shakeOf()).not.toBe(0);
    expect(glowOf()).toBe(0);
    expect(itemImage()).toBeNull();
    expect(buttons()).toHaveLength(0);
    // Les lignes de l'objet sont déjà là, invisibles et cachées au lecteur d'écran.
    expect(screen.queryByText(AXE_TEXT)).toBeNull();
    expect(screen.getByText(AXE_TEXT, hidden)).toBeTruthy();
    expect(itemOpacity()).toBe(0);
    expect(announce).not.toHaveBeenCalled();
  });

  it('shakes the closed Chest in 3 steps, then opens it at 300 ms, its golden glow rising in 3 steps', async () => {
    await show();
    const shakes = [shakeOf()];
    await advance(100);
    shakes.push(shakeOf());
    await advance(100);
    shakes.push(shakeOf());
    expect(closed()).toBeOnTheScreen();
    expect(new Set(shakes).size).toBeGreaterThan(1);

    await advance(100);
    expect(closed()).toBeNull();
    expect(opened()).toHaveProp('sprite', 'chest-open');
    expect(opened()).toHaveProp('scale', 4);
    expect(shakeOf()).toBe(0);
    const glows = [glowOf()];
    await advance(100);
    glows.push(glowOf());
    await advance(100);
    glows.push(glowOf());
    expect(glows).toEqual([...glows].sort());
    expect(glows[0]).toBeGreaterThan(0);
    expect(glows[2]).toBe(1);
    expect(itemImage()).toBeNull();
    expect(buttons()).toHaveLength(0);
  });

  it('shows the item, its lines and the two buttons at 600 ms, fading in over 100 ms', async () => {
    const { onEquip } = await show();
    await advance(CHEST_OPEN_MS);

    expect(stage()).toBeNull();
    expect(itemImage()).toHaveProp('sprite', 'item-axe');
    expect(itemImage()).toHaveProp('scale', 3);
    expect(itemOpacity()).toBeGreaterThan(0);
    expect(itemOpacity()).toBeLessThan(1);
    expect(screen.getByText(AXE_TEXT)).toBeOnTheScreen();
    expect(screen.getByText('Tu portes : Épée courte · Initiative 0')).toBeOnTheScreen();
    expect(screen.getByText('Un objet laissé ne revient pas.')).toBeOnTheScreen();
    expect(buttons()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: "Passer l'ouverture du coffre" })).toBeNull();

    await advance(100);
    expect(itemOpacity()).toBe(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Équiper' }));
    expect(onEquip).toHaveBeenCalledTimes(1);
  });

  it('announces « Coffre ouvert », then the item, once the item is shown', async () => {
    await show();
    await advance(CHEST_OPEN_MS - 100);
    expect(announce).not.toHaveBeenCalled();

    await advance(200);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(AXE_ANNOUNCEMENT);
  });

  it('skips the opening on a tap, without equipping nor leaving the item', async () => {
    const { onEquip, onLeave } = await show();
    await advance(200);

    const skip = screen.getByRole('button', { name: "Passer l'ouverture du coffre" });
    expect(screen.getByText('Touche pour passer')).toBeOnTheScreen();
    await fireEvent.press(skip);

    expect(stage()).toBeNull();
    expect(itemImage()).toHaveProp('sprite', 'item-axe');
    expect(itemOpacity()).toBe(1);
    expect(buttons()).toHaveLength(2);
    expect(onEquip).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(AXE_ANNOUNCEMENT);
    expect(screen.queryByText('Touche pour passer')).toBeNull();
  });

  it('shows the item at once without animation, and still announces it (the resume)', async () => {
    const { onLeave } = await show({ animate: false });

    expect(stage()).toBeNull();
    expect(itemImage()).toHaveProp('sprite', 'item-axe');
    expect(itemOpacity()).toBe(1);
    expect(buttons()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: "Passer l'ouverture du coffre" })).toBeNull();
    expect(announce).toHaveBeenCalledWith(AXE_ANNOUNCEMENT);
    await fireEvent.press(screen.getByRole('button', { name: 'Laisser' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows the Chest open from the start with reduced motion, still, then the item fading in', async () => {
    reduceMotion.mockResolvedValue(true);
    await show();

    expect(closed()).toBeNull();
    expect(opened()).toBeOnTheScreen();
    expect(shakeOf()).toBe(0);
    const glow = glowOf();
    await advance(100);
    expect(shakeOf()).toBe(0);
    expect(glowOf()).toBe(glow);
    await advance(200);
    expect(glowOf()).toBe(glow);
    expect(buttons()).toHaveLength(0);

    await advance(300);
    expect(itemImage()).toBeOnTheScreen();
    expect(itemOpacity()).toBeLessThan(1);
    await advance(100);
    expect(itemOpacity()).toBe(1);
    expect(announce).toHaveBeenCalledWith(AXE_ANNOUNCEMENT);
  });

  it('shows the Epic line of the Flamberge once it is out of the Chest', async () => {
    await show({ item: 'flamberge' });
    expect(screen.queryByText('◆◆◆ Épique')).toBeNull();

    await advance(CHEST_OPEN_MS + 100);
    expect(screen.getByText('◆◆◆ Épique')).toHaveStyle({ color: artPalette.roles.rarityEpic });
    expect(announce).toHaveBeenCalledWith(
      'Coffre ouvert. Flamberge, Épique, Attaque +10 %, Frappe parfaite +0,3, Initiative 0.',
    );
  });

  it('shows the item at once without the Chest when asked (for the sealed chest, #226)', async () => {
    await show({ chest: false });

    expect(stage()).toBeNull();
    expect(itemImage()).toBeOnTheScreen();
    expect(buttons()).toHaveLength(2);
    expect(announce).not.toHaveBeenCalledWith(AXE_ANNOUNCEMENT);
  });
});

describe('ChestStage (#227)', () => {
  it('hides the whole scene from the screen reader and from the touches', async () => {
    await render(
      <ChestStage
        name="chest"
        closed={CHEST_IMAGE}
        open={CHEST_OPEN_IMAGE}
        scale={4}
        opened={false}
        shake={0}
        glow={0}
      />,
    );

    const scene = screen.getByTestId('chest-stage', hidden);
    expect(scene).toHaveProp('accessibilityElementsHidden', true);
    expect(scene).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(scene).toHaveProp('pointerEvents', 'none');
    expect(screen.queryByTestId('chest-stage')).toBeNull();
  });

  it('draws the open image under its own name, its glow in gold', async () => {
    await render(
      <ChestStage
        name="sealed"
        closed={CHEST_IMAGE}
        open={CHEST_OPEN_IMAGE}
        scale={4}
        opened
        shake={0}
        glow={0.5}
      />,
    );

    expect(screen.getByTestId('chest-open', hidden)).toHaveProp('sprite', 'sealed-open');
    const glow = StyleSheet.flatten(screen.getByTestId('chest-glow', hidden).props.style);
    expect(glow).toMatchObject({ opacity: 0.5 });
    expect(screen.getByTestId('chest-glow-tint', hidden)).toHaveStyle({
      backgroundColor: artPalette.roles.gold,
    });
  });
});
