/**
 * Scénarios `@session` de « Coffre scellé, clés et Fortune » (#226) : une vraie session
 * d'ascension, sur un stockage clé-valeur en mémoire, avec son Journal d'ascension. Fermer
 * l'application, c'est ouvrir une nouvelle session sur le même stockage ; la jauge d'aujourd'hui
 * n'entre jamais dans l'ascension en cours.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import {
  endFloorBattle,
  leaveItem,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../src/domain/ascent/Ascent';
import { beginAscentLog } from '../../src/domain/ascentLog/AscentLog';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import {
  LOG_DAY,
  lastExport,
  logStory,
  reopened,
  savedWithLog,
  type LogStory,
} from '../support/ascentLogStory';
import { settleStore } from '../support/tiersStory';

const ELITE: Encounter = { kind: 'elite', enemies: ['twins'], battleSeed: 1 };

/** L'Élite gagnée à l'étage `floor`, avec `keys` clés, son objet garanti laissé. */
const afterElite = (ascent: Ascent, floor: number, keys: number): Ascent =>
  leaveItem(
    endFloorBattle(
      { ...ascent, floor, encounter: ELITE, keys, boonOffer: null, exits: [] },
      { outcome: 'victory', heroHp: ascent.hero.hp },
    ),
  );

let story: LogStory;
let opened: Ascent;
let todayGauge: FateGauge;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- La reprise (CH10) ---

  given(/^le joueur a ouvert un coffre scellé et voit l'objet révélé$/u, async () => {
    story = logStory();
    await savedWithLog(story, afterElite(startAscent(7, { gauge: 2 }), 3, 2));
    story = await reopened(story);
    story.session.openSealedChest();
    await settleStore();
    opened = story.session.current()!;
    expect(opened).toMatchObject({ keys: 1, sealedChest: { opened: true } });
  });

  when(/^il ferme l'application et reprend l'ascension$/u, async () => {
    story = await reopened(story);
  });

  then(/^il retrouve le même objet, et le même nombre de clés$/u, () => {
    expect(story.session.current()).toEqual(opened);
  });

  and(
    /^un coffre scellé encore fermé à la fermeture est toujours en attente à la reprise$/u,
    async () => {
      const closed = logStory();
      await savedWithLog(closed, afterElite(startAscent(7, { gauge: 2 }), 3, 2));
      const resumed = await reopened(closed);
      expect(resumed.session.current()).toMatchObject({
        keys: 2,
        foundItem: null,
        sealedChest: { opened: false },
      });
    },
  );

  // --- Les paliers et les reprises (K4) ---

  given(/^une ascension lancée hier avec une jauge de \+1, où il reste 1 clé$/u, async () => {
    story = logStory();
    const begun = startAscent(7, { gauge: 1 });
    await savedWithLog(story, {
      ...begun,
      encounter: null,
      passage: { to: 2, step: 'announce' },
      keys: 1,
    });
  });

  and(/^la jauge d'aujourd'hui vaut −2$/u, () => {
    todayGauge = -2;
  });

  when(/^le joueur reprend l'ascension et passe au palier suivant$/u, async () => {
    story = await reopened(story);
    expect(story.session.current()!.gauge).not.toBe(todayGauge);
    story.session.enterNextTier();
  });

  then(/^le héros a toujours 1 clé$/u, () => {
    expect(story.session.current()).toMatchObject({ tier: 2, gauge: 1, keys: 1 });
  });

  // --- Le journal d'ascension ---

  given(
    /^une ascension lancée avec 1 clé, où un coffre scellé a été ouvert et un autre est resté fermé faute de clé$/u,
    async () => {
      story = logStory();
      const begun = startAscent(7, { gauge: 1 });
      const first = afterElite(begun, 3, 1);
      await savedWithLog(story, first, beginAscentLog(begun, LOG_DAY));
      story = await reopened(story);
      story.session.openSealedChest();
      opened = story.session.current()!;
      story.session.leaveItem();
      story.session.chooseBoon(0);
      await settleStore();
      const second = afterElite(story.session.current()!, 4, 0);
      story.store.values.set(
        ASCENT_KEY,
        JSON.stringify({ version: 1, ascent: second, battle: null }),
      );
      story = await reopened(story);
      story.session.leaveSealedChest();
      await settleStore();
      await story.logExport.export();
    },
  );

  then(/^le journal d'ascension note la clé reçue au lancement$/u, () => {
    expect(lastExport(story).ascents[0]!.keys).toEqual({ favor: 1, fortune: 0 });
  });

  and(
    /^pour chaque coffre scellé, son issue : ouvert avec son objet, laissé, ou fermé faute de clé$/u,
    () => {
      const floors = lastExport(story).ascents[0]!.floors;
      expect(floors.find((floor) => floor.floor === 3)!.sealedChest).toEqual({
        outcome: 'opened',
        item: opened.foundItem,
        itemOutcome: 'left',
      });
      expect(floors.find((floor) => floor.floor === 4)!.sealedChest).toEqual({ outcome: 'noKey' });
    },
  );

  and(/^il ne contient aucune donnée des habitudes$/u, () => {
    const json = JSON.stringify(lastExport(story).ascents[0]);
    for (const word of ['habit', 'checkIn', 'xp']) expect(json).not.toContain(word);
  });
};

const feature = loadFeature('features/coffre-scelle-cles-fortune.feature');
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
