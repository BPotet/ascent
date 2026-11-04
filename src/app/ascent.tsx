import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { MonotonicBattleClock } from '../adapters/device/battle/MonotonicBattleClock';
import { RandomSeedSource } from '../adapters/device/battle/RandomSeedSource';
import { currentAppVersion } from '../adapters/device/build/appVersion';
import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { ExpoBattleHaptics } from '../adapters/device/haptics/ExpoBattleHaptics';
import { appStateVisibility } from '../adapters/device/lifecycle/appStateVisibility';
import { ExpoFileShare } from '../adapters/device/share/ExpoFileShare';
import { ExpoAudioBattleSound } from '../adapters/device/sound/ExpoAudioBattleSound';
import { KeyValueAscentLogStore } from '../adapters/persistence/keyValue/KeyValueAscentLogStore';
import { AscentScreen } from '../adapters/ui/screens/AscentScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import type { Clock } from '../application/ports/Clock';
import type { KeyValueStore } from '../application/ports/KeyValueStore';
import { AscentLogRecorder } from '../application/useCases/AscentLogRecorder';
import { AscentSession } from '../application/useCases/AscentSession';
import { ascentLogExport, type LogExport } from '../application/useCases/exportAscentLog';

/** Le Journal d'ascension (#196) : l'enregistreur de la session, et l'export des deux écrans. */
export interface AscentLogFeature {
  readonly recorder: AscentLogRecorder;
  readonly logExport: LogExport;
}

let shared: AscentSession | null = null;
let feature: AscentLogFeature | null = null;

/**
 * Le Journal d'ascension, dans le build de preview seulement (ADR 0014) : sur tout autre canal,
 * `null`, et ni journal écrit, ni bouton « Exporter le journal ».
 */
export function ascentLogFeature(
  keyValueStore: KeyValueStore,
  clock: Clock,
): AscentLogFeature | null {
  if (currentBuildChannel() !== 'preview') return null;
  if (feature === null) {
    const store = new KeyValueAscentLogStore(keyValueStore);
    const recorder = new AscentLogRecorder({ store, clock });
    feature = {
      recorder,
      logExport: ascentLogExport({
        recorder,
        store,
        share: new ExpoFileShare(),
        clock,
        appVersion: currentAppVersion(),
        buildChannel: 'preview',
      }),
    };
  }
  return feature;
}

/**
 * La session d'ascension de l'app, partagée par le pied de la tour et l'écran de l'ascension :
 * horloge de combat, graine au hasard, sons, vibrations et stockage clé-valeur de l'app. Tout est
 * sur le téléphone : l'ascension se joue hors ligne.
 */
export function sharedAscentSession(keyValueStore: KeyValueStore, clock: Clock): AscentSession {
  const ascentLog = ascentLogFeature(keyValueStore, clock)?.recorder;
  shared ??= new AscentSession({
    clock: new MonotonicBattleClock(),
    seeds: new RandomSeedSource(),
    sound: new ExpoAudioBattleSound(),
    haptics: new ExpoBattleHaptics(),
    keyValueStore,
    ...(ascentLog !== undefined && { ascentLog }),
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
  const { keyValueStore, clock } = useDependencies();
  const [visibility] = useState(() => appStateVisibility());
  return (
    <AscentScreen
      session={sharedAscentSession(keyValueStore, clock)}
      visibility={visibility}
      onLeave={leave}
      logExport={ascentLogFeature(keyValueStore, clock)?.logExport}
    />
  );
}

/** L'ascension (prototype #91), dans le build de preview seulement. */
export default function AscentRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <Ascent />;
}
