/**
 * L'Éclatement de la Cosse de braise (`EmberBurst`, #267, ADR 0028) : quand elle tombe sous un coup
 * du héros, quel qu'il soit (EC6), le héros prend ses charges de Brûlure, 5 au plus, et l'Éclatement
 * se voit même à 5 (EC1) ; étourdie avant le coup, elle est étouffée (EC2) ; si sa chute gagne le
 * combat, rien (EC4). Ni réduction, ni Rempart, ni Brume, ni palier, ni malédiction (EC5). Pur et
 * sans hasard ; la chute est dans `Battle.ts`.
 */
import type { BattleEvent } from './BattleEvent';
import { addBurn } from './burn';
import { ENEMIES, type EnemyKind } from './combatants';

/** Ce que l'Éclatement lit d'un ennemi (sans dépendre du combat). */
interface Pod {
  readonly kind: EnemyKind;
  readonly stun: object | null;
  readonly hp: number;
}

/** La marque « Braises 2 » allumée : une Cosse de braise debout, non étourdie (D5). */
export function emberBurstPrimed(enemy: Pod): boolean {
  return ENEMIES[enemy.kind].emberBurst !== undefined && enemy.hp > 0 && enemy.stun === null;
}

/** La Brûlure du héros après la chute, et ce qu'elle annonce. */
export interface EmberBurstChange {
  readonly burn: number | undefined;
  readonly events: readonly BattleEvent[];
}

/**
 * La chute de l'ennemi `enemy`, lu `before` le coup qui le fait tomber, sur un héros à `heroBurn`
 * charges ; `won`, cette chute gagne le combat.
 */
export function emberBurstOnFall(
  before: Pick<Pod, 'kind' | 'stun'>,
  fall: {
    readonly heroBurn: number | undefined;
    readonly won: boolean;
    readonly at: number;
    readonly enemy: number;
  },
): EmberBurstChange {
  const { heroBurn, won, at, enemy } = fall;
  const burst = ENEMIES[before.kind].emberBurst;
  if (burst === undefined || won) return { burn: heroBurn, events: [] };
  if (before.stun !== null) {
    return { burn: heroBurn, events: [{ type: 'emberBurstSmothered', at, enemy }] };
  }
  const stacks = addBurn(heroBurn ?? 0, burst.stacks);
  return {
    burn: stacks,
    events: [
      {
        type: 'heroBurning',
        at,
        added: stacks - (heroBurn ?? 0),
        stacks,
        cause: 'emberBurst',
        enemy,
      },
    ],
  };
}
