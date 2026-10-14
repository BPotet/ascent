import type { Migration } from './Migration';

export const createKeyValue: Migration = {
  version: 1,
  name: 'create key_value',
  sql: `
    CREATE TABLE key_value (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    ) STRICT;
  `,
};
