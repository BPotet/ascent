/**
 * Scénarios d'interface (`@ui`) de « L'Invocation de la Reine des phalènes » (#172) : exécutés à
 * travers l'écran de combat (`BattleScreen`), sur une vraie session de combat et l'horloge de combat
 * manuelle. Skia est simulé sous Jest : la poussière se vérifie sur ce que l'écran passe à la scène.
 */
import { act, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo } from 'react-native';

import {
  renderBattle,
  settle,
  type BattleScreenTest,
} from '../../src/adapters/ui/testing/battleScreen';
import type { BattleFactory } from '../../src/application/useCases/BattleSession';
import { TIERS } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { EnemyKind } from '../../src/domain/battle/combatants';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
const hiddenToo = { includeHiddenElements: true } as const;

interface World {
  test: BattleScreenTest;
}

let world: World;

beforeEach(() => {
  announce.mockClear();
});

/** Un combat d'étage du palier 2 contre `enemies`, le premier à `hp` PV, sa garde haute. */
function battleOf(
  enemies: readonly EnemyKind[],
  hp: number,
  change: (battle: Battle) => Battle = (battle) => battle,
): BattleFactory {
  return (options) => {
    const update = startBattle({
      ...options,
      initiative: true,
      enemies,
      summonMultiplier: TIERS[2].multiplier,
    });
    const [first, ...others] = update.battle.enemies;
    return {
      ...update,
      battle: change({ ...update.battle, enemies: [{ ...first!, hp, guard: 60 }, ...others] }),
    };
  };
}

const types = () =>
  world.test.snapshots.flatMap((snapshot) => snapshot.events.map((event) => event.type));

const announced = () => announce.mock.calls.map(([sentence]) => sentence);

async function open(factory: BattleFactory): Promise<void> {
  world = { test: await renderBattle({ seed: 1, createBattle: factory }) };
}

/** Laisse passer les rendus en cours de l'écran ouvert avant d'en ouvrir un autre. */
async function close(): Promise<void> {
  await settle();
}

/** Le héros frappe la Reine à son tour, jusqu'à l'annonce de l'Invocation. */
async function toAnnouncement(): Promise<void> {
  const { test } = world;
  await test.runUntil(() => test.battle().phase.kind === 'hero');
  await test.attack();
  await test.runUntil(() => types().includes('summonCalled'));
}

async function toEntry(): Promise<void> {
  await world.test.runUntil(() => types().includes('summonEntered'));
}

function trackLabel(): string {
  return screen.getByTestId('battle-action-track').props.accessibilityLabel as string;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^la Reine vient d'annoncer l'Invocation$/u, async () => {
    await open(battleOf(['mothQueen'], 201));
    await toAnnouncement();
  });

  then(
    /^l'aperçu « suiv\. » de la Frise d'action montre déjà les deux Phalénides, en pointillé, avec le portrait de la Phalénide$/u,
    () => {
      const pending = screen.getAllByTestId('track-entry-pending', hiddenToo);
      expect(pending).toHaveLength(2);
      for (const entry of pending) {
        expect(within(entry).getByTestId('track-portrait', hiddenToo)).toBeOnTheScreen();
      }
      expect(trackLabel()).toMatch(
        /Manche suivante : La Reine des phalènes, Phalénide, Phalénide, toi\.$/u,
      );
    },
  );

  and(
    /^au début de la manche suivante, elles entrent dans la manche en cours à leur Initiative, comme un renfort$/u,
    async () => {
      await toEntry();
      expect(screen.queryAllByTestId('track-entry-pending', hiddenToo)).toHaveLength(0);
      expect(trackLabel()).toMatch(
        /^Ordre d'action\. Manche \d+ : La Reine des phalènes, Phalénide, Phalénide, toi\./u,
      );
    },
  );

  given(/^deux Phalénides entrées par l'Invocation$/u, async () => {
    await open(battleOf(['mothQueen'], 201));
    await toAnnouncement();
    await toEntry();
  });

  then(/^le cadre de chacune porte l'étiquette « Invoquée »$/u, () => {
    const columns = screen.getAllByTestId('enemy-mothkin', hiddenToo);
    expect(columns).toHaveLength(2);
    for (const column of columns) {
      expect(within(column).getByText('Invoquée', hiddenToo)).toBeOnTheScreen();
    }
  });

  and(/^une Phalénide tirée dans un groupe ordinaire n'a pas cette étiquette$/u, async () => {
    await close();
    await open(battleOf(['ghoul', 'mothkin'], 50));
    expect(screen.getByTestId('enemy-mothkin', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryByText('Invoquée', hiddenToo)).toBeNull();
  });

  given(/^le lecteur d'écran est actif$/u, () => {
    announce.mockClear();
  });

  when(/^la Reine invoque$/u, async () => {
    await open(battleOf(['mothQueen'], 201));
    await toAnnouncement();
  });

  then(
    /^il entend « La Reine des phalènes change de phase\. Elle appelle les Phalénides : deux Phalénides entrent à la prochaine manche\. »$/u,
    () => {
      expect(announced()).toContain(
        'La Reine des phalènes change de phase. Elle appelle les Phalénides : deux Phalénides entrent à la prochaine manche.',
      );
    },
  );

  and(
    /^chaque Phalénide entrée se lit comme un ennemi : « Phalénide, invoquée, 33 PV sur 33, garde 7 sur 7, intention : attaque »$/u,
    async () => {
      await toEntry();
      const labels = screen
        .getAllByTestId('enemy-mothkin', hiddenToo)
        .map((column) => column.props.accessibilityLabel as string);
      expect(labels).toHaveLength(2);
      for (const label of labels) {
        expect(label).toMatch(/^Phalénide, invoquée, 33 PV sur 33, garde 7 sur 7, intention : /u);
      }
      expect(labels).toContain(
        'Phalénide, invoquée, 33 PV sur 33, garde 7 sur 7, intention : attaque',
      );
    },
  );

  and(
    /^à la victoire, il entend « La Reine des phalènes tombe\. Les Phalénides tombent avec elle\. »$/u,
    async () => {
      await close();
      const stunned = { actionLost: false, heroAction: 999 };
      await open(
        battleOf(['mothQueen', 'mothkin', 'mothkin'], 1, (battle) => ({
          ...battle,
          enemies: battle.enemies.map((enemy, index) =>
            index === 0
              ? { ...enemy, guard: 0, phase2: true, stun: stunned }
              : { ...enemy, summoned: true as const, stun: stunned },
          ),
        })),
      );
      const { test } = world;
      await test.runUntil(() => test.battle().phase.kind === 'hero');
      // La session de l'écran : ses annonces passent par l'écran, comme après un toucher.
      const at = test.clock.now() + 50;
      await act(async () => {
        test.clock.advanceTo(at);
        test.session.heroAction({ kind: 'attack' }, at - 20, at);
      });
      await test.runUntil(() => types().includes('battleEnded'));
      expect(announced()).toContain(
        'La Reine des phalènes tombe. Les Phalénides tombent avec elle.',
      );
    },
  );
};

const feature = loadFeature('features/invocation-reine-des-phalenes.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
