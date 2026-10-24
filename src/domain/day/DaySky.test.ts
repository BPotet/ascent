import { DAWN, daySkyOf, NIGHT } from './DaySky';

describe('daySkyOf', () => {
  it('is a night sky when no habit is active today', () => {
    expect(daySkyOf(0, 0, 0)).toEqual({ light: 0 });
    expect(daySkyOf(0, 0, 0)).toEqual(NIGHT);
  });

  it('is the sunrise when habits are active but none is expected (weekly targets reached)', () => {
    expect(daySkyOf(0, 0, 3)).toEqual({ light: 1 });
    expect(daySkyOf(0, 0, 3)).toEqual(DAWN);
  });

  it('follows the done habits over the expected habits of today', () => {
    expect(daySkyOf(0, 5, 5)).toEqual({ light: 0 });
    expect(daySkyOf(2, 5, 5)).toEqual({ light: 0.4 });
    expect(daySkyOf(1, 2, 4)).toEqual({ light: 0.5 });
  });

  it('brightens by one notch with each habit done', () => {
    expect(daySkyOf(3, 5, 5).light).toBeGreaterThan(daySkyOf(2, 5, 5).light);
  });

  it('is the sunrise when every expected habit is done', () => {
    expect(daySkyOf(5, 5, 5)).toEqual({ light: 1 });
    expect(daySkyOf(2, 2, 4)).toEqual({ light: 1 });
  });

  it('never goes past the sunrise', () => {
    expect(daySkyOf(6, 5, 6)).toEqual({ light: 1 });
  });
});
