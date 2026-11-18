import { Redirect, router, useIsFocused } from 'expo-router';

import { currentBuildChannel } from '../adapters/device/build/buildChannel';
import { DiscoveryBookScreen } from '../adapters/ui/screens/DiscoveryBookScreen';
import { useCamp } from '../adapters/ui/state/useCamp';
import { useDependencies } from '../adapters/ui/state/Dependencies';
import { sharedAscentSession, sharedCampSession, sharedDiscoveryBookSession } from './ascent';

/** Quitter le carnet : toujours vers le pied de la tour ; le geste retour suit la pile. */
function leave(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/tower');
  }
}

function Book() {
  const { keyValueStore, clock, unitOfWork } = useDependencies();
  const focused = useIsFocused();
  const ascent = sharedAscentSession(keyValueStore, clock).current();
  // Les objets à débloquer achetés au Camp (#284, D8), `null` tant qu'il n'est pas lu.
  const camp = useCamp(sharedCampSession(keyValueStore, clock, unitOfWork));
  return (
    <DiscoveryBookScreen
      book={sharedDiscoveryBookSession(keyValueStore)}
      // Le palier de l'ascension en cours, s'il y en a une (D8).
      currentTier={ascent !== null && ascent.outcome === null ? ascent.tier : null}
      onLeave={leave}
      focused={focused}
      boughtItems={camp.status === 'ready' ? camp.boughtItems : null}
      onOpenEntry={(kind) => router.push({ pathname: '/bestiary/[kind]', params: { kind } })}
    />
  );
}

/**
 * Le carnet de découvertes (#282), ouvert depuis le pied de la tour, dans le build de preview
 * seulement, comme toute la tour (D11). Une case vaincue ou rencontrée y pousse la page de son
 * ennemi (#283).
 */
export default function BookRoute() {
  if (currentBuildChannel() !== 'preview') return <Redirect href="/" />;
  return <Book />;
}
