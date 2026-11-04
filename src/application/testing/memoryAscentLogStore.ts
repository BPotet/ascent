// Réservé aux tests : un stockage des journaux d'ascension en mémoire, qui peut retenir ou faire
// échouer ses écritures.
import type { AscentLog } from '../../domain/ascentLog/AscentLog';
import type { AscentLogStore } from '../ports/AscentLogStore';

export function memoryAscentLogStore(initial: readonly string[] = []) {
  const logs = new Map<number, string>(initial.map((raw, index) => [index + 1, raw]));
  let nextId = logs.size + 1;
  let failures = 0;
  let held: Promise<void> | null = null;
  let release: () => void = () => undefined;
  const writes: AscentLog[] = [];
  const write = async () => {
    if (held !== null) await held;
    if (failures > 0) {
      failures -= 1;
      throw new Error('The store failed');
    }
  };
  const store: AscentLogStore = {
    start: async (log, kept) => {
      await write();
      const started = { ...log, id: nextId };
      nextId += 1;
      writes.push(started);
      logs.set(started.id, JSON.stringify(started));
      const ids = [...logs.keys()];
      ids.slice(0, Math.max(0, ids.length - kept)).forEach((id) => logs.delete(id));
      return started;
    },
    save: async (log) => {
      await write();
      writes.push(log);
      if (log.id !== null) logs.set(log.id, JSON.stringify(log));
    },
    latest: async () => [...logs.values()].at(-1) ?? null,
    readAll: async () => [...logs.values()],
    count: async () => logs.size,
  };
  return {
    ...store,
    logs,
    writes,
    failNext: (times = 1) => {
      failures = times;
    },
    hold: () => {
      held = new Promise((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
    },
    release: () => release(),
  };
}

export type MemoryAscentLogStore = ReturnType<typeof memoryAscentLogStore>;
