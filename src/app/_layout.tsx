import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SystemClock } from '../adapters/device/clock/SystemClock';
import { openAscentDatabase } from '../adapters/persistence/sqlite/openAscentDatabase';
import { StartupErrorScreen, StartupLoadingScreen } from '../adapters/ui/screens/StartupScreen';
import { type Dependencies, DependenciesProvider } from '../adapters/ui/state/Dependencies';
import { colors } from '../adapters/ui/theme/colors';

type Startup =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly dependencies: Dependencies };

// Stryker disable all: apparence de la navigation, vérifiée par la conformité aux maquettes.
const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
} as const;
// Stryker restore all

/** Assemblage : ouvre la base locale, puis branche les adaptateurs sur les ports de l'interface. */
export default function RootLayout() {
  const [startup, setStartup] = useState<Startup>({ status: 'loading' });
  const loading = startup.status === 'loading';

  useEffect(() => {
    if (!loading) {
      return;
    }
    openAscentDatabase().then(
      () => setStartup({ status: 'ready', dependencies: { clock: new SystemClock() } }),
      () => setStartup({ status: 'failed' }),
    );
  }, [loading]);

  return (
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
  );
}
