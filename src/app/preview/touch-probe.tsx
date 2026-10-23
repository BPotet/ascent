import { Redirect, router } from 'expo-router';

import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { TouchProbeScreen } from '../../adapters/ui/screens/TouchProbeScreen';

/** Quitter la sonde : retour à l'écran d'avant, ou à l'accueil quand le lien profond l'a ouverte. */
function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * La sonde de toucher, outil du build de preview (voir le glossaire), ouverte seulement par le lien
 * profond `ascent://preview/touch-probe` : aucun bouton ni menu de l'app n'y mène. Sur tout autre
 * canal du build (production, absent ou inconnu), le lien ramène à l'accueil.
 */
export default function TouchProbeRoute() {
  if (currentBuildChannel() !== 'preview') {
    return <Redirect href="/" />;
  }
  return <TouchProbeScreen onClose={close} />;
}
