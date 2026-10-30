import { Redirect, router } from 'expo-router';

import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { IconBoardScreen } from '../../adapters/ui/screens/IconBoardScreen';

/** Quitter la planche : retour à l'écran d'avant, ou à l'accueil quand le lien profond l'a ouverte. */
function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * La planche des icônes, outil du build de preview (voir le glossaire, #157), ouverte seulement par
 * le lien profond `ascent://preview/icon-board` : aucun bouton ni menu de l'app n'y mène. Sur tout
 * autre canal du build (production, absent ou inconnu), le lien ramène à l'accueil.
 */
export default function IconBoardRoute() {
  if (currentBuildChannel() !== 'preview') {
    return <Redirect href="/" />;
  }
  return <IconBoardScreen onClose={close} />;
}
