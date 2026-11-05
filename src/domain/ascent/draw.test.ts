import { seedRandom } from '../battle/SeededRandom';
import { drawInt, drawWeighted, pickWeighted } from './draw';

describe('pickWeighted', () => {
  const entries = [
    ['a', 1],
    ['b', 0],
    ['c', 3],
  ] as const;

  it('picks by cumulative weight, skipping the zero weights', () => {
    expect(pickWeighted(entries, 0)).toBe('a');
    expect(pickWeighted(entries, 0.249)).toBe('a');
    expect(pickWeighted(entries, 0.25)).toBe('c');
    expect(pickWeighted(entries, 0.999)).toBe('c');
  });
});

describe('drawWeighted and drawInt', () => {
  it('give the same draws for the same random state, and move the state', () => {
    const random = seedRandom(42);
    const first = drawWeighted([['x', 1] as const, ['y', 1] as const], random);

    expect(drawWeighted([['x', 1] as const, ['y', 1] as const], random)).toEqual(first);
    expect(first.random).not.toBe(random);
  });

  it('draws an integer between both bounds, included', () => {
    const values = new Set<number>();
    let random = seedRandom(1);
    for (let index = 0; index < 200; index += 1) {
      const drawn = drawInt(2, 6, random);
      values.add(drawn.value);
      random = drawn.random;
    }
    expect([...values].sort()).toEqual([2, 3, 4, 5, 6]);
  });
});
