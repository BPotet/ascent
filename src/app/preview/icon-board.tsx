import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { MonotonicBattleClock } from '../../adapters/device/battle/MonotonicBattleClock';
import { RandomSeedSource } from '../../adapters/device/battle/RandomSeedSource';
import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { ExpoBattleHaptics } from '../../adapters/device/haptics/ExpoBattleHaptics';
import { appStateVisibility } from '../../adapters/device/lifecycle/appStateVisibility';
import { ExpoAudioBattleSound } from '../../adapters/device/sound/ExpoAudioBattleSound';
import { InMemoryKeyValueStore } from '../../adapters/persistence/memory/InMemoryKeyValueStore';
import { IconBoardScreen } from '../../adapters/ui/screens/IconBoardScreen';
import { ASCENT_KEY, AscentSession } from '../../application/useCases/AscentSession';
import type { Ascent } from '../../domain/ascent/Ascent';

/** Quitter la planche : retour à l'écran d'avant, ou à l'accueil quand le lien profond l'a ouverte. */
function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

/**
 * Une ascension fixe de la planche (#159), dans une session neuve : les mêmes adaptateurs de combat
 * que la session de l'app, mais un stockage en mémoire. L'ascension réelle du joueur n'est jamais
 * lue ni écrite, même quand l'écran de l'ascension met en pause et sauvegarde.
 */
export async function openBoardAscent(saved: Ascent): Promise<AscentSession> {
  const keyValueStore = new InMemoryKeyValueStore();
  await keyValueStore.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: saved, battle: null }));
  const session = new AscentSession({
    clock: new MonotonicBattleClock(),
    seeds: new RandomSeedSource(),
    sound: new ExpoAudioBattleSound(),
    haptics: new ExpoBattleHaptics(),
    keyValueStore,
  });
  await session.load();
  return session;
}

function IconBoard() {
  const [visibility] = useState(() => appStateVisibility());
  return <IconBoardScreen onClose={close} openAscent={openBoardAscent} visibility={visibility} />;
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
  return <IconBoard />;
}
