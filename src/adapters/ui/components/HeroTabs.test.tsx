// Les onglets des deux héros (#270, extraits de l'arbre de pouvoirs #235) : le portrait, le nom et,
// au menu des pouvoirs, le compte « n/3 » (en or à compléter) ou le cadenas de l'ascension.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { artPalette } from '../pixelArt/artPalette';
import { HeroTabs } from './HeroTabs';

const { roles } = artPalette;

describe('HeroTabs (#270)', () => {
  it('shows both heroes as tabs, the selected one marked, and selects another on a touch', async () => {
    const onSelect = jest.fn();
    await render(<HeroTabs hero="sentinel" onSelect={onSelect} testIDPrefix="tabs" />);

    expect(screen.getByTestId('tabs-sentinel').props.accessibilityRole).toBe('tab');
    expect(screen.getByTestId('tabs-sentinel').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('tabs-wanderer').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(within(screen.getByTestId('tabs-wanderer')).getByText('Errante')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: /Errante/u }));
    expect(onSelect).toHaveBeenCalledWith('wanderer');
  });

  it('shows no badge without counts', async () => {
    await render(<HeroTabs hero="sentinel" onSelect={jest.fn()} testIDPrefix="tabs" />);

    expect(screen.queryByTestId('tabs-sentinel-badge')).not.toBeOnTheScreen();
    expect(screen.getByTestId('tabs-sentinel').props.accessibilityLabel).toBeUndefined();
  });

  it('shows the count of each hero, in gold when the choice is to complete', async () => {
    await render(
      <HeroTabs
        hero="wanderer"
        onSelect={jest.fn()}
        testIDPrefix="tabs"
        badges={{
          sentinel: { count: 3, toComplete: false },
          wanderer: { count: 2, toComplete: true },
        }}
      />,
    );

    expect(within(screen.getByTestId('tabs-sentinel')).getByText('3/3')).toBeOnTheScreen();
    expect(within(screen.getByTestId('tabs-wanderer')).getByText('2/3')).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId('tabs-wanderer-badge').props.style).backgroundColor,
    ).toBe(roles.gold);
    expect(
      StyleSheet.flatten(screen.getByTestId('tabs-sentinel-badge').props.style).backgroundColor,
    ).not.toBe(roles.gold);
    expect(screen.getByTestId('tabs-wanderer').props.accessibilityLabel).toBe(
      "L'Errante, 2 pouvoirs équipés sur 3, choix à compléter",
    );
  });

  it('shows the padlock of the hero of the ascent', async () => {
    await render(
      <HeroTabs
        hero="sentinel"
        onSelect={jest.fn()}
        testIDPrefix="tabs"
        badges={{ sentinel: 'locked', wanderer: { count: 3, toComplete: false } }}
      />,
    );

    expect(
      within(screen.getByTestId('tabs-sentinel-badge')).getByTestId('tabs-sentinel-lock', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('tabs-sentinel').props.accessibilityLabel).toBe(
      'La Sentinelle, en ascension',
    );
  });
});
