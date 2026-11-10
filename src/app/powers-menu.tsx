import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { ExpoHaptics } from '../adapters/device/haptics/ExpoHaptics';
import { PowersMenuScreen } from '../adapters/ui/screens/PowersMenuScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import type { HeroKind } from '../domain/battle/combatants';
import { sharedAscentSession, sharedCampSession } from './ascent';

/** La vibration courte d'un 4e pouvoir refusé (#270, M2). */
const refusal = new ExpoHaptics();

/** Quitter le menu : le retour, ou un « Valider » enregistré ; sans pile, le pied de la tour. */
function leave(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/tower');
  }
}

function PowersMenu() {
  const { keyValueStore, clock, unitOfWork } = useDependencies();
  const { hero, from } = useLocalSearchParams<{ hero?: string; from?: string }>();
  const kind: HeroKind = hero === 'wanderer' ? 'wanderer' : 'sentinel';
  return (
    <PowersMenuScreen
      camp={sharedCampSession(keyValueStore, clock, unitOfWork)}
      session={sharedAscentSession(keyValueStore, clock)}
      hero={kind}
      from={from === 'choice' ? 'choice' : 'tower'}
      refusal={refusal}
      onLeave={leave}
      onCamp={() => router.replace('/camp')}
    />
  );
}

/** Le menu des pouvoirs (#270), dans le build de preview seulement, comme le camp. */
export default function PowersMenuRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <PowersMenu />;
}
