import { ATTACKS, type AttackKind } from '../../../../../domain/battle/attacks';
import { toRgba, type PixelImage } from '../Sprite';
import {
  ENEMY_FRAMES,
  HERO_FRAMES,
  RED_FRAMES,
  attackMotion,
  battleSprite,
  playsRed,
  type BattleCharacter,
  type BattleFrame,
  type EnemyFrame,
} from './battleCharacters';
import { isHero } from './heroAnimations';

/** Un rectangle d'un atlas, en pixels d'art. */
export interface AtlasRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * La table d'un atlas, lisible sur le fil UI (que des nombres) : la place de chaque variante,
 * repli compris. `slots[(frame × 3 + tier) × 2 + red]` est l'indice de la case dans `cells`, qui
 * donne `x`, `y` à la suite. Les poses d'un coup (#139) ont leurs propres numéros, après ceux des
 * images, dans `attacks` : type de coup, puis image.
 */
export interface AtlasTable {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly frames: Readonly<Record<string, number>>;
  readonly attacks: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly slots: readonly number[];
  readonly cells: readonly number[];
}

export interface BattleAtlas extends PixelImage {
  readonly table: AtlasTable;
}

// Stryker disable all: découpage des atlas, vérifié par ses tests et la conformité aux maquettes.
/** Les cases par ligne d'un atlas. */
const COLUMNS = 8;

/** Les liserés dessinés pour chaque image d'un ennemi, comme les poses de la maquette. */
const ENEMY_TIERS: Readonly<Record<string, readonly (0 | 1 | 2)[]>> = {
  idle0: [0, 1],
  idle1: [0],
  step0: [1],
  step1: [1],
  step2: [1],
  ant0: [1, 2],
  ant1: [1, 2],
  ant2: [1, 2],
  hes: [1, 2],
  feint0: [1, 2],
  feint1: [1, 2],
  rec0: [1, 2],
  rec1: [1, 2],
  lunge: [2],
  impact: [2],
  hurt: [0],
  down: [0],
};

interface Variant {
  readonly frame: BattleFrame;
  readonly tier: 0 | 1 | 2;
  readonly red: boolean;
  /** Le type de coup dont la pose vient, `null` pour l'animation complète. */
  readonly attack: AttackKind | null;
}

/**
 * Les poses d'un coup d'un ennemi (#139) : une variante par pose, au seul palier 0 (les paliers
 * d'une pose recopiée sont des copies identiques), et sa variante rouge pour un coup imparable
 * d'un ennemi qui joue sa palette rouge.
 */
function attackVariants(character: BattleCharacter): Variant[] {
  if (isHero(character)) return [];
  return Object.entries(attackMotion(character)).flatMap(([attack, motion]) => {
    const kind = attack as AttackKind;
    const red = ATTACKS[kind].perilous && playsRed(character);
    return Object.keys(motion?.lift ?? {}).flatMap((frame) => [
      { frame: frame as EnemyFrame, tier: 0 as const, red: false, attack: kind },
      ...(red ? [{ frame: frame as EnemyFrame, tier: 0 as const, red: true, attack: kind }] : []),
    ]);
  });
}

function variantsOf(character: BattleCharacter): Variant[] {
  if (isHero(character)) {
    return [
      ...HERO_FRAMES.map((frame) => ({ frame, tier: 0 as const, red: false, attack: null })),
      { frame: 'raise', tier: 1, red: false, attack: null },
      { frame: 'raiseG', tier: 1, red: false, attack: null },
    ];
  }
  return [
    ...ENEMY_FRAMES.flatMap((frame) =>
      (ENEMY_TIERS[frame] ?? [0]).flatMap((tier) => [
        { frame, tier, red: false, attack: null },
        ...(RED_FRAMES.includes(frame) ? [{ frame, tier, red: true, attack: null }] : []),
      ]),
    ),
    ...attackVariants(character),
  ];
}

/**
 * La variante dessinée la plus proche : même image du même coup, liseré le plus proche, sans rouge
 * sinon.
 */
function nearest(variants: readonly Variant[], wanted: Variant): number {
  let best = -1;
  let bestScore = Infinity;
  variants.forEach((variant, index) => {
    if (variant.frame !== wanted.frame || variant.attack !== wanted.attack) return;
    const score = Math.abs(variant.tier - wanted.tier) + (variant.red === wanted.red ? 0 : 10);
    if (score < bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

const atlases = new Map<BattleCharacter, BattleAtlas>();

/**
 * L'atlas d'un personnage : toutes ses images, paliers de liseré et palette rouge compris, dans
 * une seule image RGBA, avec sa table. Fait une fois par lancement (cache de module), au montage
 * de l'écran du combat, jamais pendant la phase ennemie.
 */
export function battleAtlas(character: BattleCharacter): BattleAtlas {
  const cached = atlases.get(character);
  if (cached !== undefined) return cached;
  const variants = variantsOf(character);
  const images = variants.map(({ frame, tier, red, attack }) =>
    battleSprite(character, frame, { tier, red, attack }),
  );
  const { width: cellWidth, height: cellHeight } = images[0]!.sprite;
  const rows = Math.ceil(variants.length / COLUMNS);
  const width = COLUMNS * cellWidth;
  const height = rows * cellHeight;
  const rgba = new Uint8Array(width * height * 4);
  const cells: number[] = [];
  images.forEach(({ sprite }, index) => {
    const x = (index % COLUMNS) * cellWidth;
    const y = Math.floor(index / COLUMNS) * cellHeight;
    cells.push(x, y);
    const pixels = toRgba(sprite);
    for (let row = 0; row < cellHeight; row += 1) {
      rgba.set(
        pixels.subarray(row * cellWidth * 4, (row + 1) * cellWidth * 4),
        ((y + row) * width + x) * 4,
      );
    }
  });
  const names = isHero(character) ? HERO_FRAMES : ENEMY_FRAMES;
  const frames = Object.fromEntries(names.map((name, index) => [name, index]));
  // Les poses d'un coup, numérotées à la suite des images, dans l'ordre de leurs variantes.
  const posed: { readonly frame: BattleFrame; readonly attack: AttackKind | null }[] = [
    ...names.map((frame) => ({ frame, attack: null })),
    ...variants.filter((variant) => variant.attack !== null && !variant.red),
  ];
  const attacks: Record<string, Record<string, number>> = {};
  posed.forEach(({ frame, attack }, index) => {
    if (attack !== null) attacks[attack] = { ...attacks[attack], [frame]: index };
  });
  const slots = posed.flatMap(({ frame, attack }) =>
    [0, 1, 2].flatMap((tier) =>
      [false, true].map((red) =>
        nearest(variants, { frame, tier: tier as 0 | 1 | 2, red, attack }),
      ),
    ),
  );
  const atlas = {
    width,
    height,
    rgba,
    table: { cellWidth, cellHeight, frames, attacks, slots, cells },
  };
  atlases.set(character, atlas);
  return atlas;
}
// Stryker restore all

/**
 * Le rectangle d'une image dans l'atlas de son personnage (`frameRect`), au plus proche de la
 * variante demandée : la pose du coup `attack` quand il en a une pour cette image (#139), celle de
 * l'animation complète sinon. Lisible sur le fil UI : ne lit que la table.
 */
export function atlasRect(
  table: AtlasTable,
  frame: string,
  tier: number,
  red: boolean,
  attack: string | null = null,
): AtlasRect {
  'worklet';
  const own = attack === null ? undefined : table.attacks[attack]?.[frame];
  const index = own ?? table.frames[frame] ?? 0;
  const cell = table.slots[(index * 3 + tier) * 2 + (red ? 1 : 0)] ?? 0;
  return {
    x: table.cells[cell * 2] ?? 0,
    y: table.cells[cell * 2 + 1] ?? 0,
    width: table.cellWidth,
    height: table.cellHeight,
  };
}

/** Le rectangle d'une image dans l'atlas de son personnage. */
export function frameRect(
  character: BattleCharacter,
  frame: BattleFrame,
  tier: 0 | 1 | 2,
  red: boolean,
  attack: AttackKind | null = null,
): AtlasRect {
  return atlasRect(battleAtlas(character).table, frame, tier, red, attack);
}
