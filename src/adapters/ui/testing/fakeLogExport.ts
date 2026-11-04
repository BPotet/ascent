// Réservé aux tests des écrans : un Export du journal simulé, dont on choisit le statut et l'issue.
import type {
  AscentLogStatus,
  ExportOutcome,
  LogExport,
} from '../../../application/useCases/exportAscentLog';

export function fakeLogExport(status: AscentLogStatus = { count: 7, inProgress: false }) {
  let current = status;
  let next: () => Promise<ExportOutcome> = async () => ({ result: 'shared', ignoredLogs: 0 });
  const logExport: LogExport & { readonly exports: jest.Mock } = {
    status: async () => current,
    exports: jest.fn(),
    export: () => {
      logExport.exports();
      return next();
    },
  };
  return {
    logExport,
    setStatus: (value: AscentLogStatus) => {
      current = value;
    },
    /** La prochaine issue de l'export ; une fonction peut aussi ne jamais se résoudre. */
    willExport: (outcome: () => Promise<ExportOutcome>) => {
      next = outcome;
    },
  };
}
