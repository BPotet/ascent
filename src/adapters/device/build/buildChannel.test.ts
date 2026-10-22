import { currentBuildChannel, parseBuildChannel } from './buildChannel';

describe('parseBuildChannel', () => {
  it('reads the preview channel', () => {
    expect(parseBuildChannel('preview')).toBe('preview');
  });

  it('reads the production channel', () => {
    expect(parseBuildChannel('production')).toBe('production');
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['with another case', 'Preview'],
    ['with spaces', ' preview'],
    ['unknown', 'staging'],
  ])('falls back to production when the channel is %s', (_, raw) => {
    expect(parseBuildChannel(raw)).toBe('production');
  });
});

describe('currentBuildChannel', () => {
  const initial = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  afterEach(() => {
    if (initial === undefined) {
      delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
    } else {
      process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initial;
    }
  });

  it('reads the channel the build was made for', () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';

    expect(currentBuildChannel()).toBe('preview');
  });

  it('is production when the build has no channel', () => {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

    expect(currentBuildChannel()).toBe('production');
  });
});
