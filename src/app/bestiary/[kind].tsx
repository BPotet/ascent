import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { EnemyPageScreen } from '../../adapters/ui/screens/EnemyPageScreen';
import { useDependencies } from '../../adapters/ui/state/Dependencies';
import { sharedDiscoveryBookSession } from '../ascent';

/** Revenir au carnet : en arrière, ou au carnet pour une page ouverte sans lui dessous. */
function back(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/book');
  }
}

function EnemyPage() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const { keyValueStore } = useDependencies();
  const book = sharedDiscoveryBookSession(keyValueStore);
  // Une page que le carnet ne peut pas montrer (carnet pas lu, entrée inconnue ou hors du jeu).
  const [shown] = useState(() => book.page(kind) !== null);
  useEffect(() => {
    if (!shown) back();
  }, [shown]);
  if (!shown) return null;
  return <EnemyPageScreen book={book} kind={kind} onBack={back} />;
}

/**
 * La page d'un ennemi (#283, D12), poussée sur le carnet depuis une case du Bestiaire, dans le build
 * de preview seulement, comme le carnet (ADR 0030, D11).
 */
export default function EnemyPageRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <EnemyPage />;
}
