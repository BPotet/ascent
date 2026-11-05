// Les trois ennemis du Beffroi (#214), recopiés de l'Atelier par la conversation (ADR 0010, avenant
// #214) : sans maquette à laquelle les comparer, la fidélité de la copie repose sur ses empreintes
// (sha256 du JSON canonique de chaque partie recopiée, la règle de `json.dumps(sort_keys=True,
// separators=(',', ':'), ensure_ascii=False)`), recalculées ici, et sur une seconde lecture de
// l'Atelier à la revue. La cohérence structurelle attrape les fautes de forme.
import { createHash } from 'node:crypto';

import { TIERS } from '../../../../../domain/ascent/tiers';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../../../../domain/battle/combatants';
import { GUARD_INTENT_CHANCE } from '../../../../../domain/battle/intents';
import { ENEMY_NAMES } from '../../../format/battleText';
import { artPalette } from '../../artPalette';
import { ENEMY_FRAMES, playsRed } from '../battle/battleCharacters';
import { BELL_NOVICE_ANIMATION } from './data/bellNovice';
import { CLOCK_JACK_ANIMATION } from './data/clockJack';
import { MATINS_RINGER_ANIMATION } from './data/matinsRinger';
import { MOTHKIN_ANIMATION } from './data/mothkin';
import { PORTRAITS } from './data/portraits';
import { animationSprite, battleCell, type FullAnimation } from './fullAnimation';

/** Le JSON canonique : clés triées à tous les niveaux, sans espaces, caractères non ASCII tels quels. */
function canonicalJson(value: unknown): string {
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

const sha256 = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

/** Chaque ennemi : son animation, l'empreinte de la copie, sa case, ses poses en plus et ses poses d'un coup. */
const ENTRIES = [
  [
    'bellNovice',
    BELL_NOVICE_ANIMATION,
    '72133f8383841ada6a86e372ce05dcc8d4c9c02dec3219b7d00cae79552e67cf',
    [44, 52],
    [],
    { delayed: 'Volée manquée' },
  ],
  [
    'matinsRinger',
    MATINS_RINGER_ANIMATION,
    'edb7f08351db6df792c23166a3efe6b49d2c0c76c219ab741638d8003f2f746e',
    [44, 52],
    ['guard', 'raiseAlly'],
    {},
  ],
  [
    'clockJack',
    CLOCK_JACK_ANIMATION,
    '5949bb247aae067f825ecade78be8899e8aa3e32ef677445f484944a1d5d689b',
    [48, 54],
    [],
    { perilous: 'Heure pleine' },
  ],
] as const;

/** Les poses propres d'un coup, lues dans l'Atelier (story #214, « Données de l'Atelier »). */
const ATTACK_POSE_FRAMES: Readonly<Record<string, readonly string[]>> = {
  delayed: ['ant0', 'ant1', 'ant2', 'hes', 'impact', 'lunge'],
  perilous: ['ant0', 'ant1', 'ant2', 'impact', 'lunge', 'rec0'],
};

const codeOf = (tint: string) =>
  artPalette.tints.findIndex((known) => known?.toLowerCase() === tint.toLowerCase());

/** Des poses de `w` × `h` en caractères de la palette, une ancre par pose. */
function expectPoses(
  full: FullAnimation,
  frames: Readonly<Partial<Record<string, readonly string[]>>>,
  anchors: Readonly<Partial<Record<string, unknown>>>,
): void {
  expect(Object.keys(anchors).sort()).toEqual(Object.keys(frames).sort());
  for (const [pose, rows] of Object.entries(frames)) {
    expect([pose, rows!.length]).toEqual([pose, full.h]);
    for (const row of rows!) {
      expect([pose, row.length]).toEqual([pose, full.w]);
      expect(row).toMatch(/^[.0-9a-z]*$/);
      for (const char of row.replaceAll('.', '')) {
        expect(parseInt(char, 36)).toBeLessThan(full.pal.length);
      }
    }
  }
}

describe('the canonical JSON of the copies (#214)', () => {
  it('gives the bytes of json.dumps on an animation already copied: the Mothkin', () => {
    // Calculée par Python sur la même animation, avant de figer les empreintes de #214.
    expect(sha256(MOTHKIN_ANIMATION)).toBe(
      '620c92503486fbe2e82ad1ab593ac3cd744778293ae9e810d96fe7be95d7dc51',
    );
  });

  it('keeps the characters that are not ASCII, and escapes nothing else', () => {
    expect(canonicalJson({ b: [1, 'Volée'], a: { d: null, c: "l'heure" } })).toBe(
      '{"a":{"c":"l\'heure","d":null},"b":[1,"Volée"]}',
    );
  });
});

describe.each(ENTRIES)(
  'the full animation of %s (#214)',
  (_, animation, fingerprint, size, extra, moves) => {
    const full: FullAnimation = animation;

    it('is the copy of the Atelier: the sha256 of the key animation', () => {
      expect(sha256(full)).toBe(fingerprint);
    });

    it('has its size and its battle cell', () => {
      expect([full.w, full.h]).toEqual(size);
      expect(battleCell(full)).toEqual(size);
    });

    it('has the 17 poses of the battle and its extra poses, of h lines of w characters', () => {
      expect(Object.keys(full.frames).sort()).toEqual([...ENEMY_FRAMES, ...extra].sort());
      expectPoses(full, full.frames, full.anchors);
    });

    it('has its tints in the art palette, and a red palette only with a perilous attack', () => {
      for (const tint of [...full.pal, ...(full.red ?? [])]) {
        expect([tint, codeOf(tint) > 0]).toEqual([tint, true]);
      }
      expect(full.red?.length).toBe('perilous' in moves ? full.pal.length : undefined);
    });

    it('has the poses of its moves, with their names', () => {
      const attackPoses = full.attackPoses ?? {};
      expect(
        Object.fromEntries(Object.entries(attackPoses).map(([kind, poses]) => [kind, poses!.move])),
      ).toEqual(moves);
      for (const [kind, poses] of Object.entries(attackPoses)) {
        expect(Object.keys(poses!.frames).sort()).toEqual(ATTACK_POSE_FRAMES[kind]);
        expectPoses(full, poses!.frames, poses!.anchors);
      }
    });

    it('paints every pose of its own in its cell, extra poses included', () => {
      for (const pose of Object.keys(full.frames)) {
        expect(animationSprite(full, pose).sprite.height).toBe(battleCell(full)[1]);
      }
    });

    it('copies the keys of the animation only, neither the icon nor the proposals', () => {
      expect(Object.keys(full).sort()).toEqual(
        ['w', 'h', 'pal', 'frames', 'anchors', 'red', 'attackPoses']
          .filter((key) => key in full)
          .sort(),
      );
      expect(Object.keys(full)).not.toContain('icon');
      expect(Object.keys(full)).not.toContain('proposals');
    });
  },
);

interface CodexMove {
  readonly attack: string;
  readonly damage: number;
  readonly description: string;
  readonly name: string;
  readonly weight: number;
}

interface CodexEntry {
  readonly name: string;
  readonly stats: {
    readonly drawWeight: number;
    readonly groupCap: number;
    readonly guardIntentChancePercent: number;
    readonly initiative: number;
    readonly maxGuard: number;
    readonly maxHp: number;
    readonly moves: readonly CodexMove[];
    readonly role: string | null;
    readonly roleDescription?: string;
  };
  /** La sha256 de `data.stats`, calculée à la recopie. */
  readonly fingerprint: string;
}

/** `data.name` et `data.stats` des fiches `codex/<id>` (version 2), recopiés par la conversation. */
const CODEX: Readonly<Record<'bellNovice' | 'matinsRinger' | 'clockJack', CodexEntry>> = {
  bellNovice: {
    name: 'Novice des cloches',
    stats: {
      drawWeight: 3,
      groupCap: 2,
      guardIntentChancePercent: 0,
      initiative: 6,
      maxGuard: 8,
      maxHp: 26,
      moves: [
        {
          attack: 'basic',
          damage: 4,
          description:
            "Il fait tourner un bout de corde effilochée au-dessus de sa tête, puis le lance d'un coup sec. Un reflet blanc, un seul impact.",
          name: 'Bout de corde',
          weight: 2,
        },
        {
          attack: 'delayed',
          damage: 6,
          description:
            "Il tire de tout son poids sur une corde invisible et reste suspendu, les pieds dans le vide, comme une cloche qui ne veut pas partir. Laissez passer l'hésitation : il retombe sur le héros quand on ne l'attend plus.",
          name: 'Volée manquée',
          weight: 1,
        },
      ],
      role: null,
    },
    fingerprint: '07262ab8cfdc723b5a5d19b1ef32fe546d050e035d573932fe473efbf89f5be4',
  },
  matinsRinger: {
    name: 'Sonneuse de matines',
    stats: {
      drawWeight: 1,
      groupCap: 1,
      guardIntentChancePercent: 33,
      initiative: 3,
      maxGuard: 16,
      maxHp: 42,
      moves: [
        {
          attack: 'delayed',
          damage: 4,
          description:
            "Elle lève sa clochette et la tient immobile, sans un son, le temps d'une prière. Laissez passer l'hésitation : le coup tombe au premier tintement.",
          name: 'Angélus',
          weight: 1,
        },
      ],
      role: 'support',
      roleDescription:
        "Quand un allié tombe, elle agite sa clochette au-dessus de lui et il se relève, une seule fois, à la moitié de ses forces : une flèche vers le haut l'annonce. Quand sa garde est entamée, elle serre sa clochette contre elle et la referme. Tant qu'elle sonne matines, rien de ce qui tombe ne reste tombé.",
    },
    fingerprint: '2393727bab257ccf63cd22336cfe771ed2bbf04dcf4698369da91f42c7ca946e',
  },
  clockJack: {
    name: 'Jaquemart',
    stats: {
      drawWeight: 2,
      groupCap: 1,
      guardIntentChancePercent: 0,
      initiative: 1,
      maxGuard: 20,
      maxHp: 48,
      moves: [
        {
          attack: 'double',
          damage: 3,
          description:
            "Il pivote sur son axe en grinçant et frappe deux fois, ding, dong, au même rythme que l'horloge. Le reflet se dédouble : deux impacts, deux parades.",
          name: 'Demi-heure',
          weight: 2,
        },
        {
          attack: 'perilous',
          damage: 9,
          description:
            "Son mécanisme se remonte d'un cran, son marteau monte jusqu'au bout de sa course, sa peinture rougit et le sceau pulse au-dessus de lui. L'heure ne se pare pas : esquivez quand le marteau tombe.",
          name: 'Heure pleine',
          weight: 1,
        },
      ],
      role: null,
    },
    fingerprint: '8ad571c95e136463673a413c745e62ef8af2a6162868f448be8b90d17109085f',
  },
};

/** Les empreintes des portraits recopiés : `{ w, h, palette, rows }` de `icon.proposals[chosen]`. */
const PORTRAIT_FINGERPRINTS = {
  bellNovice: '33cf8382dc2eefe2dd84b6dc948f0a5c84f4237916d9ddee2bc921b07071d4d1',
  matinsRinger: '5e826c5b4cceaa7f3c0c1dbc5c92745ac206b36b22c346eb3375affda4640f8f',
  clockJack: 'df1c28d399a99b6606d33c1d82c249c7ac7675ef7f4da1a2d9fabc5ed63f3264',
} as const;

const BELFRY_KINDS = Object.keys(CODEX) as (keyof typeof CODEX)[];

describe.each(BELFRY_KINDS)('the Codex entry of %s, copied in the game (#214)', (kind) => {
  const { name, stats, fingerprint } = CODEX[kind];

  it('is the copy of the Atelier: the sha256 of data.stats', () => {
    expect(sha256(stats)).toBe(fingerprint);
  });

  it('gives the enemy its HP, its guard, its moves and its role', () => {
    expect(ENEMIES[kind as EnemyKind]).toEqual({
      maxHp: stats.maxHp,
      maxGuard: stats.maxGuard,
      moves: stats.moves.map(({ attack, damage, weight }) => ({
        attack,
        damage,
        ...(weight !== 1 && { weight }),
      })),
      supports: stats.role === 'support',
    });
    expect(stats.guardIntentChancePercent).toBe(
      stats.role === 'support' ? Math.round(GUARD_INTENT_CHANCE * 100) : 0,
    );
  });

  it('gives the enemy its Initiative and its name', () => {
    expect(ENEMY_INITIATIVE[kind]).toBe(stats.initiative);
    expect(ENEMY_NAMES[kind]).toBe(name);
  });

  it('gives the enemy its draw weight and its cap at tier 3, never alone as a support', () => {
    expect(TIERS[3].enemies.find((draw) => draw.kind === kind)).toEqual({
      kind,
      weight: stats.drawWeight,
      cap: stats.groupCap,
      ...(stats.role === 'support' && { neverAlone: true }),
    });
  });

  it('plays the red palette only with a perilous move', () => {
    expect(playsRed(kind)).toBe(stats.moves.some(({ attack }) => attack === 'perilous'));
  });

  it('has its portrait, the copy of the chosen icon: its sha256', () => {
    const portrait = PORTRAITS[kind];
    expect(portrait).not.toBeNull();
    const { w, h, palette, rows } = portrait!;
    expect(sha256({ w, h, palette, rows })).toBe(PORTRAIT_FINGERPRINTS[kind]);
  });
});

it('plays the red palette for the Clock jack only, of the three enemies of the Belfry (#214)', () => {
  expect(BELFRY_KINDS.filter(playsRed)).toEqual(['clockJack']);
});
