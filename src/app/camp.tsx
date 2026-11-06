import { Redirect, router } from 'expo-router';

import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { CampScreen } from '../adapters/ui/screens/CampScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import { sharedCampSession } from './ascent';

/** Quitter le camp : toujours vers le pied de la tour ; le geste retour suit la pile. */
function leave(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/tower');
  }
}

function Camp() {
  const { keyValueStore, clock } = useDependencies();
  return (
    <CampScreen
      camp={sharedCampSession(keyValueStore, clock)}
      onLeave={leave}
      onOpenTree={(hero) => router.push({ pathname: '/power-tree', params: { hero } })}
    />
  );
}

/** Le camp (#40), dans le build de preview seulement, comme toute la tour. */
export default function CampRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <Camp />;
}
