/**
 * Les règles du domaine de « L'Invocation de la Reine des phalènes » (#172), sans écran : le boss du
 * palier 2, l'annonce et l'entrée des Phalénides, leurs valeurs du palier, une seule Invocation,
 * le coup fatal, les places libres (règle 6), les tombés remplacés (règle 7) et les tirages.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  acknowledgeBossVictory,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  enterNextTier,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import { drawGroup } from '../../src/domain/ascent/enemyGroup';
import { drawBoss } from '../../src/domain/ascent/rewards';
import { TIERS, type Tier } from '../../src/domain/ascent/tiers';
import { nextRoundOrder, pendingSummon, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES } from '../../src/domain/battle/combatants';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import {
  happened,
  playToEntry,
  playUntil,
  queenAt,
  summonBattle,
  typesOf,
  withEnemy,
  type Played,
} from '../support/summonStory';

const SEEDS = Array.from({ length: 400 }, (_, index) => index * 2_654_435_761 + 11);

interface World {
  ascent: Ascent;
  battle: Battle;
  events: BattleEvent[];
  entered: Played;
}

let world: World;

const won = (ascent: Ascent) => {
  const ended = endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
  return ended.boonOffer === null ? ended : chooseBoon(ended, 0);
};

function toBoss(ascent: Ascent): Ascent {
  let current = ascent;
  while (current.encounter?.kind !== 'boss') {
    current = current.encounter === null ? chooseExit(current, 0) : won(current);
  }
  return current;
}

function play(done: (events: readonly BattleEvent[]) => boolean): void {
  const played = playUntil(world.battle, done);
  world.battle = played.battle;
  world.events = [...world.events, ...played.events];
}

/** Les dégâts des intentions d'attaque tirées par les Phalénides entrées, sur plusieurs graines. */
function mothkinDamages(tier: Tier): number[] {
  const damages = new Set<number>();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const battle = { ...summonBattle(['mothQueen'], tier), random: seedRandom(seed) };
    const { entered } = playToEntry(queenAt(battle, 205));
    for (const { intent } of entered.battle.enemies.slice(1)) {
      if (intent?.category === 'attack') damages.add(intent.damage);
    }
  }
  return [...damages].sort((left, right) => left - right);
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  when(/^le joueur atteint l'étage 6 du palier 2$/u, () => {
    let ascent = startAscent(3);
    while (ascent.tier < 2) ascent = enterNextTier(acknowledgeBossVictory(won(toBoss(ascent))));
    world = { ...world, ascent: toBoss(ascent) };
  });

  then(
    /^le boss est la Jardinière des cendres ou la Reine des phalènes, tirées à égalité avec la graine de l'ascension$/u,
    () => {
      expect(['ashGardener', 'mothQueen']).toContain(world.ascent.encounter!.enemies[0]);
      const drawn = SEEDS.map((seed) => drawBoss(seedRandom(seed), TIERS[2].bosses).value);
      expect(new Set(drawn)).toEqual(new Set(['ashGardener', 'mothQueen']));
      expect(drawn.filter((boss) => boss === 'mothQueen').length / drawn.length).toBeCloseTo(
        0.5,
        1,
      );
    },
  );

  given(/^la Reine des phalènes \(400 PV\) seule en combat$/u, () => {
    world = { ...world, battle: summonBattle(), events: [] };
    expect(world.battle.enemies).toHaveLength(1);
    expect(world.battle.enemies[0]).toMatchObject({ kind: 'mothQueen', hp: 400 });
  });

  when(/^ses PV passent à 200 ou moins$/u, () => {
    world.battle = queenAt(world.battle, 205);
    play(happened('summonCalled'));
  });

  then(
    /^sa garde revient à son maximum, son Initiative passe à 11 et sa Flamme de la lampe s'ajoute$/u,
    () => {
      expect(world.battle.enemies[0]).toMatchObject({ phase2: true, guard: 70 });
      expect(ENEMIES.mothQueen.phase2Initiative).toBe(11);
      expect(ENEMIES.mothQueen.phase2Moves).toEqual([{ attack: 'perilous', damage: 19 }]);
    },
  );

  and(/^l'annonce « Elle appelle les Phalénides » s'affiche$/u, () => {
    const called = world.events.filter((event) => event.type === 'summonCalled');
    expect(called).toEqual([expect.objectContaining({ enemy: 0, kind: 'mothkin' })]);
  });

  and(
    /^deux tas de poussière apparaissent à sa droite, aux deux places libres de la première ligne$/u,
    () => {
      expect(pendingSummon(world.battle)).toEqual({ summoner: 0, kind: 'mothkin', slots: [1, 2] });
    },
  );

  and(
    /^au début de la manche suivante, avant le calcul de l'ordre d'action, deux Phalénides en sortent, dans la première ligne$/u,
    () => {
      world.events = [];
      play(happened('roundStarted'));
      const types = typesOf(world.events);
      const round = types.indexOf('roundStarted');
      expect(types.slice(round - 2, round + 1)).toEqual([
        'summonEntered',
        'summonEntered',
        'roundStarted',
      ]);
      expect(world.battle.enemies.map((enemy) => enemy.kind)).toEqual([
        'mothQueen',
        'mothkin',
        'mothkin',
      ]);
      expect(world.battle.turn.order).toEqual([0, 1, 2, 'hero']);
    },
  );

  given(/^la manche où la Reine change de phase$/u, () => {
    world = { ...world, battle: queenAt(summonBattle(), 205), events: [] };
    play(happened('summonCalled'));
  });

  when(/^cette manche se termine$/u, () => {
    play(happened('roundStarted'));
  });

  then(/^aucune Phalénide invoquée n'a agi$/u, () => {
    const entry = typesOf(world.events).indexOf('summonEntered');
    const acted = world.events
      .slice(0, entry)
      .some((event) => event.type === 'stepInStarted' && event.enemy > 0);
    expect(acted).toBe(false);
  });

  and(
    /^dès la manche suivante, chacune tire son intention et agit à son Initiative, comme les autres ennemis$/u,
    () => {
      expect(world.battle.enemies[1]!.intent).not.toBeNull();
      expect(world.battle.enemies[2]!.intent).not.toBeNull();
      world.events = [];
      play((events) => events.some((event) => event.type === 'stepInStarted' && event.enemy === 2));
      const steppedIn = world.events.flatMap((event) =>
        event.type === 'stepInStarted' ? [event.enemy] : [],
      );
      expect(steppedIn.slice(0, 3)).toEqual([0, 1, 2]);
    },
  );

  given(/^deux Phalénides invoquées au palier 2$/u, () => {
    world = { ...world, entered: playToEntry(queenAt(summonBattle(), 205)).entered };
  });

  then(/^chacune a 33 PV et 15 de garde$/u, () => {
    for (const mothkin of world.entered.battle.enemies.slice(1)) {
      expect(mothkin).toMatchObject({ kind: 'mothkin', summoned: true, maxHp: 33, maxGuard: 15 });
    }
  });

  and(/^son Vol brisé fait 5, ses Mandibules 4 \+ 4$/u, () => {
    expect(mothkinDamages(2)).toEqual([4, 5]);
  });

  given(/^une Phalénide invoquée qui tombe avant la Reine$/u, () => {
    const { entered } = playToEntry(queenAt(summonBattle(), 205));
    world = { ...world, battle: withEnemy(entered.battle, 1, { hp: 0 }), events: [] };
  });

  when(/^la manche suivante commence$/u, () => {
    play(happened('roundStarted'));
  });

  then(/^elle ne revient pas et la Reine n'en appelle pas d'autre$/u, () => {
    expect(world.battle.enemies[1]).toMatchObject({ kind: 'mothkin', hp: 0 });
    expect(typesOf(world.events)).not.toContain('summonCalled');
    expect(typesOf(world.events)).not.toContain('summonEntered');
  });

  given(/^la Reine déjà en phase 2$/u, () => {
    const { entered } = playToEntry(queenAt(summonBattle(), 205));
    world = { ...world, battle: entered.battle, events: [] };
    expect(world.battle.enemies[0]!.phase2).toBe(true);
  });

  when(/^ses PV baissent encore$/u, () => {
    world.battle = queenAt(world.battle, 100);
    play(happened('strikeResolved'));
  });

  then(/^elle n'invoque plus rien$/u, () => {
    expect(world.battle.enemies[0]!.hp).toBeLessThan(100);
    expect(typesOf(world.events)).not.toContain('summonCalled');
    expect(pendingSummon(world.battle)).toBeNull();
  });

  given(/^la Reine à 210 PV$/u, () => {
    world = { ...world, battle: queenAt(summonBattle(), 210), events: [] };
  });

  when(/^un coup lui retire 210 PV ou plus$/u, () => {
    // Un coup du héros fait 10 PV : la Reine à 5 PV reçoit un coup plus fort que ses PV.
    world.battle = queenAt(world.battle, 5);
    play(happened('battleEnded'));
  });

  then(/^elle tombe sans invoquer, et le combat est gagné$/u, () => {
    expect(world.battle.enemies[0]!.hp).toBe(0);
    expect(typesOf(world.events)).not.toContain('summonCalled');
    expect(world.battle.phase).toMatchObject({ kind: 'over', outcome: 'victory' });
  });

  given(
    /^un boss dont la phase 2 invoque, et une première ligne de 3 ennemis tous debout$/u,
    () => {
      const battle = queenAt(summonBattle(['mothQueen', 'ghoul', 'ghoul']), 205);
      world = { ...world, battle, events: [] };
    },
  );

  when(/^ses PV passent sous le seuil de son changement de phase$/u, () => {
    play(happened('bossPhaseShifted'));
  });

  then(/^il change de phase \(garde, Initiative, nouveaux coups\) mais n'invoque rien$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ phase2: true, guard: 70 });
    expect(typesOf(world.events)).not.toContain('summonCalled');
  });

  and(
    /^il n'y a ni annonce d'Invocation, ni poussière, ni portrait en pointillé dans la Frise d'action$/u,
    () => {
      expect(pendingSummon(world.battle)).toBeNull();
      expect(nextRoundOrder(world.battle)).toEqual([0, 'hero', 1, 2]);
    },
  );

  and(/^il agit selon l'intention qu'il a tirée$/u, () => {
    world.events = [];
    play(happened('roundStarted'));
    const intent = world.battle.enemies[0]!.intent;
    world.events = [];
    play((events) => events.some((event) => event.type === 'windUpStarted' && event.enemy === 0));
    const windUp = world.events.find((event) => event.type === 'windUpStarted');
    expect(intent?.category).toBe('attack');
    expect(windUp).toMatchObject({ attack: intent?.category === 'attack' ? intent.attack : null });
  });

  given(
    /^un boss dont la phase 2 invoque deux ennemis, dans une première ligne où les deux autres places sont occupées par des ennemis tombés$/u,
    () => {
      const battle = queenAt(summonBattle(['mothQueen', 'ghoul', 'ghoul']), 205);
      world = {
        ...world,
        battle: withEnemy(withEnemy(battle, 1, { hp: 0 }), 2, { hp: 0 }),
        events: [],
      };
    },
  );

  given(
    /^un boss dont la phase 2 invoque deux ennemis, et une seule place libre dans la première ligne$/u,
    () => {
      const battle = queenAt(summonBattle(['mothQueen', 'ghoul', 'ghoul']), 205);
      world = { ...world, battle: withEnemy(battle, 2, { hp: 0 }), events: [] };
    },
  );

  when(/^il change de phase$/u, () => {
    play(happened('summonCalled'));
  });

  then(/^la poussière de l'Invocation recouvre les places des deux ennemis tombés$/u, () => {
    expect(pendingSummon(world.battle)?.slots).toEqual([1, 2]);
  });

  and(/^les ennemis invoqués y entrent au début de la manche suivante$/u, () => {
    play(happened('roundStarted'));
    expect(world.battle.enemies.map((enemy) => [enemy.kind, enemy.summoned])).toEqual([
      ['mothQueen', undefined],
      ['mothkin', true],
      ['mothkin', true],
    ]);
  });

  and(/^les ennemis tombés remplacés ne peuvent plus être relevés$/u, () => {
    expect(world.battle.enemies.some((enemy) => enemy.kind === 'ghoul')).toBe(false);
    expect(typesOf(world.events)).not.toContain('allyRaised');
  });

  then(/^un seul ennemi invoqué entre, à cette place$/u, () => {
    expect(pendingSummon(world.battle)?.slots).toEqual([2]);
    play(happened('roundStarted'));
    expect(world.events.filter((event) => event.type === 'summonEntered')).toEqual([
      expect.objectContaining({ enemy: 2, kind: 'mothkin' }),
    ]);
  });

  given(/^un combat de boss$/u, () => {
    world = { ...world, battle: summonBattle() };
  });

  then(/^il n'y a ni Nécromancien ni Glaneuse de cendre pour relever une Phalénide$/u, () => {
    for (const tier of [1, 2, 3] as const) {
      for (const boss of TIERS[tier].bosses) expect(ENEMIES[boss].supports).toBe(false);
    }
    expect(world.battle.enemies.map((enemy) => enemy.kind)).toEqual(['mothQueen']);
    expect(ENEMIES.mothkin.supports).toBe(false);
  });

  given(/^un groupe tiré au palier 2$/u, () => {
    world = { ...world, events: [] };
  });

  then(/^il peut compter jusqu'à 2 Phalénides \(poids 3\)$/u, () => {
    expect(TIERS[2].enemies).toContainEqual({ kind: 'mothkin', weight: 3, cap: 2 });
    const counts = SEEDS.map(
      (seed) => drawGroup(4, seedRandom(seed), 2).value.filter((kind) => kind === 'mothkin').length,
    );
    expect(Math.max(...counts)).toBe(2);
  });

  and(/^le palier 3 n'en tire plus \(#214\)$/u, () => {
    expect(TIERS[3].enemies.map(({ kind }) => kind)).not.toContain('mothkin');
    for (const size of [3, 4]) {
      for (const seed of SEEDS)
        expect(drawGroup(size, seedRandom(seed), 3).value).not.toContain('mothkin');
    }
  });
};

const feature = loadFeature('features/invocation-reine-des-phalenes.feature');
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
