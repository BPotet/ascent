import { router, Tabs } from 'expo-router';
import { View } from 'react-native';

import { currentBuildChannel } from '../../adapters/device/build/buildChannel';
import { TabBar, type TabKey } from '../../adapters/ui/components/TabBar';
import { TrialBattleEntry } from '../../adapters/ui/components/TrialBattleEntry';
import { artPalette } from '../../adapters/ui/pixelArt/artPalette';

/** La route de chaque onglet, dans l'ordre de la barre. */
const ROUTES = { day: 'index', week: 'week', month: 'month' } as const satisfies Record<
  TabKey,
  string
>;
const TABS = Object.keys(ROUTES) as TabKey[];

/** L'onglet de la route affichée ; la Vue Journée tant qu'aucune route n'est encore affichée. */
function tabOf(route: string | undefined): TabKey {
  return TABS.find((tab) => ROUTES[tab] === route) ?? 'day';
}

// Stryker disable all: apparence de la navigation, vérifiée par la conformité aux maquettes.
const screenOptions = {
  headerShown: false,
  sceneStyle: { backgroundColor: artPalette.roles.night },
} as const;
// Stryker restore all

/**
 * Les vues du suivi, une par onglet : Journée, Semaine et Mois. Une vue déjà ouverte reste montée quand
 * on change d'onglet ; elles se tiennent à jour l'une l'autre par la révision du suivi.
 * Dans le build de preview seulement, le point d'entrée provisoire du combat d'essai (#31) se place
 * au-dessus de la barre d'onglets, dans le flux de la mise en page.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={screenOptions}
      tabBar={({ state, navigation }) => (
        <View>
          {currentBuildChannel() === 'preview' ? (
            <TrialBattleEntry onPress={() => router.push('/trial-battle')} />
          ) : null}
          <TabBar
            tabs={TABS}
            current={tabOf(state.routes[state.index]?.name)}
            onSelect={(tab) => navigation.navigate(ROUTES[tab])}
          />
        </View>
      )}
    >
      <Tabs.Screen name={ROUTES.day} />
      <Tabs.Screen name={ROUTES.week} />
      <Tabs.Screen name={ROUTES.month} />
    </Tabs>
  );
}
