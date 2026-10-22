// Les composants du combat d'essai, rendus seuls (la scène Skia n'en fait pas partie).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { EnemyState } from '../../../domain/battle/Battle';
import { battleColors } from '../theme/battleColors';
import { ActionPad } from './ActionPad';
import { BATTLE_HINTS, BattleHintBubble } from './BattleHintBubble';
import { EnemyColumn } from './EnemyColumn';
import { HeroBar } from './HeroBar';
import { PhaseBanner } from './PhaseBanner';

const ghoul: EnemyState = {
  kind: 'ghoul',
  hp: 15,
  maxHp: 20,
  intent: { attack: 'double', damage: 3, windUpMs: 1_100, feintFraction: 0.5 },
};

function style(testID: string) {
  return StyleSheet.flatten(
    screen.getByTestId(testID, { includeHiddenElements: true }).props.style,
  );
}

describe('HeroBar', () => {
  it.each([
    [23, battleColors.heroHpLow],
    [24, battleColors.heroHp],
  ])('colours %i HP out of 80 as an alert under 30 %', async (hp, color) => {
    await render(<HeroBar hero={{ hp, maxHp: 80 }} />);

    expect(style('battle-hero-hp')).toMatchObject({
      backgroundColor: color,
      width: `${100 * (hp / 80)}%`,
    });
    expect(screen.getByText(`PV ${hp}/80`)).toBeOnTheScreen();
  });
});

describe('EnemyColumn', () => {
  async function renderColumn(props: Partial<Parameters<typeof EnemyColumn>[0]> = {}) {
    const onAccessibilityTarget = jest.fn();
    await render(
      <EnemyColumn
        enemy={ghoul}
        index={0}
        target={false}
        dimmed={false}
        sealed={false}
        uiNow={() => 0}
        onTarget={jest.fn()}
        onAccessibilityTarget={onAccessibilityTarget}
        {...props}
      />,
    );
    return { onAccessibilityTarget };
  }

  it('shows the intent, the name and the HP of the enemy', async () => {
    await renderColumn();

    expect(screen.getByText('2×3')).toBeOnTheScreen();
    expect(screen.getByText('Goule')).toBeOnTheScreen();
    expect(screen.getByText('15/20')).toBeOnTheScreen();
    expect(screen.queryByTestId('peril-seal')).toBeNull();
    expect(style('enemy-ghoul').opacity).toBeUndefined();
    expect(style('enemy-ghoul-hp').width).toBe('75%');
  });

  it('lights the name of the target, and marks it selected', async () => {
    await renderColumn({ target: true });

    expect(StyleSheet.flatten(screen.getByText('Goule').props.style).color).toBe(
      battleColors.light,
    );
    expect(screen.getByTestId('enemy-ghoul').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });
  });

  it('fades while another enemy attacks, and disappears once down', async () => {
    await renderColumn({ dimmed: true });
    expect(style('enemy-ghoul').opacity).toBe(0.45);

    await renderColumn({ enemy: { ...ghoul, hp: 0 } });
    expect(style('enemy-ghoul').opacity).toBe(0);
    expect(screen.getByTestId('enemy-ghoul').props.accessibilityState.disabled).toBe(true);
  });

  it('carries the red seal of a perilous attack', async () => {
    await renderColumn({ sealed: true });

    expect(screen.getByLabelText('Sceau rouge : coup imparable')).toBeOnTheScreen();
  });

  it('targets the enemy with the screen reader', async () => {
    const { onAccessibilityTarget } = await renderColumn();

    await fireEvent(screen.getByTestId('enemy-ghoul'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onAccessibilityTarget).toHaveBeenCalledTimes(1);
  });
});

describe('BattleHintBubble', () => {
  it.each([
    ['hero', '75%'],
    ['defense', '50%'],
  ] as const)('points its arrow under the %s hint at %s', async (kind, left) => {
    const onClose = jest.fn();
    await render(<BattleHintBubble kind={kind} onClose={onClose} />);

    expect(BATTLE_HINTS[kind].arrow).toBe(left);
    expect(style('battle-hint-arrow').left).toBe(left);
    await fireEvent.press(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PhaseBanner', () => {
  it('slides in, unless the animations are reduced', async () => {
    await render(<PhaseBanner to="hero" reducedMotion={false} />);
    expect(screen.getByTestId('phase-banner')).toHaveTextContent('À toiVise et attaque');

    await render(<PhaseBanner to="enemy" reducedMotion />);
    expect(screen.getByTestId('phase-banner-still')).toHaveTextContent(
      'Phase ennemiePrépare ta parade',
    );
  });
});

describe('ActionPad', () => {
  it('shows nothing at the end of the battle', async () => {
    await render(
      <ActionPad
        pad={{ kind: 'none' }}
        targetName="Goule"
        uiNow={() => 0}
        now={() => 0}
        onDefense={jest.fn()}
        onAttack={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('battle-pad')).toBeNull();
  });

  it('shows « Attends » without its bar while the hero attack is resolved', async () => {
    await render(
      <ActionPad
        pad={{ kind: 'hero', locked: true, lock: null }}
        targetName="Goule"
        uiNow={() => 0}
        now={() => 0}
        onDefense={jest.fn()}
        onAttack={jest.fn()}
      />,
    );

    expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
  });

  it('presses Parade and Esquive with the screen reader, at the JS instant', async () => {
    const onDefense = jest.fn();
    await render(
      <ActionPad
        pad={{ kind: 'defense', locked: false, lock: null, offBalance: false }}
        targetName="Goule"
        uiNow={() => 0}
        now={() => 4_321}
        onDefense={onDefense}
        onAttack={jest.fn()}
      />,
    );

    for (const id of ['battle-parry-button', 'battle-dodge-button']) {
      await fireEvent(screen.getByTestId(id), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
    }

    expect(onDefense.mock.calls).toEqual([
      ['parry', 4_321],
      ['dodge', 4_321],
    ]);
  });
});
