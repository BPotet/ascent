/**
 * « Le Beffroi, le Balayage et la Charge » (#266) par l'interface : un combat du palier 3 joué par
 * le domaine, puis ce que l'écran en montre et en dit, la vue du combat (`battleView`), l'état
 * d'affichage (`displayOf`), les annonces au lecteur d'écran (`announcementsFor`), la colonne de
 * l'ennemi (`EnemyColumn`) et le trait de balayage (`SweepStroke`, `SweepTrail`).
 */
import { cleanup, render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { StyleSheet } from 'react-native';

import { EnemyColumn } from '../../src/adapters/ui/battle/EnemyColumn';
import { sceneGeometry } from '../../src/adapters/ui/battle/scene/sceneGeometry';
import { glintSprites } from '../../src/adapters/ui/battle/scene/sceneEffects';
import { SweepTrail } from '../../src/adapters/ui/battle/SweepStroke';
import { announcementsFor } from '../../src/adapters/ui/format/battleText';
import { effectsAtlas } from '../../src/adapters/ui/pixelArt/sprites/battle/battleEffects';
import { battleView } from '../../src/adapters/ui/state/battleView';
import { INITIAL_DISPLAY, displayOf } from '../../src/adapters/ui/state/useBattleDisplay';
import { pressDefense, startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { glintsOf } from '../../src/domain/battle/glints';
import { nextRandom, seedRandom } from '../../src/domain/battle/SeededRandom';
import {
  BELFRY,
  blowOf,
  chargingRam,
  happened,
  playUntil,
  pressAt,
  ramBattle,
  roundStarted,
  stepOf,
  sweepWindUp,
  weakened,
} from '../support/belfryStory';

interface World {
  battle: Battle;
  events: readonly BattleEvent[];
  seed: number;
  before: Battle;
}

let world = {} as World;

const hiddenToo = { includeHiddenElements: true } as const;
/** Les apostrophes droites du scénario et les apostrophes typographiques de l'écran se valent. */
const plain = (text: string) => text.replaceAll('’', "'");
const typesOf = (events: readonly BattleEvent[]) => events.map((event) => event.type);

/** Ce que l'écran écrit sur la scène pour les événements du monde. */
function wordsOf(battle: Battle, events: readonly BattleEvent[]) {
  const display = displayOf(
    INITIAL_DISPLAY,
    { battle, events, heroHint: false, powersHint: false },
    false,
  );
  return (display.feedback?.texts ?? []).map(({ title, sub }) => ({
    title,
    sub: plain(sub ?? ''),
  }));
}

/** Les trois tirages d'une graine, consommés. */
const threeDraws = (seed: number) =>
  nextRandom(nextRandom(nextRandom(seedRandom(seed)).state).state).state;

async function renderClapper(battle: Battle, reducedMotion: boolean) {
  const view = battleView(battle);
  await render(
    <EnemyColumn
      view={view.enemies[0]!}
      index={0}
      slot={sceneGeometry(412, 440, 1).enemies[0]!}
      sealed={view.sealed === 0}
      swept={view.swept === 0}
      reducedMotion={reducedMotion}
      float={null}
      uiNow={() => 0}
      now={() => 0}
      onTarget={jest.fn()}
    />,
  );
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Le Balayage ---

  given(/^la Sentinelle face au Grand balayage de 10 d'un Battant de cloche$/u, () => {
    world = { battle: sweepWindUp() } as World;
  });

  when(/^elle esquive dans la fenêtre de parade$/u, () => {
    const { battle, events } = pressAt(world.battle, 'dodge', 0);
    world = { ...world, battle, events };
  });

  then(/^l'esquive échoue : elle subit 9 dégâts$/u, () => {
    expect(blowOf(world.events)).toMatchObject({ outcome: 'sweepDodge', damage: 9 });
  });

  and(/^elle est en déséquilibre pendant 450 ms$/u, () => {
    const started = world.events.find(
      (event): event is Extract<BattleEvent, { type: 'offBalanceStarted' }> =>
        event.type === 'offBalanceStarted',
    )!;
    expect(started.until - started.at).toBe(450);
    expect(battleView(world.battle).pad).toMatchObject({ kind: 'defense', offBalance: true });
  });

  and(/^le mot de scène « (.+) » s'affiche, avec le sous-titre « (.+) »$/u, (title, sub) => {
    expect(wordsOf(world.battle, world.events)).toEqual([{ title, sub }]);
  });

  given(/^un Battant de cloche qui tire un Grand balayage$/u, () => {
    const { battle } = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      enemies: ['bellClapper'],
      tierMultiplier: BELFRY,
    });
    const drawing: Battle = {
      ...battle,
      enemies: battle.enemies.map((enemy) => ({
        ...enemy,
        guard: 999,
        maxGuard: 999,
        intent: {
          category: 'attack',
          attack: 'sweep',
          damage: 10,
          windUpMs: 1_300,
          feintFraction: 0.5,
        },
      })),
    };
    world = { battle: drawing } as World;
  });

  then(/^son intention reste une Attaque, sans annoncer le Balayage$/u, () => {
    const view = battleView(world.battle);
    expect(view.enemies[0]!.intent).toEqual({ category: 'attack' });
    expect(view.swept).toBeNull();
  });

  when(/^sa préparation commence$/u, () => {
    const { battle, events } = playUntil(world.battle, happened('windUpStarted'));
    world = { ...world, battle, events };
  });

  then(
    /^le trait de balayage pulse au-dessus de lui et les chevrons filent au sol vers le héros jusqu'à l'impact$/u,
    async () => {
      expect(battleView(world.battle).swept).toBe(0);
      const impact = stepOf(world.battle).impacts[0]!.at;
      expect(battleView({ ...world.battle, now: impact - 1 }).swept).toBe(0);
      await renderClapper(world.battle, false);
      expect(screen.getByLabelText('Trait de balayage : parade')).toBeOnTheScreen();
      await cleanup();
      await render(<SweepTrail from={60} to={240} y={300} />);
      expect(
        within(screen.getByTestId('sweep-trail', hiddenToo)).getAllByTestId(
          /sweep-chevron-/u,
          hiddenToo,
        ),
      ).toHaveLength(7);
      await cleanup();
    },
  );

  and(/^le lecteur d'écran annonce « (.+) »$/u, (speech) => {
    expect(announcementsFor(world.events, world.battle).map(plain)).toContain(speech);
  });

  and(/^150 ms avant l'impact, son reflet est un trait horizontal cyan$/u, () => {
    const step = stepOf(world.battle);
    const [glint] = glintsOf(step);
    expect(glint).toEqual({ at: step.impacts[0]!.at - 150, kind: 'sweep', impact: 0 });
    expect(glintSprites([glint!], glint!.at, { eye: [10, 12], tips: [] })).toEqual([
      { effect: 'glintSweep', frame: 0, x: 10, y: 12 },
    ]);
    expect(effectsAtlas().table.glintSweep).toBeDefined();
  });

  and(
    /^ces repères restent à tous les niveaux d'aides visuelles et en mouvement réduit$/u,
    async () => {
      await renderClapper(world.battle, true);
      expect(screen.getByLabelText('Trait de balayage : parade')).toBeOnTheScreen();
      await cleanup();
      await render(<SweepTrail from={60} to={240} y={300} reducedMotion />);
      for (const chevron of screen.getAllByTestId(/sweep-chevron-/u, hiddenToo)) {
        expect(StyleSheet.flatten(chevron.props.style)).toMatchObject({ opacity: 1 });
      }
      await cleanup();
    },
  );

  given(/^la préparation d'un Balayage$/u, () => {
    world = { battle: sweepWindUp() } as World;
  });

  then(/^la touche Esquive n'est ni grisée ni masquée$/u, () => {
    expect(battleView(world.battle).pad).toEqual({
      kind: 'defense',
      locked: false,
      lock: null,
      offBalance: false,
    });
  });

  // --- La Charge ---

  given(/^un Bélier de bronze debout, non étourdi, au début de la manche N$/u, () => {
    world = {} as World;
  });

  when(/^son tirage de coup donne le Coup de bélier$/u, () => {
    const seed = Array.from({ length: 200 }, (_, index) => index).find(
      (candidate) => nextRandom(seedRandom(candidate)).value >= 2 / 3,
    )!;
    const { battle, events } = startBattle({
      seed,
      defenseHint: false,
      at: 0,
      enemies: ['bronzeRam'],
      tierMultiplier: BELFRY,
    });
    world = { battle, events, seed } as World;
  });

  then(/^son intention est la Charge, avec le premier de ses 2 crans allumé$/u, () => {
    expect(world.battle.enemies[0]!.intent).toEqual({ category: 'charge' });
    expect(battleView(world.battle).enemies[0]!.intent).toEqual({ category: 'charge', notches: 1 });
  });

  and(/^sa marque de signature passe à « (.+) »$/u, (text) => {
    expect(battleView(world.battle).enemies[0]!.signature).toMatchObject({ text, now: true });
  });

  and(/^ses 3 tirages de la manche sont consommés$/u, () => {
    expect(world.battle.random).toBe(threeDraws(world.seed));
  });

  given(/^un Bélier de bronze dont l'intention est la Charge$/u, () => {
    world = { battle: ramBattle() } as World;
  });

  when(/^vient son action de la manche N$/u, () => {
    const { battle, events } = playUntil(world.battle, happened('chargeStarted'));
    world = { ...world, battle, events };
  });

  then(/^il charge pendant 400 ms, sans impact et sans défense possible$/u, () => {
    const { phase } = world.battle;
    expect(phase).toMatchObject({ kind: 'enemy', step: { kind: 'support', enemy: 0 } });
    const step = (phase as { readonly step: { since: number; until: number } }).step;
    expect(step.until - step.since).toBe(400);
    expect(typesOf(world.events)).not.toContain('windUpStarted');
    expect(battleView(world.battle).line?.before).toBe('Aucun coup à parer');
    const pressed = pressDefense(world.battle, { button: 'parry', at: world.battle.now + 50 });
    expect(pressed.events).toContainEqual(
      expect.objectContaining({ type: 'whiffed', reason: 'empty' }),
    );
  });

  and(/^le mot de scène « (.+) » s'affiche, avec « (.+) »$/u, (title, sub) => {
    const charged = world.events.slice(
      world.events.findIndex((event) => event.type === 'chargeStarted'),
    );
    expect(wordsOf(world.battle, charged)).toEqual([{ title, sub }]);
  });

  given(/^un Bélier de bronze qui charge depuis la manche N$/u, () => {
    const { battle } = playUntil(ramBattle(), happened('chargeStarted'));
    world = { battle, before: battle } as World;
  });

  when(/^la manche N\+1 commence$/u, () => {
    const { battle, events } = playUntil(world.battle, roundStarted(2));
    world = { ...world, battle, events };
  });

  then(
    /^il tire ses 3 valeurs comme d'habitude, mais son coup est le Coup de bélier quel que soit le tirage$/u,
    () => {
      expect(world.battle.enemies[0]!.intent).toMatchObject({
        category: 'attack',
        attack: 'delayed',
        damage: 21,
      });
      expect(world.battle.random).toBe(
        nextRandom(nextRandom(nextRandom(world.before.random).state).state).state,
      );
    },
  );

  and(/^sa marque de signature passe à « Charge 2\/2 », ses 2 crans allumés$/u, () => {
    const [ram] = battleView(world.battle).enemies;
    expect(ram!.signature).toMatchObject({ text: 'Charge 2/2', now: true });
    expect(ram!.intent).toEqual({ category: 'charge', notches: 2 });
  });

  and(
    /^à son action, le Coup de bélier est un coup retardé ordinaire, à parer ou à esquiver$/u,
    () => {
      const { battle } = playUntil(world.battle, happened('windUpStarted'));
      world = { ...world, battle };
      expect(stepOf(battle)).toMatchObject({ attack: 'delayed', charged: true });
      expect(battleView(battle)).toMatchObject({ sealed: null, swept: null });
      expect(blowOf(pressAt(battle, 'parry', 0).events)?.outcome).toBe('perfectParry');
      expect(blowOf(pressAt(battle, 'dodge', 0).events)?.outcome).toBe('dodge');
    },
  );

  and(/^après le coup, ses crans se vident et sa marque revient à « Charge »$/u, () => {
    expect(battleView(world.battle).enemies[0]!.signature).toMatchObject({ text: 'Charge 2/2' });
    const done: Battle = {
      ...world.battle,
      phase: { kind: 'hero', since: world.battle.now, announced: false },
    };
    const [ram] = battleView(done).enemies;
    expect(ram!.signature).toMatchObject({ text: 'Charge', now: false });
    expect(ram!.intent).toEqual({ category: 'attack' });
  });

  given(/^un Bélier de bronze qui charge$/u, () => {
    world = { battle: chargingRam() } as World;
  });

  when(/^sa garde tombe à 0 avant le début de la préparation de son Coup de bélier$/u, () => {
    world.before = weakened(world.battle);
    const { battle, events } = playUntil(world.before, happened('chargeBroken'));
    world = { ...world, battle, events };
  });

  then(/^la Charge est brisée : le Coup de bélier n'a pas lieu et n'est pas reporté$/u, () => {
    const { events } = playUntil(world.before, roundStarted(4));
    expect(typesOf(events)).toContain('chargeBroken');
    expect(events.some((event) => event.type === 'windUpStarted' && event.charged === true)).toBe(
      false,
    );
  });

  and(/^le Bélier est étourdi et perd son action suivante, comme après toute cassure$/u, () => {
    expect(world.battle.enemies[0]!.stun).not.toBeNull();
    const { events } = playUntil(world.before, roundStarted(3));
    expect(events).toContainEqual(expect.objectContaining({ type: 'actionLost', enemy: 0 }));
  });

  and(/^sa marque de signature passe à « Charge brisée », grisée, glyphe fêlé$/u, () => {
    expect(battleView(world.battle).enemies[0]!.signature).toMatchObject({
      text: 'Charge brisée',
      off: true,
      glyph: 'crack8',
    });
  });
};

// L'interface seule : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/beffroi-balayage-charge.feature');
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
