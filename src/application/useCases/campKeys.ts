/** La clé du Camp (ADR 0017) : chaque Déblocage et le prix payé. Jamais effacée par l'app. */
export const CAMP_KEY = 'camp.unlocks';
/** La copie d'une valeur illisible du Camp, gardée avant que le Camp reparte vide. */
export const UNREADABLE_CAMP_KEY = 'camp.unlocks.unreadable';
/**
 * Les derniers pouvoirs équipés validés au menu des pouvoirs ou lancés, par héros (#236, #270, ADR
 * 0022 et 0026) : la présélection du menu des pouvoirs et du Choix du héros. Une valeur illisible se
 * lit « aucune mémoire », sans copie à part.
 */
export const EQUIPPED_POWERS_KEY = 'camp.equippedPowers';
/**
 * Les pouvoirs nouveaux (#270, ADR 0026 D3) : débloqués dans l'arbre, pas encore vus dans le menu des
 * pouvoirs. Une commodité : illisible ou en panne, aucun, sans copie à part.
 */
export const NEW_POWERS_KEY = 'camp.newPowers';
/** Le menu des pouvoirs a été ouvert une fois (#270, M12) : son bandeau de première ouverture s'éteint. */
export const POWERS_MENU_SEEN_KEY = 'camp.powersMenu.seen';
/** La carte « Pouvoirs équipés » a été vue une fois (#270, T8) : son « nouveau » s'éteint. */
export const POWERS_CARD_SEEN_KEY = 'camp.powersCard.seen';
