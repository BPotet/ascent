import { useCallback, useState } from 'react';

import type { ActionPad } from './battleView';

export interface PowerListState {
  /** La liste des pouvoirs est ouverte. */
  readonly open: boolean;
  /** « Pouvoirs » ouvre la liste, ou la ferme sans rien lancer si elle est ouverte. */
  readonly toggle: () => void;
  /** Ferme la liste sans rien lancer (voile, geste retour, échappement) et rend le focus à « Pouvoirs ». */
  readonly dismiss: () => void;
  /** Vrai après une fermeture sans lancer : le lecteur d'écran revient sur « Pouvoirs ». */
  readonly focusPowers: boolean;
}

/**
 * L'ouverture de la liste des pouvoirs (#271), un état d'interface, ni du combat ni stocké. Elle
 * n'existe qu'en phase du héros, touches déverrouillées, et se ferme d'elle-même dès que ce n'est
 * plus vrai (transition de phase, action, frappe, phase ennemie, fin du combat) ou quand un pouvoir
 * instantané vient d'être lancé. Un toucher que le combat ignore ne change pas la vue : la liste
 * reste ouverte. Ces fermetures-là ne déplacent pas le focus.
 */
export function usePowerList(pad: ActionPad): PowerListState {
  const shown = pad.kind === 'hero' && !pad.locked;
  const instantCast = pad.kind === 'hero' && pad.instantCast === true;
  const [state, setState] = useState<ListState>(CLOSED);
  // État ajusté au rendu, sans effet : https://react.dev/learn/you-might-not-need-an-effect. Tout
  // changement de `shown` ferme la liste : elle ne s'ouvre jamais d'elle-même.
  const [seen, setSeen] = useState({ shown, instantCast });
  if (seen.shown !== shown || seen.instantCast !== instantCast) {
    setSeen({ shown, instantCast });
    if (seen.shown !== shown || instantCast) setState(closedQuietly);
  }
  // Des rappels stables : les gestes qui les appellent ne sont pas recréés.
  const dismiss = useCallback(() => setState(DISMISSED), []);
  const toggle = useCallback(() => setState(({ open }) => (open ? DISMISSED : OPEN)), []);
  return { open: state.open && shown, toggle, dismiss, focusPowers: state.focusPowers };
}

interface ListState {
  readonly open: boolean;
  readonly focusPowers: boolean;
}

const CLOSED: ListState = { open: false, focusPowers: false };
const OPEN: ListState = { open: true, focusPowers: false };
const DISMISSED: ListState = { open: false, focusPowers: true };

/** Une fermeture d'elle-même : le focus ne bouge pas. */
function closedQuietly(state: ListState): ListState {
  return state.open ? CLOSED : state;
}
