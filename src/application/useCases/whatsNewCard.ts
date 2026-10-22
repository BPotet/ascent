import { predatesWeeklyTarget } from '../../domain/habit/IntroductionChange';
import type { PreferenceDependencies } from './checkInHint';
import type { UseCaseDependencies } from './UseCaseDependencies';

/** La clé de la Carte de nouveauté de l'épique #22 (difficulté et objectif) dans le stockage clé-valeur. */
export const WHATS_NEW_CARD_DISMISSED_KEY =
  'day-view.whats-new.difficulty-and-weekly-target.dismissed';

/** Les ports dont a besoin la Carte de nouveauté : les données des habitudes et les préférences. */
export type WhatsNewCardDependencies = UseCaseDependencies & PreferenceDependencies;

/**
 * Cas d'usage : faut-il montrer la Carte de nouveauté (`WhatsNewCard`) de la Vue Journée,
 * « Nouveau : règle la difficulté et l'objectif de chaque habitude » ? Vrai tant qu'elle n'a pas été
 * fermée, si au moins une habitude existante existait avant la mise à jour qui introduit l'objectif
 * hebdomadaire (`predatesWeeklyTarget`). Elle se déduit des données : à la première installation,
 * ou une fois les habitudes d'avant la mise à jour toutes supprimées, elle ne s'affiche pas.
 * Une panne de lecture est une exception.
 */
export async function getWhatsNewCard({
  keyValueStore,
  unitOfWork,
}: WhatsNewCardDependencies): Promise<boolean> {
  if ((await keyValueStore.get(WHATS_NEW_CARD_DISMISSED_KEY)) !== null) {
    return false;
  }
  // Les changements de réglages d'une habitude supprimée sont effacés avec elle.
  return unitOfWork.run(async ({ settingsChanges }) =>
    predatesWeeklyTarget(await settingsChanges.listAll()),
  );
}

/**
 * Cas d'usage : fermer pour toujours la Carte de nouveauté, par « Fermer » comme par « Régler » ; elle
 * ne revient pas, même après un redémarrage. Une panne d'écriture est une exception.
 */
export async function dismissWhatsNewCard({
  keyValueStore,
}: PreferenceDependencies): Promise<void> {
  await keyValueStore.set(WHATS_NEW_CARD_DISMISSED_KEY, 'true');
}
