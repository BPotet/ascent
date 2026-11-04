import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { FileShare, SharedFile } from '../../../application/ports/FileShare';

/**
 * Le partage d'un fichier par le Menu de partage d'Android (#196) : le fichier est écrit dans le
 * cache de l'app (aucune permission de stockage), puis envoyé. Sur Android, le menu se referme sur
 * un partage comme sur une annulation, sans dire lequel.
 */
export class ExpoFileShare implements FileShare {
  async share({ name, mimeType, contents }: SharedFile): Promise<void> {
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(contents);
    if (!(await isAvailableAsync())) throw new Error('The share menu is not available');
    await shareAsync(file.uri, { mimeType, dialogTitle: 'Exporter le journal' });
  }
}
