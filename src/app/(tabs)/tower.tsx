import { Redirect, router } from 'expo-router';

import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { TowerFootScreen } from '../../adapters/ui/screens/TowerFootScreen';
import { useDependencies } from '../../adapters/ui/state/Dependencies';
import { ascentLogFeature, sharedAscentSession } from '../ascent';

function TowerFoot() {
  const { keyValueStore, clock } = useDependencies();
  return (
    <TowerFootScreen
      session={sharedAscentSession(keyValueStore, clock)}
      onEnter={() => router.push('/ascent')}
      logExport={ascentLogFeature(keyValueStore, clock)?.logExport}
    />
  );
}

/**
 * L'onglet Tour : le pied de la tour (prototype #91), dans le build de preview seulement. Sur tout
 * autre canal du build, la route ramène à l'accueil.
 */
export default function TowerRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <TowerFoot />;
}
