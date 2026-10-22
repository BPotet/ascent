import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Une graisse par import : seules les polices utilisées entrent dans l'app.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SystemClock } from '../adapters/device/clock/SystemClock';
import { loadFonts } from '../adapters/device/fonts/loadFonts';
import { ExpoHaptics } from '../adapters/device/haptics/ExpoHaptics';
import { appStateVisibility } from '../adapters/device/lifecycle/appStateVisibility';
import { openAscentDatabase } from '../adapters/persistence/sqlite/openAscentDatabase';
import { SqliteKeyValueStore } from '../adapters/persistence/sqlite/SqliteKeyValueStore';
import { SqliteUnitOfWork } from '../adapters/persistence/sqlite/SqliteUnitOfWork';
import { introduceWeeklyTarget } from '../application/useCases/introduceWeeklyTarget';
import { StartupErrorScreen, StartupLoadingScreen } from '../adapters/ui/screens/StartupScreen';
import { type Dependencies, DependenciesProvider } from '../adapters/ui/state/Dependencies';
import { colors } from '../adapters/ui/theme/colors';
import { fonts } from '../adapters/ui/theme/typography';

type Startup =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly dependencies: Dependencies };

// Stryker disable all: apparence de la navigation, vérifiée par la conformité aux maquettes.
const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
} as const;
// Racine des gestes : elle occupe tout l'écran, sans quoi l'app s'afficherait vide.
const gestureRootStyle = { flex: 1, backgroundColor: colors.background } as const;
// Stryker restore all

/**
 * Ouvre la base locale et charge les polices (sans elles, la police système s'affiche), puis fait le
 * changement d'introduction de l'objectif hebdomadaire (#24), avant l'interface : rejoué sans
 * risque à chaque démarrage, il n'écrit plus rien une fois fait. Un échec fait proposer
 * « Réessayer ».
 */
async function start(): Promise<Dependencies> {
  // Les fichiers des polices livrées avec l'app, sous les noms qu'utilise l'interface.
  const fontFiles = {
    [fonts.soraSemiBold]: Sora_600SemiBold,
    [fonts.soraBold]: Sora_700Bold,
    [fonts.interRegular]: Inter_400Regular,
    [fonts.interMedium]: Inter_500Medium,
    [fonts.interSemiBold]: Inter_600SemiBold,
  };
  const [db] = await Promise.all([openAscentDatabase(), loadFonts(fontFiles)]);
  const dependencies: Dependencies = {
    // L'heure du téléphone, relue au retour au premier plan.
    clock: new SystemClock(undefined, appStateVisibility()),
    unitOfWork: new SqliteUnitOfWork(db),
    keyValueStore: new SqliteKeyValueStore(db),
    // La vibration légère d'un gain d'expérience ; silencieuse sur un téléphone sans vibreur.
    haptics: new ExpoHaptics(),
  };
  await introduceWeeklyTarget(dependencies);
  return dependencies;
}

/**
 * Assemblage : ouvre la base locale et charge les polices, puis branche les adaptateurs sur les
 * ports de l'interface. Tout est sur le téléphone : le démarrage ne dépend pas du réseau.
 */
export default function RootLayout() {
  const [startup, setStartup] = useState<Startup>({ status: 'loading' });
  const loading = startup.status === 'loading';

  useEffect(() => {
    if (!loading) {
      return;
    }
    start().then(
      (dependencies) => setStartup({ status: 'ready', dependencies }),
      () => setStartup({ status: 'failed' }),
    );
  }, [loading]);

  return (
    <GestureHandlerRootView style={gestureRootStyle}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {startup.status === 'loading' && <StartupLoadingScreen />}
        {startup.status === 'failed' && (
          <StartupErrorScreen onRetry={() => setStartup({ status: 'loading' })} />
        )}
        {startup.status === 'ready' && (
          <DependenciesProvider value={startup.dependencies}>
            <Stack screenOptions={screenOptions} />
          </DependenciesProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
