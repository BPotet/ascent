/**
 * Aide de test (#244, R1) : les dégâts des coups d'un ennemi tels que la story les écrit
 * (« 6 + 6, 10, 5 ; phase 2 : … »), lus dans les intentions tirées à `damagePercent`.
 */
import { ENEMIES, type EnemyKind, type Move } from '../../battle/combatants';
import { drawIntent, type Intent } from '../../battle/intents';
import { seedRandom } from '../../battle/SeededRandom';

export type AttackIntent = Extract<Intent, { category: 'attack' }>;

/** Les intentions d'attaque tirées de `kind` aux dégâts de `damagePercent`, par coup. */
export function drawnAttacks(
  kind: EnemyKind,
  damagePercent: number,
  phase2 = false,
): ReadonlyMap<string, AttackIntent> {
  const drawn = new Map<string, AttackIntent>();
  for (let seed = 1; seed <= 400; seed += 1) {
    const { intent } = drawIntent(kind, seedRandom(seed), {
      fallenAlly: null,
      stunned: false,
      guardDamaged: false,
      phase2,
      damagePercent,
    });
    if (intent.category === 'attack') drawn.set(intent.attack, intent);
  }
  return drawn;
}

function movesText(
  kind: EnemyKind,
  moves: readonly Move[],
  damagePercent: number,
  phase2: boolean,
): string {
  const drawn = drawnAttacks(kind, damagePercent, phase2);
  return moves
    .map(({ attack }) => {
      const { damage } = drawn.get(attack)!;
      return attack === 'double' ? `${damage} + ${damage}` : `${damage}`;
    })
    .join(', ');
}

/** Les dégâts de chaque coup de `kind` à `damagePercent`, phase 2 comprise. */
export function strikesText(kind: EnemyKind, damagePercent: number): string {
  const { moves, phase2Moves } = ENEMIES[kind];
  const first = movesText(kind, moves, damagePercent, false);
  return phase2Moves
    ? `${first} ; phase 2 : ${movesText(kind, phase2Moves, damagePercent, true)}`
    : first;
}
