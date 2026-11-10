import { Redirect, router, useIsFocused } from 'expo-router';

import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { TowerFootScreen } from '../../adapters/ui/screens/TowerFootScreen';
import { useDependencies } from '../../adapters/ui/state/Dependencies';
import { ascentLogFeature, sharedAscentSession, sharedCampSession } from '../ascent';

function TowerFoot() {
  const { keyValueStore, clock, unitOfWork } = useDependencies();
  const focused = useIsFocused();
  return (
    <TowerFootScreen
      session={sharedAscentSession(keyValueStore, clock)}
      camp={sharedCampSession(keyValueStore, clock, unitOfWork)}
      onEnter={() => router.push('/ascent')}
      onCamp={() => router.push('/camp')}
      onOpenPowers={({ hero, from }) =>
        router.push({ pathname: '/powers-menu', params: { hero, from } })
      }
      logExport={ascentLogFeature(keyValueStore, clock)?.logExport}
      focused={focused}
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
