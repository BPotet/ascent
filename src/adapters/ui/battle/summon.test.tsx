// Les composants de l'Invocation (#172, maquette 170, I2, I3, I6) : l'annonce « Elle appelle les
// Phalénides », l'étiquette « Invoquée » sur le cadre, et la case en pointillé de l'aperçu de la
// frise d'action.
import { act, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import type { ActionTrackView, EnemyView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { ActionTrack } from './ActionTrack';
import { EnemyColumn } from './EnemyColumn';
import { sceneGeometry } from './scene/sceneGeometry';
import { SUMMON_BANNER_MS, SummonBanner } from './SummonBanner';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

describe('SummonBanner (#172, I2)', () => {
  it('shows « Elle appelle les Phalénides » over « La Reine des phalènes change de phase »', async () => {
    await render(
      <SummonBanner
        title="Elle appelle les Phalénides"
        line="La Reine des phalènes change de phase"
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId('summon-banner', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('Elle appelle les Phalénides', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('La Reine des phalènes change de phase', hiddenToo)).toBeOnTheScreen();
  });

  it('never blocks a touch, and is unlike the phase banner: dark band, dusty dashed edges', async () => {
    await render(<SummonBanner title="t" line="l" reducedMotion={false} />);

    expect(screen.getByTestId('summon-banner-place', hiddenToo).props.pointerEvents).toBe('none');
    expect(style('summon-banner')).toMatchObject({
      backgroundColor: battleColors.summonBand,
      borderStyle: 'dashed',
      borderColor: battleColors.summonDust,
    });
    expect(StyleSheet.flatten(screen.getByText('t', hiddenToo).props.style).color).toBe(
      battleColors.summonText,
    );
  });

  it('fades out after 1 600 ms', async () => {
    jest.useFakeTimers();
    await render(<SummonBanner title="t" line="l" reducedMotion={false} />);
    const place = screen.getByTestId('summon-banner-place', hiddenToo);

    expect(SUMMON_BANNER_MS).toBe(1_600);
    expect(getAnimatedStyle(place).opacity).toBe(1);
    await act(async () => jest.advanceTimersByTime(SUMMON_BANNER_MS + 300));
    expect(getAnimatedStyle(place).opacity).toBe(0);
    jest.useRealTimers();
  });

  it('appears without zoom with reduced motion', async () => {
    await render(<SummonBanner title="t" line="l" reducedMotion />);

    expect(screen.getByTestId('summon-banner-still', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryByTestId('summon-banner', hiddenToo)).toBeNull();
  });
});

describe('the tag « Invoquée » on the frame (#172, I3)', () => {
  const mothkin: EnemyView = {
    kind: 'mothkin',
    name: 'Phalénide',
    standing: true,
    target: false,
    hpRatio: 1,
    hpText: '33/33 PV',
    guardRatio: 1,
    guardText: 'Garde 7/7',
    stunned: false,
    losingAction: false,
    rising: null,
    intent: { category: 'attack' },
    active: false,
    dimmed: false,
    tag: 'Invoquée',
    summoned: true,
    label: 'Phalénide, invoquée, 33 PV sur 33, garde 7 sur 7, intention : attaque',
  };

  it('shows « Invoquée » in smoke grey on a dark chip, under the name', async () => {
    await render(
      <EnemyColumn
        view={mothkin}
        index={1}
        slot={sceneGeometry(412, 440, 3, { summoner: true }).enemies[1]!}
        sealed={false}
        float={null}
        uiNow={() => 0}
        now={() => 0}
        onTarget={jest.fn()}
      />,
    );

    const tag = screen.getByText('Invoquée');
    expect(StyleSheet.flatten(tag.props.style)).toMatchObject({
      color: battleColors.summonTag,
      backgroundColor: battleColors.summonTagBackground,
    });
    expect(screen.getByLabelText(mothkin.label)).toBeOnTheScreen();
  });
});

describe('the pending Mothkin in the preview of the action track (#172, I2)', () => {
  const track: ActionTrackView = {
    round: 5,
    current: [{ actor: 'hero', fighter: 'sentinel', phase2: false }],
    next: [
      { actor: 0, fighter: 'mothQueen', phase2: true },
      { actor: 1, fighter: 'mothkin', phase2: false, pending: true },
      { actor: 2, fighter: 'mothkin', phase2: false, pending: true },
      { actor: 'hero', fighter: 'sentinel', phase2: false },
    ],
  };

  it('circles each announced Mothkin in grey dashes, with the portrait of the Mothkin', async () => {
    await render(<ActionTrack track={track} />);

    const pending = screen.getAllByTestId('track-entry-pending', hiddenToo);
    expect(pending).toHaveLength(2);
    for (const entry of pending) {
      expect(StyleSheet.flatten(entry.props.style)).toMatchObject({
        borderStyle: 'dashed',
        borderColor: battleColors.summonDust,
      });
      expect(within(entry).getByTestId('track-portrait', hiddenToo)).toBeOnTheScreen();
    }
    expect(screen.getAllByTestId('track-entry', hiddenToo)).toHaveLength(3);
  });
});
