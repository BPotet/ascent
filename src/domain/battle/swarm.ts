/**
 * La Nuée (`Swarm`, #268, ADR 0029) : chaque impact d'un Rat de crypte fait `damagePerAlly` dégâts
 * en plus par autre Rat de crypte debout, non étourdi, en première ligne (NU1). La réserve n'est pas
 * dans la ligne (NU3) ; un relevé, un invoqué ou un renfort y est, donc compte. Lue au début de la
 * préparation de chaque coup, jamais au tirage (D1). Pur et sans hasard.
 */
import { ENEMIES, type EnemyKind } from './combatants';

/** Ce que la Nuée lit d'un ennemi de la première ligne (sans dépendre du combat). */
export interface Swarming {
  readonly kind: EnemyKind;
  readonly hp: number;
  readonly stun: object | null;
}

/** Les dégâts qu'ajoute la Nuée à chaque impact de l'ennemi `index` : 0 sans Nuée ni allié. */
export function swarmBonus(line: readonly Swarming[], index: number): number {
  const { kind } = line[index]!;
  const { swarm } = ENEMIES[kind];
  if (swarm === undefined) return 0;
  const allies = line.filter(
    (other, position) =>
      position !== index && other.kind === kind && other.hp > 0 && other.stun === null,
  ).length;
  return swarm.damagePerAlly * allies;
}
