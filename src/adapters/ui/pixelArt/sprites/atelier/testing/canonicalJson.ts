/**
 * Aide de test : le JSON canonique d'une copie de l'Atelier (clés triées à tous les niveaux, sans
 * espaces, caractères non ASCII tels quels), la règle de `json.dumps(sort_keys=True,
 * separators=(',', ':'), ensure_ascii=False)`, et sa sha256.
 */
import { createHash } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, each]) => each !== undefined,
    );
    return `{${entries
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, each]) => `${JSON.stringify(key)}:${canonicalJson(each)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
