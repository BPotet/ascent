/**
 * Canal du build (docs/glossary.md) : fixé à la construction de l'APK par l'action de build
 * Android, qui l'exporte en EXPO_PUBLIC_ASCENT_CHANNEL avant que Metro ne produise le bundle.
 */
export type BuildChannel = 'preview' | 'production';

/**
 * Seule la valeur exacte `preview` donne le build de preview. Tout le reste (absent, vide, autre
 * casse, valeur inconnue) donne la production : un oubli cache les outils de preview, jamais
 * l'inverse.
 */
export function parseBuildChannel(raw: string | undefined): BuildChannel {
  return raw === 'preview' ? 'preview' : 'production';
}

/** Le canal de ce build. */
export function currentBuildChannel(): BuildChannel {
  // Accès direct, sans déstructuration ni accès dynamique : sinon Metro n'inscrit pas la valeur
  // de la variable dans le bundle.
  return parseBuildChannel(process.env.EXPO_PUBLIC_ASCENT_CHANNEL);
}
