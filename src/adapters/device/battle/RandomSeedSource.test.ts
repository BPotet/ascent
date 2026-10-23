import { RandomSeedSource } from './RandomSeedSource';

describe('RandomSeedSource', () => {
  it('turns a random number into an unsigned 32-bit battle seed', () => {
    expect(new RandomSeedSource(() => 0).next()).toBe(0);
    expect(new RandomSeedSource(() => 0.5).next()).toBe(2_147_483_648);
    expect(new RandomSeedSource(() => 0.999_999_999_9).next()).toBe(4_294_967_295);
  });

  it('draws with Math.random by default', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.25);
    try {
      expect(new RandomSeedSource().next()).toBe(1_073_741_824);
      expect(random).toHaveBeenCalledTimes(1);
    } finally {
      random.mockRestore();
    }
  });

  it('gives a new seed for each battle', () => {
    const values = [0.1, 0.2];
    const source = new RandomSeedSource(() => values.shift()!);

    expect(source.next()).not.toBe(source.next());
  });
});
