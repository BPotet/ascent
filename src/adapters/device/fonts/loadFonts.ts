import { type FontSource, loadAsync } from 'expo-font';

/**
 * Enregistre les polices livrées avec l'app sous les noms qu'utilise l'interface. Les fichiers
 * sont dans le bundle : aucun réseau n'est nécessaire. Si le chargement échoue, le téléphone garde
 * sa police système : renvoie `false` sans bloquer le démarrage.
 */
export async function loadFonts(files: Readonly<Record<string, FontSource>>): Promise<boolean> {
  try {
    await loadAsync(files);
    return true;
  } catch {
    return false;
  }
}
