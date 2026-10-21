import { createKeyValue } from './0001-create-key-value';
import { createHabits } from './0002-create-habits';
import { createCheckIns } from './0003-create-check-ins';
import { createCharacter } from './0004-create-character';
import type { Migration } from './Migration';

/** Toutes les migrations de la base Ascent, dans l'ordre. Ajouter les nouvelles à la fin. */
export const migrations: readonly Migration[] = [
  createKeyValue,
  createHabits,
  createCheckIns,
  createCharacter,
];
