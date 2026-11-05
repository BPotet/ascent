// Les composants de la seconde chance (#206, maquette 205, S1 à S4) : la pastille sous les PV,
// prête ou barrée, l'étiquette lue de la barre du héros, sa barre remplie d'or, et le bandeau d'or.
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import type { HeroState } from '../../../domain/battle/Battle';
import {
  SECOND_CHANCE_BANNER_MS,
  SECOND_CHANCE_FREEZE_MS,
  SECOND_CHANCE_MS,
} from '../../../domain/battle/secondChance';
import { artPalette } from '../pixelArt/artPalette';
import { battleColors } from '../theme/battleColors';
import { HeroBar } from './HeroBar';
import { SecondChanceBanner } from './SecondChanceBanner';
import { SecondChanceChip } from './SecondChanceChip';

const { roles } = artPalette;
const hiddenToo = { includeHiddenElements: true } as const;
const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

const sentinel: HeroState = { hp: 4, maxHp: 80, momentum: 2, bulwark: false };

describe('SecondChanceChip (#206, S1, S4)', () => {
  it('shows « Seconde chance » with its glyph in green while it is ready', async () => {
    await render(<SecondChanceChip used={false} />);

    const text = screen.getByText('Seconde chance', hiddenToo);
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: roles.done });
    expect(StyleSheet.flatten(text.props.style).textDecorationLine).toBeUndefined();
    expect(screen.getByTestId('second-chance-glyph', hiddenToo)).toBeOnTheScreen();
    expect(style('battle-second-chance-chip')).toMatchObject({ borderColor: roles.doneLine });
  });

  it('is struck through in grey, without glyph, once used', async () => {
    await render(<SecondChanceChip used />);

    const text = screen.getByText('Seconde chance', hiddenToo);
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({
      color: roles.muted,
      textDecorationLine: 'line-through',
    });
    expect(screen.queryByTestId('second-chance-glyph', hiddenToo)).toBeNull();
  });

  it('is hidden from the screen reader: the hero bar reads it', async () => {
    await render(<SecondChanceChip used={false} />);

    expect(screen.queryByText('Seconde chance')).toBeNull();
  });
});

describe('HeroBar with the second chance (#206)', () => {
  it('reads « seconde chance prête » and shows the chip while it is ready (S1)', async () => {
    await render(<HeroBar hero={{ ...sentinel, secondChance: 'ready' }} />);

    expect(
      screen.getByLabelText('La Sentinelle, PV 4 sur 80, Élan 2 sur 5, seconde chance prête'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('battle-second-chance-chip', hiddenToo)).toBeOnTheScreen();
  });

  it('reads « seconde chance utilisée » once used (S4)', async () => {
    await render(<HeroBar hero={{ ...sentinel, secondChance: 'used' }} />);

    expect(
      screen.getByLabelText('La Sentinelle, PV 4 sur 80, Élan 2 sur 5, seconde chance utilisée'),
    ).toBeOnTheScreen();
  });

  it('shows no chip without a second chance', async () => {
    await render(<HeroBar hero={sentinel} />);

    expect(screen.queryByTestId('battle-second-chance-chip', hiddenToo)).toBeNull();
    expect(screen.queryByTestId('battle-hero-rise', hiddenToo)).toBeNull();
  });

  it('empties the bar for the freeze, then fills it with gold to its HP in 700 ms (S2, S3)', async () => {
    jest.useFakeTimers();
    await render(
      <HeroBar hero={{ ...sentinel, hp: 40, secondChance: 'used' }} rise={{ key: 1 }} />,
    );
    const cover = screen.getByTestId('battle-hero-rise', hiddenToo);
    const gold = screen.getByTestId('battle-hero-rise-gold', hiddenToo);

    expect(StyleSheet.flatten(gold.props.style)).toMatchObject({ backgroundColor: roles.gold });
    expect(getAnimatedStyle(cover).opacity).toBe(1);
    expect(getAnimatedStyle(gold).width).toBe('0%');
    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_FREEZE_MS + 800));
    expect(getAnimatedStyle(gold).width).toBe('50%');
    expect(getAnimatedStyle(cover).opacity).toBe(1);
    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_MS));
    expect(getAnimatedStyle(cover).opacity).toBe(0);
    jest.useRealTimers();
  });
  it('plays the golden bar once: a later HP change of the same rise does not replay it', async () => {
    jest.useFakeTimers();
    const hero: HeroState = { ...sentinel, hp: 40, secondChance: 'used' };
    const view = await render(<HeroBar hero={hero} rise={{ key: 1 }} />);
    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_MS + 100));
    expect(getAnimatedStyle(screen.getByTestId('battle-hero-rise', hiddenToo)).opacity).toBe(0);

    await view.rerender(<HeroBar hero={{ ...hero, hp: 20 }} rise={{ key: 1 }} />);
    await act(async () => jest.advanceTimersByTime(100));

    const cover = screen.queryByTestId('battle-hero-rise', hiddenToo);
    if (cover !== null) expect(getAnimatedStyle(cover).opacity).toBe(0);
    expect(style('battle-hero-hp')).toMatchObject({ backgroundColor: battleColors.heroHpLow });
    jest.useRealTimers();
  });
});

describe('SecondChanceBanner (#206, S3)', () => {
  const lines = ['La Sentinelle se relève avec 40 PV.', 'Le second coup de la Goule est annulé.'];

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** Le bandeau monté, puis le gel passé. */
  async function shown(reducedMotion = false) {
    await render(
      <SecondChanceBanner title="Seconde chance" lines={lines} reducedMotion={reducedMotion} />,
    );
    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_FREEZE_MS));
  }

  it('shows « Seconde chance » in gold over its lines, on a dark band edged with gold', async () => {
    await shown();

    expect(screen.getByTestId('second-chance-banner', hiddenToo)).toBeOnTheScreen();
    const title = screen.getByText('Seconde chance', hiddenToo);
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({ color: roles.gold });
    for (const line of lines) expect(screen.getByText(line, hiddenToo)).toBeOnTheScreen();
    expect(style('second-chance-banner')).toMatchObject({ borderColor: roles.gold });
  });

  it('never blocks a touch and is hidden from the screen reader: the screen says it', async () => {
    await shown();

    expect(screen.getByTestId('second-chance-banner-place', hiddenToo).props.pointerEvents).toBe(
      'none',
    );
    expect(screen.queryByText('Seconde chance')).toBeNull();
  });

  it('mounts its band, and so starts its zoom, only at the end of the 400 ms freeze', async () => {
    await render(<SecondChanceBanner title="Seconde chance" lines={lines} reducedMotion={false} />);

    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_FREEZE_MS - 1));
    expect(screen.queryByTestId('second-chance-banner', hiddenToo)).toBeNull();
    await act(async () => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('second-chance-banner', hiddenToo)).toBeOnTheScreen();
  });

  it('appears after the 400 ms freeze, for 1 600 ms', async () => {
    await render(<SecondChanceBanner title="Seconde chance" lines={lines} reducedMotion={false} />);
    const place = screen.getByTestId('second-chance-banner-place', hiddenToo);

    expect(getAnimatedStyle(place).opacity).toBe(0);
    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_FREEZE_MS + 50));
    expect(getAnimatedStyle(place).opacity).toBe(1);
    await act(async () => jest.advanceTimersByTime(SECOND_CHANCE_BANNER_MS));
    expect(getAnimatedStyle(place).opacity).toBe(0);
  });

  it('fades in without zoom with reduced motion', async () => {
    await shown(true);

    expect(screen.getByTestId('second-chance-banner-still', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryByTestId('second-chance-banner', hiddenToo)).toBeNull();
  });
});
