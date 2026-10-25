/**
 * Ce que montre l'intention d'un ennemi (`shownIntent`, #32, règles C2.2 et C5.7) : sa catégorie
 * en icône, avec le gain de Garde et de Soin ; jamais le type de coup ni les dégâts (C2.3).
 * L'interface ne fait que la dessiner.
 */
import type { Battle } from './Battle';

/** La catégorie d'intention (`IntentCategory`) montrée, avec son nombre pour Garde et Soin. */
export type ShownIntent =
  | { readonly category: 'attack' }
  | { readonly category: 'guard'; readonly gain: number }
  | { readonly category: 'heal'; readonly gain: number }
  | { readonly category: 'raise' }
  | { readonly category: 'skip'; readonly reason: 'stunned' | 'raised' };

export type IntentCategory = ShownIntent['category'];

/**
 * L'intention montrée de l'ennemi `enemy`, ou `null` s'il n'en montre aucune : tombé, à terre
 * après son action perdue, ou dont l'action de la manche a été prise par son retour en garde.
 */
export function shownIntent(battle: Battle, enemy: number): ShownIntent | null {
  const state = battle.enemies[enemy]!;
  if (state.hp <= 0) return null;
  if (state.raisedRound === battle.round) return { category: 'skip', reason: 'raised' };
  if (state.stun !== null) {
    return state.stun.actionLost ? null : { category: 'skip', reason: 'stunned' };
  }
  const { intent } = state;
  if (intent === null) return null;
  switch (intent.category) {
    case 'attack':
      return { category: 'attack' };
    case 'guard':
      return { category: 'guard', gain: intent.gain };
    case 'raise':
      return { category: 'raise' };
  }
}
