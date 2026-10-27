import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { MonotonicBattleClock } from '../adapters/device/battle/MonotonicBattleClock';
import { RandomSeedSource } from '../adapters/device/battle/RandomSeedSource';
import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { ExpoBattleHaptics } from '../adapters/device/haptics/ExpoBattleHaptics';
import { appStateVisibility } from '../adapters/device/lifecycle/appStateVisibility';
import { ExpoAudioBattleSound } from '../adapters/device/sound/ExpoAudioBattleSound';
import { AscentScreen } from '../adapters/ui/screens/AscentScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import type { KeyValueStore } from '../application/ports/KeyValueStore';
import { AscentSession } from '../application/useCases/AscentSession';

let shared: AscentSession | null = null;

/**
 * La session d'ascension de l'app, partagée par le pied de la tour et l'écran de l'ascension :
 * horloge de combat, graine au hasard, sons, vibrations et stockage clé-valeur de l'app. Tout est
 * sur le téléphone : l'ascension se joue hors ligne.
 */
export function sharedAscentSession(keyValueStore: KeyValueStore): AscentSession {
  shared ??= new AscentSession({
    clock: new MonotonicBattleClock(),
    seeds: new RandomSeedSource(),
    sound: new ExpoAudioBattleSound(),
    haptics: new ExpoBattleHaptics(),
    keyValueStore,
  });
  return shared;
}

function leave(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/tower');
  }
}

function Ascent() {
  const { keyValueStore } = useDependencies();
  const [visibility] = useState(() => appStateVisibility());
  return (
    <AscentScreen
      session={sharedAscentSession(keyValueStore)}
      visibility={visibility}
      onLeave={leave}
    />
  );
}

/** L'ascension (prototype #91), dans le build de preview seulement. */
export default function AscentRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <Ascent />;
}
