// Les effets des signatures de #259 dans l'atlas (maquette 245, § 6) : la pointe vert ronce de la
// piqûre des Épines et l'éclat d'acier de la rupture du Sanctuaire, cernés d'encre comme l'éclat
// d'argent du Rempart. L'étincelle d'acier d'un coup amorti reprend l'étincelle bleu acier.
import { EFFECT_KINDS, effectRect, effectsAtlas, type EffectKind } from './battleEffects';

function colours(kind: EffectKind): Set<string> {
  const atlas = effectsAtlas();
  const rect = effectRect(kind, 0);
  const out = new Set<string>();
  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const start = ((rect.y + row) * atlas.width + rect.x + column) * 4;
      const [r, g, b, alpha] = Array.from(atlas.rgba.subarray(start, start + 4));
      if (alpha! > 0) {
        out.add(`#${[r, g, b].map((value) => value!.toString(16).padStart(2, '0')).join('')}`);
      }
    }
  }
  return out;
}

describe('the effects of the signatures in the atlas (#259)', () => {
  it('has one image of the thorn and one of the steel shard, after the silver shard', () => {
    const kinds = Object.keys(EFFECT_KINDS);

    expect([EFFECT_KINDS.thornSpike, EFFECT_KINDS.wardShard]).toEqual([1, 1]);
    expect(kinds.slice(kinds.indexOf('silverShard'), kinds.indexOf('silverShard') + 3)).toEqual([
      'silverShard',
      'thornSpike',
      'wardShard',
    ]);
  });

  it('draws the thorn in bramble green, outlined in ink', () => {
    expect(colours('thornSpike')).toEqual(new Set(['#06070c', '#b8e07a']));
  });

  it('draws the shard in steel, outlined in ink', () => {
    expect(colours('wardShard')).toEqual(new Set(['#06070c', '#8fb8c9']));
  });
});
