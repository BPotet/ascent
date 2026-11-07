/**
 * Le pouvoir attisé (`KindledPower`, #237) : un pouvoir équipé dont le Serment a été tenu hier ; il
 * coûte 1 Élan de moins (`kindledCost`) pour toute l'ascension. À part du Serment (`oaths.ts`), pour
 * que l'ascension le connaisse sans connaître le Camp.
 */
import type { PowerKind } from '../battle/powers';
import type { HabitId } from '../habit/Habit';

/** Le coût en Élan à partir duquel un pouvoir porte un Serment, et peut donc être attisé. */
export const OATH_MIN_COST = 2;

/** Un pouvoir attisé : le pouvoir et l'habitude de son Serment tenu hier. */
export interface KindledPower {
  readonly power: PowerKind;
  readonly habit: HabitId;
}
