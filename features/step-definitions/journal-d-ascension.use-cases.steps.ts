/**
 * « Exporter le journal du parcours de mes ascensions » (#196) à travers la session d'ascension, le
 * vrai enregistreur du journal et le vrai stockage des journaux, sur un Stockage clé-valeur en
 * mémoire ; le Menu de partage est simulé et garde le fichier.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { blessingRarities } from '../../src/domain/ascent/blessings';
import { shardSum } from '../../src/domain/ascent/shards';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { FloorRecord } from '../../src/domain/ascentLog/AscentLog';
import { beginAscentLog } from '../../src/domain/ascentLog/AscentLog';
import { Day } from '../../src/domain/day/Day';
import { startBattle } from '../../src/domain/battle/Battle';
import {
  LOG_DAY,
  climb,
  lastExport,
  logStory,
  savedWithLog,
  type LogStory,
} from '../support/ascentLogStory';
import { playToTheEnd, settleStore } from '../support/tiersStory';

let story: LogStory;
let summit: Ascent;
let seed: number;

const ascentOf = (exported: ReturnType<typeof lastExport>, ascentSeed: number) =>
  exported.ascents.filter((log) => log.ascentSeed === ascentSeed);

const floorKey = (floor: FloorRecord) => `${floor.tier}-${floor.floor}`;

/** Une graine dont la première offre de bénédiction propose `family`. */
function seedOffering(family: string): number {
  for (let candidate = 1; candidate < 500; candidate += 1) {
    if (startAscent(candidate, { blessings: ['rare'] }).blessingOffer?.includes(family as never)) {
      return candidate;
    }
  }
  throw new Error(`no seed offers ${family}`);
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^l'app installée depuis le build de preview$/u, () => {
    story = logStory();
  });

  // --- Le parcours ---

  given(/^une ascension terminée au Sommet$/u, async () => {
    const start = startAscent(3, { hero: 'wanderer', gauge: 2, blessings: ['epic', 'rare'] });
    const climbed = climb(start);
    expect(climbed.ascent.outcome).toBe('victory');
    summit = climbed.ascent;
    const started = await story.logStore.start(climbed.log, 20);
    await story.logStore.save({ ...climbed.log, id: started.id });
  });

  when(/^j'exporte le journal$/u, async () => {
    await story.logExport.export();
  });

  then(
    /^son journal contient la date, la graine de l'ascension, le héros, l'état de la Jauge et l'équipement de base$/u,
    () => {
      expect(lastExport(story).ascents[0]).toMatchObject({
        startedOn: '2026-11-03',
        ascentSeed: 3,
        hero: 'wanderer',
        gauge: 'fullFavor',
        startingEquipment: { weapon: null, armor: null, accessory: null },
      });
    },
  );

  and(
    /^les bénédictions de départ proposées et choisies, par leur famille et leur rareté$/u,
    () => {
      const { blessings } = lastExport(story).ascents[0]!;
      expect(blessings.map((each) => each.chosen.rarity)).toEqual(['epic', 'rare']);
      for (const blessing of blessings) {
        expect(blessing.offered).toContain(blessing.chosen.family);
      }
    },
  );

  and(
    /^pour chaque étage : son numéro, son palier, les sorties proposées, la sortie prise, les PV et l'Élan du héros à l'entrée et à la sortie$/u,
    () => {
      const { floors } = lastExport(story).ascents[0]!;
      expect(floors.map(floorKey)).toEqual(
        [1, 2, 3].flatMap((tier) => [1, 2, 3, 4, 5, 6].map((floor) => `${tier}-${floor}`)),
      );
      for (const floor of floors) {
        expect(floor.exit).not.toBeNull();
        if (floor.floor === 1) {
          expect(floor.exitTaken).toBeNull();
        } else {
          expect(floor.exitsOffered).toContainEqual(
            expect.objectContaining({ kind: floor.exitTaken!.kind }),
          );
        }
        const momentum = floor.encounter === null ? null : expect.any(Number);
        expect(floor.entry).toEqual({
          hp: expect.any(Number),
          maxHp: expect.any(Number),
          momentum,
        });
        expect(floor.exit).toEqual({ hp: expect.any(Number), maxHp: expect.any(Number), momentum });
      }
    },
  );

  and(
    /^l'Or gagné, les bienfaits proposés et choisis, les objets trouvés et s'ils ont été équipés ou laissés, les Éclats gagnés$/u,
    () => {
      const { floors } = lastExport(story).ascents[0]!;
      expect(floors.some((floor) => floor.gold > 0)).toBe(true);
      expect(floors.some((floor) => floor.boonChosen !== null)).toBe(true);
      for (const floor of floors) {
        if (floor.boonChosen !== null) expect(floor.boonsOffered).toContain(floor.boonChosen);
        if (floor.itemFound !== null) expect(floor.itemOutcome).toBe('equipped');
      }
      expect(floors.reduce((sum, floor) => sum + floor.shards, 0)).toBe(
        shardSum(summit.shardAwards),
      );
    },
  );

  and(/^chaque passage de palier$/u, () => {
    expect(lastExport(story).ascents[0]!.tierPassages.map(({ from, to }) => [from, to])).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  and(/^la fin « Sommet »$/u, () => {
    expect(lastExport(story).ascents[0]).toMatchObject({
      status: 'ended',
      end: { kind: 'summit', tier: 3, floor: 6 },
    });
  });

  // --- Les bénédictions ---

  given(
    /^une ascension commencée avec une bénédiction de départ « Vigueur » Rare, venue de l'habitude « Me faire à manger »$/u,
    () => {
      seed = seedOffering('vigor');
      story = logStory(undefined, [seed]);
      const rarities = blessingRarities([
        { name: 'Me faire à manger', difficulty: 'medium', createdOn: Day.of(2026, 10, 1) },
      ]);
      const ascent = story.session.begin({ gauge: 1, blessings: rarities });
      story.session.chooseBlessing(ascent.blessingOffer!.indexOf('vigor'));
    },
  );

  then(/^le fichier contient la famille « Vigueur » et la rareté « Rare »$/u, () => {
    expect(lastExport(story).ascents[0]!.blessings).toEqual([
      { offered: expect.any(Array), chosen: { family: 'vigor', rarity: 'rare' } },
    ]);
  });

  and(
    /^le fichier ne contient ni le nom d'une habitude, ni un suivi, ni l'expérience du personnage$/u,
    () => {
      const contents = story.shared.at(-1)!.contents;
      expect(contents).not.toMatch(/manger|habit|checkIn|experience|"xp"/iu);
    },
  );

  // --- L'abandon ---

  given(/^une ascension abandonnée à l'étage 2 du palier 1, après confirmation$/u, async () => {
    const climbed = climb(startAscent(3), (ascent) => ascent.floor === 2);
    await savedWithLog(story, climbed.ascent, climbed.log);
    await story.session.load();
    story.session.abandon();
  });

  when(/^je touche « Exporter le journal » sur l'écran de fin de l'ascension$/u, async () => {
    await story.logExport.export();
  });

  then(
    /^le journal de cette ascension indique la fin « abandon », l'étage 2 et le palier 1$/u,
    () => {
      expect(lastExport(story).ascents.at(-1)).toMatchObject({
        status: 'ended',
        end: { kind: 'abandon', tier: 1, floor: 2 },
      });
    },
  );

  // --- Les 20 dernières ---

  given(/^20 ascensions déjà gardées dans le journal$/u, async () => {
    story = logStory(undefined, [21]);
    for (let each = 1; each <= 20; each += 1) {
      const log = beginAscentLog(startAscent(each), LOG_DAY);
      await story.logStore.start(
        { ...log, status: 'ended', end: { kind: 'abandon', tier: 1, floor: 1 } },
        20,
      );
    }
  });

  when(/^je commence une 21ᵉ ascension$/u, () => {
    story.session.begin();
  });

  then(/^la plus ancienne des 20 est effacée$/u, async () => {
    await story.logExport.export();
    expect(lastExport(story).ascents.map((log) => log.ascentSeed)).not.toContain(1);
  });

  and(/^l'export contient exactement 20 ascensions, dont celle qui vient de commencer$/u, () => {
    const exported = lastExport(story);
    expect(exported.ascentCount).toBe(20);
    expect(exported.ascents.map((log) => log.ascentSeed)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 2),
    );
    expect(exported.ascents.at(-1)).toMatchObject({ ascentSeed: 21, status: 'inProgress' });
  });

  // --- La fermeture forcée ---

  let beforeClose: Ascent;
  given(/^une ascension en cours, sauvegardée pendant un combat à l'étage 3$/u, async () => {
    const climbed = climb(
      startAscent(3),
      (ascent) => ascent.floor === 3,
      (ascent) => ascent.exits.findIndex((exit) => exit.kind !== 'campfire'),
    );
    beforeClose = climbed.ascent;
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      heroHp: 50,
      enemies: beforeClose.encounter!.enemies,
    });
    const nearlyWon = { ...battle, enemies: [{ ...battle.enemies[0]!, hp: 1 }], reserve: [] };
    await savedWithLog(story, beforeClose, climbed.log, nearlyWon);
  });

  when(/^l'app est fermée de force, puis rouverte$/u, async () => {
    story = logStory(story.store);
    await story.session.load();
    expect(story.session.resuming()).toBe(true);
  });

  and(/^je reprends l'ascension et la termine$/u, async () => {
    await playToTheEnd(story.session.battleSession(), story.battleClock);
    await settleStore();
    if (story.session.current()!.boonOffer !== null) story.session.chooseBoon(0);
    story.session.chooseExit(0);
    story.session.abandon();
  });

  then(
    /^son journal garde tout le parcours jusqu'à la dernière sauvegarde, puis le continue sans trou ni doublon d'étage$/u,
    async () => {
      await story.logExport.export();
      const [log] = ascentOf(lastExport(story), beforeClose.seed);
      expect(log!.floors.map(floorKey)).toEqual(['1-1', '1-2', '1-3', '1-4']);
      expect(log!.floors[2]!.exit).not.toBeNull();
      expect(log!.end).toMatchObject({ kind: 'abandon', floor: 4 });
    },
  );

  and(/^l'export ne contient qu'un seul journal pour cette ascension$/u, () => {
    expect(ascentOf(lastExport(story), beforeClose.seed)).toHaveLength(1);
    expect(lastExport(story).ascentCount).toBe(1);
  });
};

const feature = loadFeature('features/journal-d-ascension.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
