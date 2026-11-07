/** La clé du Camp (ADR 0017) : chaque Déblocage et le prix payé. Jamais effacée par l'app. */
export const CAMP_KEY = 'camp.unlocks';
/** La copie d'une valeur illisible du Camp, gardée avant que le Camp reparte vide. */
export const UNREADABLE_CAMP_KEY = 'camp.unlocks.unreadable';
/**
 * Les derniers pouvoirs équipés lancés, par héros (#236, ADR 0022) : la présélection du Choix du
 * héros. Une valeur illisible se lit « aucune mémoire », sans copie à part.
 */
export const EQUIPPED_POWERS_KEY = 'camp.equippedPowers';
