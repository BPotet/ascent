import type { Battle } from '../../../../domain/battle/Battle';
import { glintsOf } from '../../../../domain/battle/glints';
import type { SceneTimeline } from '../sceneTypes';

/**
 * L'action de l'ennemi actif pour la scène (`sceneTimeline`), recalculée à chaque instantané : après
 * un arrêt sur image, les impacts arrivent déjà décalés par le domaine. Pendant l'avancée, le type
 * de coup reste caché (C2.8). `null` hors d'une avancée, d'une attaque, d'une Garde ou d'un Relever.
 */
export function sceneTimeline(battle: Battle): SceneTimeline | null {
  const { phase } = battle;
  if (phase.kind !== 'enemy') return null;
  const { step } = phase;
  const hitStop = battle.hitStop ?? { at: 0, until: 0 };
  const quiet = {
    attack: null,
    windUpMs: 0,
    impacts: [],
    feintAt: null,
    glints: [],
    hitStopAt: hitStop.at,
    hitStopUntil: hitStop.until,
  };
  switch (step.kind) {
    case 'stepIn':
      return {
        ...quiet,
        enemy: step.enemy,
        kind: 'stepIn',
        stepInAt: step.since,
        windUpAt: step.until,
        until: step.until,
      };
    case 'support':
      return {
        ...quiet,
        enemy: step.enemy,
        kind: 'support',
        stepInAt: step.since,
        windUpAt: step.since,
        until: step.until,
      };
    case 'attack':
      return {
        enemy: step.enemy,
        kind: 'attack',
        attack: step.attack,
        stepInAt: step.startedAt,
        windUpAt: step.startedAt,
        windUpMs: step.impacts[0]!.at - step.startedAt,
        until: step.resolvedAt,
        impacts: step.impacts.map((impact) => impact.at),
        feintAt: step.feintAt,
        glints: glintsOf(step),
        hitStopAt: hitStop.at,
        hitStopUntil: hitStop.until,
      };
    default:
      return null;
  }
}
