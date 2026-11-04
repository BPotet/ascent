import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { ExpoFileShare } from './ExpoFileShare';

// Le fichier du cache et le Menu de partage sont simulés : leurs modules natifs n'existent pas sous Jest.
const files: { uri: string; created: unknown; contents: string | null }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    readonly uri: string;
    private readonly entry: { uri: string; created: unknown; contents: string | null };
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
      this.entry = { uri: this.uri, created: null, contents: null };
      files.push(this.entry);
    }
    create(options: unknown) {
      this.entry.created = options;
    }
    write(contents: string) {
      this.entry.contents = contents;
    }
  },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const FILE = {
  name: 'ascent-journal-2026-11-03.json',
  mimeType: 'application/json',
  contents: '{}',
} as const;

describe('ExpoFileShare', () => {
  beforeEach(() => {
    files.length = 0;
    jest.mocked(shareAsync).mockClear();
  });

  it('writes the file in the cache, then opens the share menu with it', async () => {
    await new ExpoFileShare().share(FILE);
    expect(files).toEqual([
      {
        uri: 'file:///cache/ascent-journal-2026-11-03.json',
        created: { overwrite: true },
        contents: '{}',
      },
    ]);
    expect(shareAsync).toHaveBeenCalledWith('file:///cache/ascent-journal-2026-11-03.json', {
      mimeType: 'application/json',
      dialogTitle: 'Exporter le journal',
    });
  });

  it('rejects when the share menu is not available', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValueOnce(false);
    await expect(new ExpoFileShare().share(FILE)).rejects.toThrow('share menu');
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('rejects when the share menu fails', async () => {
    jest.mocked(shareAsync).mockRejectedValueOnce(new Error('SharingInProgressException'));
    await expect(new ExpoFileShare().share(FILE)).rejects.toThrow('SharingInProgressException');
  });
});
