/**
 * L'Aura du Porte-cierge (`Aura`, #268, ADR 0029) : tant qu'il est debout en première ligne, étourdi
 * ou non (AU5, décision du propriétaire), chaque coup des autres ennemis fait `damagePercent` % de
 * dégâts en plus, au moins +1, par impact (AU1), une seule fois (AU4). La réserve n'est pas dans la
 * ligne (AU6). Les dégâts d'un coup se calculent dans l'ordre intention → Nuée → Aura, chaque étape à
 * l'entier inférieur (AU3), au début de sa préparation (D1, AU2). Pur et sans hasard.
 */
import { ENEMIES } from './combatants';
import { swarmBonus, type Swarming } from './swarm';
import { boostByPercent } from './tierMultiplier';

/** L'ennemi debout qui donne l'Aura à l'ennemi `index`, ou `null` : jamais lui-même. */
export function auraBearer(line: readonly Swarming[], index: number): number | null {
  const bearer = line.findIndex(
    (other, position) =>
      position !== index && other.hp > 0 && ENEMIES[other.kind].aura !== undefined,
  );
  return bearer < 0 ? null : bearer;
}

/**
 * Un Porte-cierge seul (C5) : debout, sans autre ennemi debout ni réserve, son Aura ne sert à rien.
 */
export function auraAlone(line: readonly Swarming[], reserve: number, index: number): boolean {
  const enemy = line[index]!;
  return (
    ENEMIES[enemy.kind].aura !== undefined &&
    enemy.hp > 0 &&
    reserve === 0 &&
    line.every((other, position) => position === index || other.hp <= 0)
  );
}

/** Les dégâts d'un coup, et les points ajoutés par impact par la Nuée et l'Aura, absents à 0. */
export interface BoostedDamage {
  readonly damage: number;
  readonly swarm?: number;
  readonly aura?: number;
}

/** Les dégâts du coup de l'ennemi `index`, de `damage` à son tirage : + Nuée, puis Aura. */
export function boostedDamage(
  line: readonly Swarming[],
  index: number,
  damage: number,
): BoostedDamage {
  const swarm = swarmBonus(line, index);
  const swarmed = damage + swarm;
  const bearer = auraBearer(line, index);
  const boosted =
    bearer === null
      ? swarmed
      : boostByPercent(swarmed, ENEMIES[line[bearer]!.kind].aura!.damagePercent);
  const aura = boosted - swarmed;
  return { damage: boosted, ...(swarm > 0 && { swarm }), ...(aura > 0 && { aura }) };
}
