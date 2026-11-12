/**
 * Ce que montre l'intention d'un ennemi (`shownIntent`, #32, règles C2.2 et C5.7) : sa catégorie
 * en icône, avec le gain de Garde et de Soin ; jamais le type de coup ni les dégâts (C2.3).
 * L'interface ne fait que la dessiner.
 */
import type { Battle } from './Battle';
import { chargeMark } from './charge';

/** La catégorie d'intention (`IntentCategory`) montrée, avec son nombre pour Garde et Soin. */
export type ShownIntent =
  | { readonly category: 'attack' }
  | { readonly category: 'guard'; readonly gain: number }
  | { readonly category: 'heal'; readonly gain: number }
  | { readonly category: 'raise' }
  | { readonly category: 'exhume' }
  /** La Charge du Bélier de bronze (#266) : ses cornes, 1 cran la manche où elle commence, 2 ensuite. */
  | { readonly category: 'charge'; readonly notches: 1 | 2 }
  | { readonly category: 'skip'; readonly reason: 'stunned' | 'raised' | 'exhumed' };

export type IntentCategory = ShownIntent['category'];

/**
 * L'intention montrée de l'ennemi `enemy`, ou `null` s'il n'en montre aucune : tombé, à terre
 * après son action perdue, ou dont l'action de la manche a été prise par son retour en garde.
 */
export function shownIntent(battle: Battle, enemy: number): ShownIntent | null {
  const state = battle.enemies[enemy]!;
  if (state.hp <= 0) return null;
  if (state.raisedRound === battle.round) {
    // Un Squelette exhumé n'agit pas dans la manche où il entre (#258) ; relevé ensuite, il est relevé.
    const exhumed = state.exhumed === true && state.selfRevives === undefined;
    return { category: 'skip', reason: exhumed ? 'exhumed' : 'raised' };
  }
  if (state.stun !== null) {
    return state.stun.actionLost ? null : { category: 'skip', reason: 'stunned' };
  }
  const { intent } = state;
  if (intent === null) return null;
  switch (intent.category) {
    case 'attack':
      // Le Coup de bélier montre encore la Charge, ses 2 crans allumés (#266, maquette A8).
      return chargeMark(battle, enemy) === 'second'
        ? { category: 'charge', notches: 2 }
        : { category: 'attack' };
    case 'charge':
      return { category: 'charge', notches: 1 };
    case 'guard':
      return { category: 'guard', gain: intent.gain };
    case 'raise':
      return { category: 'raise' };
    case 'exhume':
      return { category: 'exhume' };
  }
}
