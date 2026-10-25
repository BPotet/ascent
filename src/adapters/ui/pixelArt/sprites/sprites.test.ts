import { alertEmblem } from './alertEmblem';
import { BURST_FRAMES, burstSprite } from './burstSprite';
import { characterSprite } from './characterSprite';
import type { Sprite } from './Sprite';

const INK = 1;

/** Vrai si tout pixel coloré au bord du sprite touche un contour d'encre. */
function outlined(sprite: Sprite): boolean {
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= sprite.width || y >= sprite.height
      ? 0
      : (sprite.pixels[y * sprite.width + x] ?? 0);
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const code = at(x, y);
      const touchesEmpty = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(0);
      if (code !== 0 && code !== INK && touchesEmpty) {
        return false;
      }
    }
  }
  return true;
}

const colored = (sprite: Sprite) => sprite.pixels.filter((code) => code !== 0).length;

describe('the sprites drawn by code', () => {
  it('draws the character in 3 frames of 24 × 32 art pixels, outlined in ink', () => {
    [0, 1, 2].forEach((frame) => {
      const sprite = characterSprite(frame as 0 | 1 | 2);
      expect(sprite).toMatchObject({ width: 24, height: 32 });
      expect(outlined(sprite)).toBe(true);
    });
    expect(characterSprite(0).pixels).not.toEqual(characterSprite(2).pixels);
  });

  it('draws the same character every time', () => {
    expect(characterSprite(0).pixels).toEqual(characterSprite(0).pixels);
  });

  it('draws the alert emblem in 24 × 24 art pixels, outlined in ink', () => {
    const sprite = alertEmblem();
    expect(sprite).toMatchObject({ width: 24, height: 24 });
    expect(outlined(sprite)).toBe(true);
    expect(colored(sprite)).toBeGreaterThan(100);
  });

  it('draws the burst in 3 frames of 32 × 32 art pixels, which spread out', () => {
    expect(BURST_FRAMES).toBe(3);
    const frames = [0, 1, 2].map((frame) => burstSprite(frame as 0 | 1 | 2));
    frames.forEach((sprite) => {
      expect(sprite).toMatchObject({ width: 32, height: 32 });
      expect(colored(sprite)).toBeGreaterThan(0);
    });
    // Le centre reste vide : l'étincelle éclate autour de la case.
    frames.forEach((sprite) => expect(sprite.pixels[16 * 32 + 16]).toBe(0));
    expect(frames[1]?.pixels).not.toEqual(frames[0]?.pixels);
    expect(frames[2]?.pixels).not.toEqual(frames[1]?.pixels);
  });
});
