import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';

import { MonotonicBattleClock } from '../adapters/device/battle/MonotonicBattleClock';
import { RandomSeedSource } from '../adapters/device/battle/RandomSeedSource';
import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { ExpoBattleHaptics } from '../adapters/device/haptics/ExpoBattleHaptics';
import { ExpoAudioBattleSound } from '../adapters/device/sound/ExpoAudioBattleSound';
import { HeroChoiceScreen } from '../adapters/ui/screens/HeroChoiceScreen';
import { TrialBattleScreen } from '../adapters/ui/screens/TrialBattleScreen';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import { BattleSession } from '../application/useCases/BattleSession';
import { startTrialBattle } from '../domain/battle/Battle';
import type { HeroKind } from '../domain/battle/combatants';

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
 * Prototype #90 : le héros choisi, et l'ordre d'action par Initiative. « Rejouer » garde le héros.
 */
function TrialBattle({ hero }: { readonly hero: HeroKind }) {
  const { keyValueStore } = useDependencies();
  const [assembly] = useState(() => {
    const sound = new ExpoAudioBattleSound();
    const session = new BattleSession(
      {
        clock: new MonotonicBattleClock(),
        seeds: new RandomSeedSource(),
        sound,
        haptics: new ExpoBattleHaptics(),
        keyValueStore,
      },
      { createBattle: (options) => startTrialBattle({ ...options, hero, initiative: true }) },
    );
    return {
      sound,
      session,
      latencies: () => sound.latencies(),
      expectedLatency: () => sound.expectedLatency(),
    };
  });
  useEffect(() => () => assembly.sound.release(), [assembly]);

  return (
    <TrialBattleScreen
      session={assembly.session}
      onClose={close}
      trialTools={currentBuildChannel() === 'preview'}
      soundLatencies={assembly.latencies}
      expectedSoundLatency={assembly.expectedLatency}
    />
  );
}

/** Le choix du héros (prototype #90), puis le combat d'essai avec ce héros. */
function TrialBattleWithHeroChoice() {
  const [hero, setHero] = useState<HeroKind | null>(null);
  if (hero === null) return <HeroChoiceScreen onStart={setHero} onClose={close} />;
  return <TrialBattle hero={hero} />;
}

/**
 * Le combat d'essai (#31), ouvert par le point d'entrée provisoire du build de preview. Sur tout
 * autre canal du build (production, absent ou inconnu), la route ramène à l'accueil.
 */
export default function TrialBattleRoute() {
  if (currentBuildChannel() !== 'preview') {
    return <Redirect href="/" />;
  }
  return <TrialBattleWithHeroChoice />;
}
