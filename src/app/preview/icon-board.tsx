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
import {
  ASCENT_KEY,
  AscentSession,
  SHARD_TOTAL_KEY,
} from '../../application/useCases/AscentSession';
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
 * Une ascension fixe de la planche (#159), ou aucune, dans une session neuve : les mêmes adaptateurs
 * de combat que la session de l'app, mais un stockage en mémoire, avec un Total d'Éclats fixe (#38).
 * L'ascension réelle du joueur et ses Éclats ne sont jamais lus ni écrits, même quand l'écran de
 * l'ascension met en pause et sauvegarde.
 */
export async function openBoardAscent(
  saved: Ascent | null,
  shards?: number,
): Promise<AscentSession> {
  const keyValueStore = new InMemoryKeyValueStore();
  if (saved !== null) {
    await keyValueStore.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: saved, battle: null }),
    );
  }
  if (shards !== undefined) {
    await keyValueStore.set(
      SHARD_TOTAL_KEY,
      JSON.stringify({ version: 1, total: shards, seed: null, awarded: [] }),
    );
  }
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
