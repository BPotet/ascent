/**
 * « La page d'un ennemi » (#283), règles du domaine et contenu des pages : la page d'une entrée du
 * carnet (`enemyPage`), ses mécaniques tirées de la fiche (`pageMechanics`), lues avec les mots de la
 * page (`pageMechanicsText`), et le contenu recopié du Codex pour chaque entrée du catalogue. Les
 * découvertes viennent d'un vrai combat (`startBattle`), retouché comme le moteur l'aurait fait.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ENEMY_PAGES } from '../../src/adapters/ui/format/codex/enemyPages';
import { pageMechanicsText } from '../../src/adapters/ui/format/enemyPageText';
import { battleImage } from '../../src/adapters/ui/pixelArt/sprites/battle/battleCharacters';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import { ENEMIES, type EnemyKind } from '../../src/domain/battle/combatants';
import { withEnemyAt } from '../../src/domain/battle/testing/withEnemyAt';
import { battleDiscoveries } from '../../src/domain/discoveryBook/battleDiscoveries';
import { BESTIARY_CATALOG, catalogKinds } from '../../src/domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  recordDiscoveries,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import { enemyPage, pageMechanics, type EnemyPage } from '../../src/domain/discoveryBook/enemyPage';

/** Les 6 ennemis de #246, déjà dans le jeu : leur page est écrite par cette story. */
const ENEMIES_OF_246: readonly EnemyKind[] = [
  'candleBearer',
  'cryptRat',
  'emberPod',
  'thievingMoth',
  'bronzeRam',
  'bellClapper',
];

interface World {
  book: DiscoveryBook;
}

let world: World;

/** Un combat contre `kind` seul, maudit ou non, jusqu'à sa chute : le carnet enregistre tout. */
function defeat(kind: EnemyKind, cursed?: number): void {
  const battle: Battle = startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    enemies: [kind],
    ...(cursed !== undefined && { cursed }),
  }).battle;
  if (cursed !== undefined) expect(battle.enemies[0]!.cursed).toBe(true);
  const fallen = withEnemyAt(battle, 0, { hp: 0 });
  const discoveries = [
    ...battleDiscoveries(null, battle, []),
    ...battleDiscoveries(battle, fallen, [{ type: 'enemyDefeated', at: 1, enemy: 0 }]),
  ];
  world.book = recordDiscoveries(world.book, discoveries).book;
}

const filled = (kind: EnemyKind): Extract<EnemyPage, { state: 'defeated' }> => {
  const page = enemyPage(world.book, kind);
  if (page?.state !== 'defeated') throw new Error(`The page of ${kind} is not filled`);
  return page;
};

const steps: StepDefinitions = ({ given, then, and }) => {
  given(/^un Squelette vaincu$/u, () => {
    world = { book: EMPTY_DISCOVERY_BOOK };
    defeat('skeleton');
  });

  then(/^sa page dit « Se relève seul » parmi ses mécaniques$/u, () => {
    const page = filled('skeleton');
    expect(page.mechanics).toEqual(['selfRevive']);
    expect(pageMechanicsText(page).map(({ label }) => label)).toEqual(['Se relève seul']);
  });

  given(/^un Embrasé vaincu en étant maudit$/u, () => {
    defeat('burningHusk', 0);
  });

  then(/^sa page ne dit rien de « maudit »$/u, () => {
    const page = filled('burningHusk');
    // Les mécaniques sont celles de la fiche, et seulement elles : l'Embrasé n'en a aucune.
    expect(page.mechanics).toEqual(pageMechanics(ENEMIES.burningHusk));
    expect(page.mechanics).toEqual([]);
    const said = JSON.stringify([page, pageMechanicsText(page), ENEMY_PAGES.burningHusk]);
    expect(said).not.toMatch(/maudit|curse/iu);
  });

  given(/^la version installée$/u, () => {
    world = {
      book: {
        ...EMPTY_DISCOVERY_BOOK,
        enemies: Object.fromEntries(
          catalogKinds(BESTIARY_CATALOG).map((kind) => [kind, { state: 'defeated' }]),
        ),
      },
    };
  });

  then(
    /^chacun des (\d+) ennemis du jeu a une page avec son image, son histoire, ses mécaniques et ses coups$/u,
    (count: string) => {
      const kinds = catalogKinds(BESTIARY_CATALOG);
      expect(kinds).toHaveLength(Number(count));
      kinds.forEach((kind) => {
        const page = filled(kind);
        const text = ENEMY_PAGES[kind];
        expect(battleImage(kind).rows).toHaveLength(battleImage(kind).h);
        expect(text.lore).not.toBe('');
        expect(Object.keys(text.mechanics)).toEqual(page.mechanics);
        expect(text.phases.map(({ moves }) => moves.length)).toEqual(
          page.phases.map(({ moves }) => moves.length),
        );
        expect(page.phases.flatMap(({ moves }) => moves).length).toBeGreaterThan(0);
      });
    },
  );

  and(
    /^ils se répartissent en (\d+) entrées au palier 1, (\d+) au palier 2 et (\d+) au palier 3, les 6 ennemis de #246 compris$/u,
    (first: string, second: string, third: string) => {
      const tiers = ([1, 2, 3] as const).map(
        (tier) =>
          catalogKinds(BESTIARY_CATALOG).filter((kind) => filled(kind).tier === tier).length,
      );
      expect(tiers).toEqual([Number(first), Number(second), Number(third)]);
      const kinds = catalogKinds(BESTIARY_CATALOG);
      ENEMIES_OF_246.forEach((kind) => expect(kinds).toContain(kind));
    },
  );

  and(/^chacun des ennemis de #246 déjà dans le jeu a la sienne$/u, () => {
    ENEMIES_OF_246.forEach((kind) => {
      expect(filled(kind).kind).toBe(kind);
      expect(ENEMY_PAGES[kind].lore).not.toBe('');
    });
    // Un ennemi jamais vu n'a pas de page : ce sont des pages du jeu, pas du carnet du joueur.
    expect(enemyPage(EMPTY_DISCOVERY_BOOK, 'cryptRat')).toBeNull();
  });
};

// Les scénarios `@domain` seuls.
const feature = loadFeature('features/page-d-un-ennemi.feature');
const ofDomain = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@domain');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofDomain),
      scenarioOutlines: feature.scenarioOutlines.filter(ofDomain),
    },
  ],
  [steps],
);
