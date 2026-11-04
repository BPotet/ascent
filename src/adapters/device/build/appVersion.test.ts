import { currentAppVersion } from './appVersion';

// La configuration de l'app lue par expo-constants, qu'on choisit pour chaque test.
const constants: { expoConfig: { version?: string } | null } = { expoConfig: null };
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return constants.expoConfig;
    },
  },
}));

describe('currentAppVersion', () => {
  it('gives the version of the app', () => {
    constants.expoConfig = { version: '0.3.0' };
    expect(currentAppVersion()).toBe('0.3.0');
  });

  it('gives "unknown" without a version', () => {
    constants.expoConfig = null;
    expect(currentAppVersion()).toBe('unknown');
  });
});
