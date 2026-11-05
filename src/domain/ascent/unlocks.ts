/**
 * Les Déblocages (`Unlock`, #195) : les contenus de la tour à débloquer au Camp. Une ascension
 * reçoit les siens à son début et les garde jusqu'à sa fin.
 */
import { UNLOCKABLE_ITEMS, type ItemKind } from './items';

export type Unlock = 'huntingSpear' | 'watchBell' | 'emberHeart' | 'flamberge';

/** Les contenus à débloquer, dans l'ordre du catalogue du Camp. */
export const UNLOCKS: readonly Unlock[] = ['huntingSpear', 'watchBell', 'emberHeart', 'flamberge'];

/** Les objets débloqués parmi les Déblocages. */
export function unlockedItems(unlocks: readonly Unlock[]): readonly ItemKind[] {
  return UNLOCKABLE_ITEMS.filter((item) => (unlocks as readonly string[]).includes(item));
}
