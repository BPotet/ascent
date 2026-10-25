import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';

import { MonotonicBattleClock } from '../adapters/device/battle/MonotonicBattleClock';
import { RandomSeedSource } from '../adapters/device/battle/RandomSeedSource';
import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { ExpoBattleHaptics } from '../adapters/device/haptics/ExpoBattleHaptics';
import { ExpoAudioBattleSound } from '../adapters/device/sound/ExpoAudioBattleSound';
import { TrialBattleScreen } from '../adapters/ui/screens/TrialBattleScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import { BattleSession } from '../application/useCases/BattleSession';

/** Quitter le combat d'essai : retour à l'écran d'avant, ou à l'accueil. */
function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * Assemblage du combat d'essai : la session de combat sur les adaptateurs du téléphone (horloge
 * de combat, graine au hasard, sons préchargés, vibrations) et le stockage clé-valeur de l'app
 * (bulles déjà vues, réglages d'essai). Tout est sur le téléphone : il se joue hors ligne.
 */
function TrialBattle() {
  const { keyValueStore } = useDependencies();
  const [assembly] = useState(() => {
    const sound = new ExpoAudioBattleSound();
    const session = new BattleSession({
      clock: new MonotonicBattleClock(),
      seeds: new RandomSeedSource(),
      sound,
      haptics: new ExpoBattleHaptics(),
      keyValueStore,
    });
    return { sound, session, latencies: () => sound.latencies() };
  });
  useEffect(() => () => assembly.sound.release(), [assembly]);

  return (
    <TrialBattleScreen
      session={assembly.session}
      onClose={close}
      trialTools={currentBuildChannel() === 'preview'}
      soundLatencies={assembly.latencies}
    />
  );
}

/**
 * Le combat d'essai (#31), ouvert par le point d'entrée provisoire du build de preview. Sur tout
 * autre canal du build (production, absent ou inconnu), la route ramène à l'accueil.
 */
export default function TrialBattleRoute() {
  if (currentBuildChannel() !== 'preview') {
    return <Redirect href="/" />;
  }
  return <TrialBattle />;
}
