import type { CharacterRepository } from './CharacterRepository';
import type { CheckInRepository } from './CheckInRepository';
import type { HabitRepository } from './HabitRepository';
import type { IntroductionRepository } from './IntroductionRepository';
import type { SettingsChangeRepository } from './SettingsChangeRepository';

/** Les dépôts disponibles dans une unité de travail. Cette liste grandit au fil des stories. */
export interface Repositories {
  readonly habits: HabitRepository;
  readonly checkIns: CheckInRepository;
  readonly character: CharacterRepository;
  readonly settingsChanges: SettingsChangeRepository;
  readonly introductions: IntroductionRepository;
}

/**
 * Unité de travail (`UnitOfWork`), voir `docs/glossary.md` et l'ADR 0002.
 * Les cas d'usage n'accèdent aux données que par elle.
 */
export interface UnitOfWork {
  /**
   * Exécute `work` dans une transaction et renvoie son résultat. Une seule unité de travail
   * s'exécute à la fois : les suivantes attendent leur tour, dans l'ordre d'appel.
   * Si `work` échoue, rien de ce qu'elle a écrit n'est enregistré et l'erreur est relancée.
   */
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
