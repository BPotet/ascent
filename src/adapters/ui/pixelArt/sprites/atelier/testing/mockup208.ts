// Le lecteur des images de la maquette validée des coffres et des clés (#208,
// `docs/mockups/208-coffres-cles/index.html`), pour les tests de fidélité de ses stories (#227,
// #226). Sa constante `ART` est rangée par image, puis par proposition (`A`, `B`), et sa palette
// s'appelle `palette` (et non `pal`, comme dans la maquette 210).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AssetImage } from '../fullAnimation';

const MOCKUPS = path.join(__dirname, '../../../../../../../docs/mockups');

/** Une image de la maquette : celle d'une proposition, avec son nom. */
export interface MockupImage extends AssetImage {
  readonly name: string;
}

/**
 * `ART` d'une maquette rangée comme la 208 (image, puis proposition, palette `palette`) : la 208
 * et la 232 (#235, `docs/mockups/232-arbre-de-pouvoirs/`).
 */
export function mockupArt(
  folder: string,
): Readonly<Record<string, Readonly<Record<string, MockupImage>>>> {
  const html = readFileSync(path.join(MOCKUPS, folder, 'index.html'), 'utf8');
  const json = /const ART=(\{.*?\});\n/.exec(html)?.[1];
  if (json === undefined) throw new Error(`The mockup ${folder} has no ART`);
  return JSON.parse(json) as Record<string, Record<string, MockupImage>>;
}

/** `ART` de la maquette 208 : l'image `id`, proposition `proposal` (`A`, `B`). */
export function mockup208Art(): Readonly<Record<string, Readonly<Record<string, MockupImage>>>> {
  return mockupArt('208-coffres-cles');
}

/** La teinte de chaque pixel (`null` : transparent) : la fidélité se juge pixel pour pixel. */
export function pixels(image: AssetImage): (string | null)[][] {
  return image.rows.map((row) =>
    Array.from(row, (char) =>
      char === '.' ? null : image.palette[parseInt(char, 36)]!.toLowerCase(),
    ),
  );
}
