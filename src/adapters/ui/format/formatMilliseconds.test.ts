import { formatMilliseconds } from './formatMilliseconds';

describe('formatMilliseconds', () => {
  it.each([
    [8, '8 ms'],
    [0, '0 ms'],
    [10.5, '10,5 ms'],
    [10.04, '10 ms'],
    [10.06, '10,1 ms'],
    [-2, '−2 ms'],
    [-0.04, '0 ms'],
    [1234.5, '1\u202F234,5 ms'],
    [-50000, '−50\u202F000 ms'],
    [1234567, '1\u202F234\u202F567 ms'],
  ])('writes %p as « %s »', (value, expected) => {
    expect(formatMilliseconds(value)).toBe(expected);
  });
});
