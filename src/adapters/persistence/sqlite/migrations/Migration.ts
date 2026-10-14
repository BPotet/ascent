/**
 * Migration — une évolution versionnée du schéma de la base locale.
 * Les versions commencent à 1 et se suivent sans trou. Une migration publiée ne se modifie jamais :
 * on en ajoute une nouvelle.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}
