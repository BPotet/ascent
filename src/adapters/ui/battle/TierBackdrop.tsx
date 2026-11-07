/**
 * Le fond de palier (`TierBackdrop`, #176) : le décor de l'écran de combat propre au palier, choisi
 * par le propriétaire dans l'Atelier, et le voile de lisibilité posé dessus. Un canevas Skia
 * statique, sous tout l'écran de combat : aucune valeur partagée, aucun rendu par image ; il ne se
 * redessine qu'au changement de palier, de mesure de la scène ou de taille de fenêtre. Il n'est pas
 * dans la vue qui tremble : toujours fixe, mouvement réduit compris. Décoratif : le lecteur d'écran
 * l'ignore.
 *
 * Le même fond se pose derrière le pied de la tour (`TowerFootBackdrop`, #233), sous son propre
 * voile : même image, même cache, même placement.
 *
 * Sous Jest, Skia reste limité à son test de fumée : les tests d'écran simulent ce module.
 */
import {
  Canvas,
  FilterMode,
  Image,
  LinearGradient,
  MipmapMode,
  Rect,
  type SkImage,
  vec,
} from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions } from 'react-native';

import type { Tier } from '../../../domain/ascent/tiers';
import { artPalette } from '../pixelArt/artPalette';
import { toSkImage } from '../pixelArt/SpriteCanvas';
import { backdropImage } from '../pixelArt/sprites/battle/tierBackdrops';
import { backdropPlacement } from './scene/backdropPlacement';
import { backdropVeil, type SceneArea } from './scene/backdropVeil';
import { towerFootVeil } from './scene/towerFootVeil';

/** Ce que reçoit `TierBackdrop` (et sa simulation sous Jest, `testing/fakeTierBackdrop.tsx`). */
export interface TierBackdropProps {
  /** Le palier de l'ascension. */
  readonly tier: Tier;
  /** Le cadre de la scène dans la fenêtre ; `null` tant qu'il n'est pas mesuré : voile partout. */
  readonly scene: SceneArea | null;
}

/** Ce que reçoit `TowerFootBackdrop` (et sa simulation sous Jest). */
export interface TowerFootBackdropProps {
  /** Le palier du décor : celui de l'ascension en cours, le palier 1 sinon (`towerFootTier`). */
  readonly tier: Tier;
  /** Le bas de l'en-tête du pied de la tour dans la fenêtre, en dp ; `null` tant qu'il n'est pas mesuré. */
  readonly headerBottom: number | null;
}

/** L'image Skia de chaque palier, faite au premier combat de ce palier (environ 15 000 pixels). */
const images = new Map<Tier, SkImage | null>();

/** L'image Skia du fond du palier `tier`, faite une seule fois ; `null` si Skia n'a pas pu la faire. */
export function tierBackdropImage(tier: Tier): SkImage | null {
  if (!images.has(tier)) images.set(tier, toSkImage(backdropImage(tier)));
  return images.get(tier) ?? null;
}

// Stryker disable all: dessin du fond, vérifié par la conformité aux maquettes (barrière 10 bis).
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
/** La nuit du voile, transparente : l'autre bout d'un fondu. */
const VEIL_CLEAR = 'rgba(14,17,32,0)';
const { backdropVeil: VEIL, towerFootVeil: STRONG, towerFootVeilLight: LIGHT } = artPalette.roles;

/**
 * Le canevas commun : le fond du palier `tier` à son placement, sur toute la fenêtre, puis le voile
 * (`children`) par-dessus. Décoratif, ignoré par le lecteur d'écran et par le toucher.
 */
function BackdropCanvas({
  tier,
  testID,
  children,
}: {
  readonly tier: Tier;
  readonly testID: string;
  readonly children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const image = tierBackdropImage(tier);
  const placement = backdropPlacement({ width, height }, PixelRatio.get());
  return (
    <Canvas
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
      style={StyleSheet.absoluteFill}
    >
      {image === null ? null : (
        <Image
          image={image}
          x={placement.x}
          y={placement.y}
          width={placement.width}
          height={placement.height}
          fit="fill"
          sampling={NEAREST}
        />
      )}
      {children}
    </Canvas>
  );
}

/**
 * Le fond de palier et son voile de lisibilité, en `StyleSheet.absoluteFill` derrière l'écran de
 * combat. Sans image, seul le voile est dessiné : la nuit du conteneur reste visible.
 */
export function TierBackdrop({ tier, scene }: TierBackdropProps) {
  const { width, height } = useWindowDimensions();
  const veil = backdropVeil({ height }, scene);
  return (
    <BackdropCanvas tier={tier} testID="tier-backdrop">
      {veil.bands.map((band) => (
        <Rect
          key={`band-${band.y}`}
          x={0}
          y={band.y}
          width={width}
          height={band.height}
          color={VEIL}
        />
      ))}
      {veil.fades.map((fade) => (
        <Rect key={`fade-${fade.opaque}`} x={0} y={fade.y} width={width} height={fade.height}>
          <LinearGradient
            start={vec(0, fade.y)}
            end={vec(0, fade.y + fade.height)}
            colors={fade.opaque === 'top' ? [VEIL, VEIL_CLEAR] : [VEIL_CLEAR, VEIL]}
          />
        </Rect>
      ))}
    </BackdropCanvas>
  );
}

/**
 * Le fond de palier derrière le pied de la tour (#233), en `StyleSheet.absoluteFill` : le voile du
 * pied de la tour (la nuit à 75 % jusqu'au bas de l'en-tête, un fondu de 24 dp, puis 12 %).
 * Immobile, sans valeur animée ; sans image, seul le voile est dessiné.
 */
export function TowerFootBackdrop({ tier, headerBottom }: TowerFootBackdropProps) {
  const { width, height } = useWindowDimensions();
  const { strong, fade, light } = towerFootVeil({ height }, headerBottom);
  return (
    <BackdropCanvas tier={tier} testID="tower-foot-backdrop">
      <Rect x={0} y={strong.y} width={width} height={strong.height} color={STRONG} />
      <Rect x={0} y={fade.y} width={width} height={fade.height}>
        <LinearGradient
          start={vec(0, fade.y)}
          end={vec(0, fade.y + fade.height)}
          colors={[STRONG, LIGHT]}
        />
      </Rect>
      <Rect x={0} y={light.y} width={width} height={light.height} color={LIGHT} />
    </BackdropCanvas>
  );
}
// Stryker restore all
