// Le lecteur des images de la maquette validée des coffres et des clés (#208,
// `docs/mockups/208-coffres-cles/index.html`), pour les tests de fidélité de ses stories (#227,
// #226). Sa constante `ART` est rangée par image, puis par proposition (`A`, `B`), et sa palette
// s'appelle `palette` (et non `pal`, comme dans la maquette 210).
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AssetImage } from '../fullAnimation';

const MOCKUP = path.join(
  __dirname,
  '../../../../../../../docs/mockups/208-coffres-cles/index.html',
);

/** Une image de la maquette : celle d'une proposition, avec son nom. */
export interface MockupImage extends AssetImage {
  readonly name: string;
}

/** `ART` de la maquette 208 : l'image `id`, proposition `proposal` (`A`, `B`). */
export function mockup208Art(): Readonly<Record<string, Readonly<Record<string, MockupImage>>>> {
  const html = readFileSync(MOCKUP, 'utf8');
  const json = /const ART=(\{.*?\});\n/.exec(html)?.[1];
  if (json === undefined) throw new Error('The mockup 208 has no ART');
  return JSON.parse(json) as Record<string, Record<string, MockupImage>>;
}

/** La teinte de chaque pixel (`null` : transparent) : la fidélité se juge pixel pour pixel. */
export function pixels(image: AssetImage): (string | null)[][] {
  return image.rows.map((row) =>
    Array.from(row, (char) =>
      char === '.' ? null : image.palette[parseInt(char, 36)]!.toLowerCase(),
    ),
  );
}
