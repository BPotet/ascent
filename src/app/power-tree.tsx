import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { PowerTreeScreen } from '../adapters/ui/screens/PowerTreeScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import type { HeroKind } from '../domain/battle/combatants';
import { sharedCampSession } from './ascent';

/** Quitter l'arbre : toujours vers le camp ; le geste retour suit la pile. */
function leave(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/camp');
  }
}

function PowerTree() {
  const { keyValueStore, clock, unitOfWork } = useDependencies();
  const { hero } = useLocalSearchParams<{ hero?: string }>();
  const kind: HeroKind = hero === 'wanderer' ? 'wanderer' : 'sentinel';
  return (
    <PowerTreeScreen
      camp={sharedCampSession(keyValueStore, clock, unitOfWork)}
      hero={kind}
      onLeave={leave}
    />
  );
}

/** L'arbre de pouvoirs d'un héros (#235), dans le build de preview seulement, comme le camp. */
export default function PowerTreeRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <PowerTree />;
}
