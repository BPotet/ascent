import { createKeyValue } from './0001-create-key-value';
import type { Migration } from './Migration';

/** Toutes les migrations de la base Ascent, dans l'ordre. Ajouter les nouvelles à la fin. */
export const migrations: readonly Migration[] = [createKeyValue];
