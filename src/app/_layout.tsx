import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Une graisse par import : seules les polices utilisées entrent dans l'app.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans/700Bold';
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
import { introduceTargetBonus } from '../application/useCases/introduceTargetBonus';
import { introduceWeeklyTarget } from '../application/useCases/introduceWeeklyTarget';
import { StartupErrorScreen, StartupLoadingScreen } from '../adapters/ui/screens/StartupScreen';
import { type Dependencies, DependenciesProvider } from '../adapters/ui/state/Dependencies';
import { artPalette } from '../adapters/ui/pixelArt/artPalette';
import { pixelFont, textFont } from '../adapters/ui/pixelArt/pixelTypography';
import { fonts } from '../adapters/ui/theme/typography';

type Startup =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly dependencies: Dependencies };

// Stryker disable all: apparence de la navigation, vérifiée par la conformité aux maquettes.
const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: artPalette.roles.night },
} as const;
// Racine des gestes : elle occupe tout l'écran, sans quoi l'app s'afficherait vide.
const gestureRootStyle = { flex: 1, backgroundColor: artPalette.roles.night } as const;
// Stryker restore all

// Les fichiers des polices livrées avec l'app, sous les noms qu'utilise l'interface : la police
// pixel, la police de texte, et Sora pour les écrans que #73 n'a pas encore redessinés.
const fontFiles = {
  [pixelFont]: PixelifySans_700Bold,
  [textFont.regular]: Inter_400Regular,
  [textFont.medium]: Inter_500Medium,
  [textFont.semiBold]: Inter_600SemiBold,
  [textFont.bold]: Inter_700Bold,
  [fonts.soraSemiBold]: Sora_600SemiBold,
  [fonts.soraBold]: Sora_700Bold,
};

/**
 * Ouvre la base locale et attend les polices (`fonts`, chargées à part : sans elles, la police
 * système s'affiche), puis fait le changement d'introduction de l'objectif hebdomadaire (#24), puis
 * le rattrapage de la prime d'objectif (#26), dans cet ordre et avant l'interface : rejoués sans
 * risque à chaque démarrage, ils n'écrivent plus rien une fois faits, et le rattrapage n'accorde
 * jamais deux fois. Un échec fait proposer « Réessayer ».
 */
async function start(fontsLoading: Promise<boolean>): Promise<Dependencies> {
  const [db] = await Promise.all([openAscentDatabase(), fontsLoading]);
  const dependencies: Dependencies = {
    // L'heure du téléphone, relue au retour au premier plan.
    clock: new SystemClock(undefined, appStateVisibility()),
    unitOfWork: new SqliteUnitOfWork(db),
    keyValueStore: new SqliteKeyValueStore(db),
    // La vibration légère d'un gain d'expérience ; silencieuse sur un téléphone sans vibreur.
    haptics: new ExpoHaptics(),
  };
  await introduceWeeklyTarget(dependencies);
  await introduceTargetBonus(dependencies);
  return dependencies;
}

/**
 * Assemblage : ouvre la base locale et charge les polices, puis branche les adaptateurs sur les
 * ports de l'interface. Tout est sur le téléphone : le démarrage ne dépend pas du réseau.
 */
export default function RootLayout() {
  const [startup, setStartup] = useState<Startup>({ status: 'loading' });
  const loading = startup.status === 'loading';
  // Les polices se chargent une fois, à part : le titre du démarrage n'apparaît qu'ensuite, qu'elles
  // aient pu être chargées ou non, jamais d'abord dans la police du système.
  const [fontsLoading] = useState(() => loadFonts(fontFiles));
  const [fontsSettled, setFontsSettled] = useState(false);

  useEffect(() => {
    void fontsLoading.then(() => setFontsSettled(true));
  }, [fontsLoading]);

  useEffect(() => {
    if (!loading) {
      return;
    }
    start(fontsLoading).then(
      (dependencies) => setStartup({ status: 'ready', dependencies }),
      () => setStartup({ status: 'failed' }),
    );
  }, [loading, fontsLoading]);

  return (
    <GestureHandlerRootView style={gestureRootStyle}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {startup.status === 'loading' && <StartupLoadingScreen titleShown={fontsSettled} />}
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
