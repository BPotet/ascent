// Les composants du combat d'essai, rendus seuls (la scène Skia n'en fait pas partie).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { EnemyView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { ActionPad } from './ActionPad';
import { DamageFloat, FeedbackLabel } from './BattleEffects';
import { BattleEndPanel } from './BattleEndPanel';
import { BATTLE_HINTS, BattleHintBubble } from './BattleHintBubble';
import { EnemyColumn } from './EnemyColumn';
import { BleedDrops } from './BleedChip';
import { HeroBar } from './HeroBar';
import { PhaseBanner } from './PhaseBanner';
import { sceneGeometry } from './scene/sceneGeometry';

const SLOT = sceneGeometry(390, 440, 3).enemies[0]!;

const ghoul: EnemyView = {
  kind: 'ghoul',
  name: 'Goule',
  standing: true,
  target: false,
  hpRatio: 0.76,
  hpText: '38/50 PV',
  guardRatio: 1,
  guardText: 'Garde 15/15',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: { category: 'attack' },
  active: false,
  dimmed: false,
  tag: null,
  label: 'Goule, 38 PV sur 50, garde 15 sur 15, intention : attaque',
};

const sentinel = { hp: 56, maxHp: 80, momentum: 2, bulwark: false };

function style(testID: string) {
  return StyleSheet.flatten(
    screen.getByTestId(testID, { includeHiddenElements: true }).props.style,
  );
}

const noop = () => undefined;

function padProps() {
  return {
    targetName: 'Goule',
    uiNow: () => 0,
    now: () => 4_321,
    onDefense: jest.fn(),
    onAttack: jest.fn(),
    onPower: jest.fn(),
    onStrike: jest.fn(),
  } as const;
}

describe('HeroBar', () => {
  it.each([
    [23, battleColors.heroHpLow],
    [24, battleColors.heroHp],
  ])('colours %i HP out of 80 as an alert under 30 %', async (hp, color) => {
    await render(<HeroBar hero={{ ...sentinel, hp }} />);

    expect(style('battle-hero-hp')).toMatchObject({
      backgroundColor: color,
      width: `${100 * (hp / 80)}%`,
    });
    expect(screen.getByText(`PV ${hp}/80`)).toBeOnTheScreen();
  });

  it('shows the momentum as 5 diamonds, the full ones first (C3)', async () => {
    await render(<HeroBar hero={sentinel} />);

    expect(
      screen.getAllByTestId('battle-momentum-full', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(
      screen.getAllByTestId('battle-momentum-empty', { includeHiddenElements: true }),
    ).toHaveLength(3);
    expect(screen.getByText('Élan')).toBeOnTheScreen();
    expect(screen.getByLabelText('La Sentinelle, PV 56 sur 80, Élan 2 sur 5')).toBeOnTheScreen();
  });

  it('tells the screen reader when the Bulwark is up', async () => {
    await render(<HeroBar hero={{ ...sentinel, bulwark: true }} />);

    expect(
      screen.getByLabelText('La Sentinelle, PV 56 sur 80, Élan 2 sur 5, Rempart'),
    ).toBeOnTheScreen();
  });

  it('shows the Bleed chip under the HP while the hero bleeds (prototype #107)', async () => {
    await render(<HeroBar hero={{ ...sentinel, bleed: { damage: 2, rounds: 3 } }} />);

    expect(screen.getByText('Saignement ×3', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByLabelText('La Sentinelle, PV 56 sur 80, Élan 2 sur 5, Saignement ×3'),
    ).toBeOnTheScreen();
  });

  it('shows no Bleed chip when the hero does not bleed', async () => {
    await render(<HeroBar hero={sentinel} />);

    expect(screen.queryByText(/Saignement/, { includeHiddenElements: true })).toBeNull();
  });
});

describe('BleedDrops', () => {
  it('draws the drops on the hero, hidden from the screen reader', async () => {
    await render(<BleedDrops />);

    expect(
      screen.getAllByTestId('battle-bleed-drop', { includeHiddenElements: true }),
    ).toHaveLength(3);
  });
});

describe('EnemyColumn', () => {
  async function renderColumn(props: Partial<Parameters<typeof EnemyColumn>[0]> = {}) {
    const onTarget = jest.fn();
    await render(
      <EnemyColumn
        view={ghoul}
        index={0}
        slot={SLOT}
        sealed={false}
        float={null}
        uiNow={() => 0}
        now={() => 4_321}
        onTarget={onTarget}
        {...props}
      />,
    );
    return { onTarget };
  }

  it('shows the intent as a blade only, the HP, the name and the guard', async () => {
    await renderColumn();

    expect(
      screen.getByTestId('enemy-ghoul-intent-attack', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/\+\d/)).toBeNull();
    expect(screen.getByText('38/50 PV')).toBeOnTheScreen();
    expect(screen.getByText('Goule')).toBeOnTheScreen();
    expect(screen.getByText('Garde 15/15')).toBeOnTheScreen();
    expect(screen.queryByTestId('peril-seal')).toBeNull();
    expect(style('enemy-ghoul').opacity).toBeUndefined();
    expect(style('enemy-ghoul-hp').width).toBe('76%');
    expect(style('enemy-ghoul-guard').width).toBe('100%');
  });

  it('shows the « Relevé » tag under the name of an enemy that revived by itself (#106)', async () => {
    await renderColumn({ view: { ...ghoul, tag: 'Relevée' } });

    expect(screen.getByText('Relevée')).toBeOnTheScreen();
  });

  it('shows the shield and its gain for a Guard intent', async () => {
    await renderColumn({ view: { ...ghoul, intent: { category: 'guard', gain: 3 } } });

    expect(
      screen.getByTestId('enemy-ghoul-intent-guard', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-ghoul-intent')).toHaveTextContent('+3', { exact: true });
  });

  it('shows the barred circle and « Étourdie ×1,5 » of a stunned enemy, the scene drawing its stars', async () => {
    await renderColumn({
      view: {
        ...ghoul,
        stunned: true,
        guardRatio: 0,
        guardText: 'Étourdie ×1,5',
        intent: { category: 'skip', reason: 'stunned' },
      },
    });

    expect(
      screen.getByTestId('enemy-ghoul-intent-skip', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Étourdie ×1,5')).toBeOnTheScreen();
    expect(screen.queryByText(/✦/u)).toBeNull();
  });

  it('stands at its place in the scene, its plate under its sprite', async () => {
    await renderColumn();

    expect(style('enemy-ghoul')).toMatchObject({
      position: 'absolute',
      left: SLOT.column.x,
      top: SLOT.column.y,
      width: SLOT.column.width,
    });
  });

  it('outlines the intent of the active enemy in light, in red once its perilous wind-up starts, its plate at 45 %', async () => {
    await renderColumn({ view: { ...ghoul, active: true } });
    expect(style('enemy-ghoul-intent').borderColor).toBe(battleColors.light);
    expect(style('enemy-ghoul-plate').opacity).toBe(0.45);

    await renderColumn({ view: { ...ghoul, active: true }, sealed: true });
    expect(style('enemy-ghoul-intent').borderColor).toBe(battleColors.seal);
  });

  it('shows no intent once the stunned enemy has lost its action', async () => {
    await renderColumn({ view: { ...ghoul, stunned: true, intent: null } });

    expect(screen.queryByTestId(/enemy-ghoul-intent/, { includeHiddenElements: true })).toBeNull();
  });

  it('hides its name and its figures in the trimmed enemy phase', async () => {
    await renderColumn({ view: { ...ghoul, name: null, hpText: null, guardText: null } });

    expect(screen.queryByText('Goule')).toBeNull();
    expect(screen.queryByText('38/50 PV')).toBeNull();
    expect(screen.queryByText('Garde 15/15')).toBeNull();
    expect(screen.getByLabelText(ghoul.label)).toBeOnTheScreen();
  });

  it('lights the name of the target, and marks it selected', async () => {
    await renderColumn({ view: { ...ghoul, target: true } });

    expect(StyleSheet.flatten(screen.getByText('Goule').props.style).color).toBe(
      battleColors.light,
    );
    expect(screen.getByTestId('enemy-ghoul').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });
  });

  it('fades while another enemy acts, and disappears once fallen', async () => {
    await renderColumn({ view: { ...ghoul, dimmed: true } });
    expect(style('enemy-ghoul').opacity).toBe(0.25);

    await renderColumn({ view: { ...ghoul, standing: false } });
    expect(style('enemy-ghoul').opacity).toBe(0);
    expect(screen.getByTestId('enemy-ghoul').props.accessibilityState.disabled).toBe(true);
  });

  it('carries the big red seal of a perilous attack, pulsing between its two sizes', async () => {
    await renderColumn({ sealed: true });

    expect(screen.getByLabelText('Sceau rouge : coup imparable')).toBeOnTheScreen();
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('peril-seal-small', hidden).props).toMatchObject({
      sprite: 'seal-8',
      scale: 2,
    });
    expect(screen.getByTestId('peril-seal-big', hidden).props).toMatchObject({
      sprite: 'seal-10',
      scale: 2,
    });
  });

  it('flies the damage it takes', async () => {
    await renderColumn({
      float: { float: { at: 0, text: '−15', big: true, kind: 'damage' }, key: 1 },
    });

    expect(screen.getByText('−15')).toBeOnTheScreen();
  });

  it('targets the enemy with the screen reader', async () => {
    const { onTarget } = await renderColumn();

    await fireEvent(screen.getByTestId('enemy-ghoul'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onTarget).toHaveBeenCalledWith(0, 4_321, 4_321);
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

  it('tells to parry at the impact and to dodge a red seal, without a ring (#101)', () => {
    expect(BATTLE_HINTS.defense.text).toBe(
      "Touche Parade au moment de l'impact. Sceau rouge : Esquive.",
    );
    expect(BATTLE_HINTS.defense.text).not.toMatch(/anneau/iu);
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

describe('FeedbackLabel and DamageFloat', () => {
  it('shows « Cassure » in its own tone, under « Frappe parfaite »', async () => {
    await render(
      <FeedbackLabel
        texts={[
          { tone: 'perfect', title: 'Frappe parfaite' },
          { tone: 'break', title: 'Cassure' },
        ]}
      />,
    );

    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Frappe parfaiteCassure');
  });

  it('enlarges the figure of a perfect strike', async () => {
    await render(<DamageFloat float={{ at: 0, text: '−15', big: true, kind: 'damage' }} />);
    const big = StyleSheet.flatten(screen.getByText('−15').props.style).fontSize;

    await render(<DamageFloat float={{ at: 0, text: '−10', big: false, kind: 'damage' }} />);
    const plain = StyleSheet.flatten(screen.getByText('−10').props.style).fontSize;

    expect(big).toBeGreaterThan(plain);
  });
});

describe('BattleEndPanel', () => {
  it('shows the respite after a victory', async () => {
    await render(<BattleEndPanel outcome="victory" respite={8} onReplay={noop} onClose={noop} />);

    expect(screen.getByText('Combat gagné')).toBeOnTheScreen();
    expect(screen.getByText('Répit +8 PV')).toBeOnTheScreen();
  });

  it('shows no respite after a defeat', async () => {
    await render(<BattleEndPanel outcome="defeat" respite={null} onReplay={noop} onClose={noop} />);

    expect(screen.queryByText(/Répit/)).toBeNull();
  });

  it('fills the room left under the scene, and scrolls its panels', async () => {
    await render(<BattleEndPanel outcome="defeat" respite={null} onReplay={noop} onClose={noop} />);

    expect(style('battle-end').flex).toBe(1);
  });
});

describe('ActionPad', () => {
  it('shows nothing at the end of the battle', async () => {
    await render(<ActionPad pad={{ kind: 'none' }} {...padProps()} />);

    expect(screen.queryByTestId('battle-pad')).toBeNull();
  });

  it('shows « Attends » without its bar while a hero action is resolved', async () => {
    await render(
      <ActionPad
        pad={{
          kind: 'hero',
          locked: true,
          lock: null,
          power: { power: 'bulwark', cost: 1, missing: 0 },
        }}
        {...padProps()}
      />,
    );

    expect(screen.getByTestId('battle-lock-tag')).toHaveTextContent('Attends');
  });

  it('shows Pouvoir on the left with the Bulwark and its cost, Attaquer on the right', async () => {
    const props = padProps();
    await render(
      <ActionPad
        pad={{
          kind: 'hero',
          locked: false,
          lock: null,
          power: { power: 'bulwark', cost: 1, missing: 0 },
        }}
        {...props}
      />,
    );

    expect(screen.getByTestId('battle-power-button')).toHaveTextContent('PouvoirRempart · 1 Élan');
    expect(screen.getByLabelText('Pouvoir : Rempart, 1 Élan')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('battle-power-button'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(props.onPower).toHaveBeenCalledWith(4_321, 4_321);
  });

  it('keeps Pouvoir visible but unavailable, telling the momentum it misses (C3)', async () => {
    const props = padProps();
    await render(
      <ActionPad
        pad={{
          kind: 'hero',
          locked: false,
          lock: null,
          power: { power: 'bulwark', cost: 1, missing: 1 },
        }}
        {...props}
      />,
    );

    expect(screen.getByTestId('battle-power-button')).toHaveTextContent('PouvoirIl manque 1 Élan');
    expect(screen.getByTestId('battle-power-button').props.accessibilityState).toEqual({
      disabled: true,
    });
    await fireEvent(screen.getByTestId('battle-power-button'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(props.onPower).not.toHaveBeenCalled();
  });

  it('turns into a single « Frapper », with its bar and its mark, during the strike', async () => {
    const props = padProps();
    await render(
      <ActionPad
        pad={{ kind: 'strike', since: 1_000, impactAt: 1_700, resolved: false }}
        {...props}
      />,
    );

    expect(screen.getByTestId('battle-strike-button')).toHaveTextContent('Frapper');
    expect(screen.queryByTestId('battle-attack-button')).toBeNull();
    expect(
      screen.getByTestId('battle-strike-mark', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('battle-strike-button'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(props.onStrike).toHaveBeenCalledWith(4_321);
  });

  it('presses Parade and Esquive with the screen reader, at the JS instant', async () => {
    const props = padProps();
    await render(
      <ActionPad
        pad={{ kind: 'defense', locked: false, lock: null, offBalance: false }}
        {...props}
      />,
    );

    for (const id of ['battle-parry-button', 'battle-dodge-button']) {
      await fireEvent(screen.getByTestId(id), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
    }

    expect(props.onDefense.mock.calls).toEqual([
      ['parry', 4_321],
      ['dodge', 4_321],
    ]);
  });
});
