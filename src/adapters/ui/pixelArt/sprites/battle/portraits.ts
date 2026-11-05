import type { EnemyKind, HeroKind } from '../../../../../domain/battle/combatants';
import { PHASE_2_PORTRAITS, PORTRAITS } from '../atelier/data/portraits';
import type { AssetImage } from '../atelier/fullAnimation';
import type { GameIcon } from '../gameIcons';

/** Le combattant d'une case de la Frise d'action : un héros ou un ennemi, par son nom de code. */
export type Fighter = HeroKind | EnemyKind;

/**
 * Le portrait (`Portrait`, #175) du combattant `fighter` dans la Frise d'action : après le
 * changement de phase (`phase2`), son portrait de phase 2 s'il en a un, sinon celui de phase 1.
 * `null` si son icône n'est pas validée dans l'Atelier : la case montre alors l'initiale.
 */
export function trackPortrait(
  fighter: Fighter,
  phase2: boolean,
  portraits: Readonly<Record<Fighter, AssetImage | null>> = PORTRAITS,
): GameIcon | null {
  const second = phase2 ? PHASE_2_PORTRAITS[fighter as EnemyKind] : undefined;
  if (second !== undefined) return { sprite: `portrait:${fighter}:phase2`, image: second };
  const image = portraits[fighter];
  return image === null ? null : { sprite: `portrait:${fighter}`, image };
}
