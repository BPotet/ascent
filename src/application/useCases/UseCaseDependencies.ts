import type { Clock } from '../ports/Clock';
import type { UnitOfWork } from '../ports/UnitOfWork';

/** Les ports dont ont besoin les cas d'usage du suivi des habitudes. */
export interface UseCaseDependencies {
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}
