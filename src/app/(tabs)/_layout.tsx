import { Tabs } from 'expo-router';

import { TabBar, type TabKey } from '../../adapters/ui/components/TabBar';
import { colors } from '../../adapters/ui/theme/colors';

/** La route de chaque onglet proposé, dans l'ordre de la barre (la Vue Mois viendra plus tard). */
const ROUTES = { day: 'index', week: 'week' } as const satisfies Partial<Record<TabKey, string>>;
const TABS = Object.keys(ROUTES) as (keyof typeof ROUTES)[];

/** L'onglet de la route affichée ; la Vue Journée tant qu'aucune route n'est encore affichée. */
function tabOf(route: string | undefined): keyof typeof ROUTES {
  return route === ROUTES.week ? 'week' : 'day';
}

// Stryker disable all: apparence de la navigation, vérifiée par la conformité aux maquettes.
const screenOptions = {
  headerShown: false,
  sceneStyle: { backgroundColor: colors.background },
} as const;
// Stryker restore all

/**
 * Les vues du suivi, une par onglet : Journée et Semaine. Une vue déjà ouverte reste montée quand
 * on change d'onglet ; elles se tiennent à jour l'une l'autre par la révision du suivi.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={screenOptions}
      tabBar={({ state, navigation }) => (
        <TabBar
          tabs={TABS}
          current={tabOf(state.routes[state.index]?.name)}
          onSelect={(tab) => navigation.navigate(ROUTES[tab as keyof typeof ROUTES])}
        />
      )}
    >
      <Tabs.Screen name={ROUTES.day} />
      <Tabs.Screen name={ROUTES.week} />
    </Tabs>
  );
}
