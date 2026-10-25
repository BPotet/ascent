import { type ReactNode, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { CheckInStatus } from '../../../domain/checkIn/CheckInStatus';
import { BURST_FRAMES, burstSprite, type BurstFrame } from '../pixelArt/sprites/burstSprite';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useArtFrames } from '../pixelArt/useArtFrames';
import { useReducedMotion } from '../state/useReducedMotion';

/** Les images où la coche est relevée d'un pixel d'art, au début de l'étincelle (rebond). */
const LIFTED_FRAMES = 2;

/**
 * L'étincelle (`Burst`) d'une case qui passe à « fait » : 3 images autour de la case, à 12 images
 * par seconde, puis plus rien. Pendant ses 2 premières images, la case (`children`) dessine sa
 * coche un pixel d'art plus haut. `style` place l'étincelle (64 dp) sur la case. Décorative.
 */
export function Burst({
  children,
  style,
}: {
  readonly children: (lifted: boolean) => ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const frame = useArtFrames(BURST_FRAMES + 1);
  return (
    <>
      {children(frame < LIFTED_FRAMES)}
      {frame < BURST_FRAMES && (
        <SpriteCanvas
          sprite={`burst-${frame}`}
          draw={() => toPixelImage(burstSprite(frame as BurstFrame))}
          scale={2}
          testID="habit-burst"
          style={[{ position: 'absolute' }, style]}
        />
      )}
    </>
  );
}

/**
 * Le nombre d'étincelles à jouer sur une case dont l'état est `status` : il augmente chaque fois
 * que la case passe à « fait » (la clé de `Burst`, qui rejoue l'étincelle), jamais quand elle
 * apparaît, ni au retour en arrière, ni en mouvement réduit.
 */
export function useBurst(status: CheckInStatus): number {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState({ status, bursts: 0 });
  if (shown.status !== status) {
    const plays = status === 'done' && !reducedMotion;
    setShown({ status, bursts: shown.bursts + (plays ? 1 : 0) });
  }
  return shown.bursts;
}
