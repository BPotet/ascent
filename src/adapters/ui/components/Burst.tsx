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
 * L'étincelle d'une case dont l'état est `status`, partie du tap (`tap`) qui la passe à « fait »,
 * avant l'enregistrement, comme dans la Vue Journée depuis #72 : `bursts` augmente à chaque tel tap
 * (c'est la clé de `Burst`, qui rejoue l'étincelle). Rien au tap qui la ramène en arrière, rien en
 * mouvement réduit, et jamais quand l'état change sans tap : un échec d'enregistrement qui remet
 * « fait », ou un rechargement.
 */
export function useBurst(status: CheckInStatus): {
  readonly bursts: number;
  readonly tap: () => void;
} {
  const reducedMotion = useReducedMotion();
  const [bursts, setBursts] = useState(0);
  const tap = () => {
    if (status !== 'done' && !reducedMotion) {
      setBursts((count) => count + 1);
    }
  };
  return { bursts, tap };
}
