/**
 * « Le journal raconte mes combats, appui par appui » (#197) à travers la session d'ascension, le
 * vrai enregistreur du journal et le vrai stockage des journaux, sur un Stockage clé-valeur en
 * mémoire ; le Menu de partage est simulé et garde le fichier. Chaque combat d'étage est commencé
 * par la session et joué appui par appui sur l'horloge de combat manuelle.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { BattleSession } from '../../src/application/useCases/BattleSession';
import { TIERS } from '../../src/domain/ascent/tiers';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { beginAscentLog, type AscentLogV1 } from '../../src/domain/ascentLog/AscentLog';
import type {
  BattleLog,
  DefensePressRecord,
  StrikePressRecord,
  WhiffRecord,
} from '../../src/domain/ascentLog/BattleLog';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMY_INITIATIVE } from '../../src/domain/battle/combatants';
import { LOG_DAY, lastExport, logStory, reopened, type LogStory } from '../support/ascentLogStory';
import {
  actionsOf,
  ascentFacing,
  effectTypesOf,
  exportedBattle,
  exportedLog,
  facing,
  fight,
  pressesOf,
  type FightPlan,
} from '../support/battleLogStory';
import { settleStore } from '../support/tiersStory';

let story: LogStory;
let battleSession: BattleSession;
let events: BattleEvent[];

const happened =
  (type: BattleEvent['type'], times = 1) =>
  (_: unknown, seen: readonly BattleEvent[]) =>
    seen.filter((event) => event.type === type).length >= times;

/** Le combat de l'étage, commencé ou repris par une nouvelle session de combat (l'écran remonté). */
async function mountBattle(): Promise<void> {
  battleSession = story.session.battleSession();
  battleSession.subscribe((snapshot) => events.push(...snapshot.events));
  await battleSession.start();
}

/** Le combat d'étage contre `enemies`, commencé par la session. */
async function startFight(...args: Parameters<typeof ascentFacing>): Promise<void> {
  await facing(story, ascentFacing(...args));
  events = [];
  await mountBattle();
}

/** La pause : le combat est sauvegardé, et son écran démonté. */
function pause(): void {
  story.session.pause();
  battleSession.dispose();
}

async function exportLog(): Promise<BattleLog> {
  await story.logExport.export();
  return exportedBattle(story);
}

const strikesOf = (battle: BattleLog) =>
  pressesOf(battle).filter((press): press is StrikePressRecord => press.kind === 'strike');
const defensesOf = (battle: BattleLog) =>
  pressesOf(battle).filter((press): press is DefensePressRecord => press.kind === 'defense');
const whiffsOf = (battle: BattleLog) =>
  pressesOf(battle).filter((press): press is WhiffRecord => press.kind === 'whiff');

const attackOnly: FightPlan['hero'] = () => ({ kind: 'attack' });

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^l'app installée depuis le build de preview$/u, () => {
    story = logStory();
  });

  when(/^(?:que )?j'exporte le journal$/u, async () => {
    await story.logExport.export();
  });

  // --- La parade parfaite ---

  given(/^un combat d'étage contre un ennemi qui annonce l'intention Attaque$/u, async () => {
    await startFight(['ghoul']);
    expect(battleSession.current()!.battle.enemies[0]!.intent?.category).toBe('attack');
  });

  when(/^je touche « Parade » 40 ms avant l'impact$/u, async () => {
    await fight(story, battleSession, {
      hero: attackOnly,
      defend: () => [['parry', -40]],
      until: happened('blowResolved'),
    });
  });

  then(/^l'action de cet ennemi porte son intention tirée$/u, () => {
    const battle = exportedBattle(story);
    const round = battle.rounds.find((each) => each.actions.some((action) => action.actor === 0))!;
    const action = round.actions.find((each) => each.actor === 0)!;
    expect(round.intents[0]).toMatchObject({ category: 'attack', attack: action.attack!.attack });
    expect(action.kind).toBe('attack');
  });

  and(/^l'appui est noté avec l'écart −40 ms et le jugement « parade parfaite »$/u, () => {
    expect(defensesOf(exportedBattle(story))[0]).toMatchObject({
      button: 'parry',
      enemy: 0,
      index: 0,
      delta: -40,
      judgement: 'perfectParry',
    });
  });

  // --- Les frappes en rythme ---

  given(/^un combat d'étage$/u, async () => {
    await startFight(['fallenKnight'], { kind: 'elite', hp: 400 });
  });

  when(
    /^je fais trois frappes en rythme : « Frapper » 20 ms après l'impact, 120 ms avant l'impact, puis aucun appui$/u,
    async () => {
      await fight(story, battleSession, {
        hero: attackOnly,
        strike: (count) => [20, -120, null][count] ?? null,
        until: happened('strikeResolved', 3),
      });
    },
  );

  then(
    /^les trois frappes sont notées « frappe parfaite » \(\+20 ms\), « bonne frappe » \(−120 ms\) et « sans bonus » \(sans appui\)$/u,
    () => {
      expect(strikesOf(exportedBattle(story)).map((each) => [each.judgement, each.delta])).toEqual([
        ['perfect', 20],
        ['good', -120],
        [null, null],
      ]);
    },
  );

  and(/^les dégâts infligés en PV et en garde sont notés pour chacune$/u, () => {
    const resolved = events.filter((event) => event.type === 'strikeResolved');
    expect(strikesOf(exportedBattle(story)).map((each) => [each.damage, each.guardDamage])).toEqual(
      resolved.map((event) => [event.damage, event.guardDamage]),
    );
  });

  // --- Les appuis ratés ---

  let whiffed = false;
  let emptied = false;
  when(/^je touche « Parade » 200 ms avant un impact$/u, async () => {
    whiffed = false;
    emptied = false;
    await fight(story, battleSession, {
      hero: attackOnly,
      defend: () => {
        if (whiffed) return [];
        whiffed = true;
        return [['parry', -200]];
      },
      until: happened('whiffed'),
    });
  });

  and(
    /^que, plus tard, hors déséquilibre, je touche « Esquive » sans impact à juger$/u,
    async () => {
      await fight(story, battleSession, {
        hero: attackOnly,
        stepIn: (_, battle) => {
          if (emptied || battle.offBalanceUntil !== null) return null;
          emptied = true;
          return 'dodge';
        },
        until: happened('whiffed', 2),
      });
      // Jusqu'à la sauvegarde qui suit.
      await fight(story, battleSession, { hero: attackOnly, until: happened('blowResolved', 3) });
      await story.logExport.export();
    },
  );

  then(
    /^le journal note un appui raté « trop tôt » avec l'écart −200 ms, et un appui raté « dans le vide » sans écart$/u,
    () => {
      expect(whiffsOf(exportedBattle(story))).toEqual([
        {
          kind: 'whiff',
          t: expect.any(Number) as number,
          button: 'parry',
          delta: -200,
          judgement: 'early',
        },
        {
          kind: 'whiff',
          t: expect.any(Number) as number,
          button: 'dodge',
          delta: null,
          judgement: 'empty',
        },
      ]);
    },
  );

  and(/^le coup subi qui suit est noté avec ses dégâts$/u, () => {
    const action = actionsOf(exportedBattle(story)).find((each) =>
      each.presses.some((press) => press.kind === 'whiff' && press.judgement === 'early'),
    )!;
    const whiff = action.presses.findIndex((press) => press.kind === 'whiff');
    expect(action.presses[whiff + 1]).toMatchObject({
      kind: 'defense',
      judgement: 'suffered',
      delta: null,
      damage: expect.any(Number) as number,
    });
    expect((action.presses[whiff + 1] as DefensePressRecord).damage).toBeGreaterThan(0);
  });

  // --- Les appuis ignorés ---

  given(/^le héros en déséquilibre après un appui raté$/u, async () => {
    await startFight(['ghoul'], { hp: 400 });
    await fight(story, battleSession, {
      hero: attackOnly,
      defend: () => [['parry', -300]],
      until: happened('whiffed'),
    });
    expect(battleSession.current()!.battle.offBalanceUntil).not.toBeNull();
  });

  when(/^je touche « Parade » pendant le déséquilibre$/u, async () => {
    battleSession.pressDefense('parry', story.battleClock.now() + 10);
    expect(events.at(-2)).toMatchObject({ type: 'pressIgnored', reason: 'offBalance' });
    await fight(story, battleSession, { hero: attackOnly, until: happened('blowResolved') });
  });

  then(/^le journal compte un appui ignoré, avec sa cause « déséquilibre »$/u, async () => {
    const battle = await exportLog();
    expect(battle.rounds.flatMap((round) => round.ignored)).toContainEqual({
      button: 'parry',
      reason: 'offBalance',
      count: 1,
    });
  });

  // --- Le combat de bout en bout ---

  given(
    /^un combat d'étage contre un boss du palier 2, qui change de phase et invoque des ennemis$/u,
    async () => {
      await startFight(['mothQueen', 'brambleBurner', 'ashBramble', 'necromancer'], {
        tier: 2,
        kind: 'boss',
        hp: 900,
        battleSeed: 1,
      });
    },
  );

  when(/^je le gagne et que j'exporte le journal$/u, async () => {
    await fight(story, battleSession, {
      strike: () => 0,
      // Les parades parfaites contre-attaquent ; les coups laissés passer usent le Rempart, font
      // saigner et brûler.
      defend: ({ battle, count }) =>
        battle.hero.bulwark || count % 4 === 3 ? [] : [['parry', -40]],
    });
    expect(battleSession.current()!.battle.phase).toMatchObject({
      kind: 'over',
      outcome: 'victory',
    });
    await story.logExport.export();
  });

  then(
    /^le combat contient les ennemis avec leur palier et leurs PV, garde, Initiative et multiplicateur de palier au début$/u,
    () => {
      const battle = exportedBattle(story);
      expect(battle).toMatchObject({
        tier: 2,
        floor: 6,
        encounterKind: 'boss',
        status: 'won',
        // Le boss n'est jamais multiplié ; ses invoqués ont les valeurs du palier.
        tierMultiplier: null,
        summonMultiplier: TIERS[2].multiplier,
        reserve: ['necromancer'],
      });
      expect(battle.enemies.map((enemy) => [enemy.kind, enemy.tier, enemy.initiative])).toEqual(
        (['mothQueen', 'brambleBurner', 'ashBramble'] as const).map((kind) => [
          kind,
          2,
          ENEMY_INITIATIVE[kind],
        ]),
      );
      for (const enemy of battle.enemies) {
        expect(enemy.hp).toBe(enemy.maxHp);
        expect(enemy.guard).toBe(enemy.maxGuard);
      }
    },
  );

  and(/^chaque manche, dans l'ordre d'action, avec les actions du héros et des ennemis$/u, () => {
    const battle = exportedBattle(story);
    expect(battle.rounds.map((round) => round.round)).toEqual(
      battle.rounds.map((_, index) => index + 1),
    );
    for (const round of battle.rounds) {
      const places = round.actions.map((action) => round.order.indexOf(action.actor));
      expect(places.every((place) => place >= 0)).toBe(true);
      expect([...places].sort((left, right) => left - right)).toEqual(places);
    }
    const actors = new Set(actionsOf(battle).map((action) => typeof action.actor));
    expect(actors).toEqual(new Set(['string', 'number']));
  });

  and(/^le changement de phase, l'invocation et les renforts$/u, () => {
    const types = effectTypesOf(exportedBattle(story));
    for (const type of [
      'bossPhaseShifted',
      'summonCalled',
      'summonEntered',
      'reinforcementEntered',
    ]) {
      expect(types).toContain(type);
    }
  });

  and(
    /^les cassures de garde, les ennemis étourdis, les actions perdues, les contre-attaques, les ripostes du Rempart, le Saignement, la Brûlure, les pouvoirs utilisés, les ennemis vaincus et ceux qui se relèvent seuls$/u,
    () => {
      const battle = exportedBattle(story);
      const types = effectTypesOf(battle);
      for (const type of [
        'guardBroken',
        'actionLost',
        'counterAttacked',
        'bulwarkWorn',
        'bulwarkCountered',
        'heroBleeding',
        'bleedTicked',
        'heroBurning',
        'burnTicked',
        'powerUsed',
        'enemyDefeated',
        'enemySelfRevived',
      ]) {
        expect(types).toContain(type);
      }
      expect(actionsOf(battle).some((action) => action.kind === 'lostAction')).toBe(true);
      expect(actionsOf(battle).some((action) => action.kind === 'power')).toBe(true);
    },
  );

  and(/^la durée de chaque manche et du combat$/u, () => {
    const battle = exportedBattle(story);
    const durations = battle.rounds.map((round) => round.durationMs);
    expect(durations.every((duration) => duration !== null && duration > 0)).toBe(true);
    const total = durations.reduce<number>((sum, duration) => sum + duration!, 0);
    expect(battle.elapsedMs).toBe(battle.rounds[0]!.t + total);
  });

  // --- Les durées hors pause ---

  let after = 0;
  given(/^une manche commencée depuis 5 s$/u, async () => {
    await startFight(['necromancer'], { hp: 400 });
    expect(battleSession.current()!.battle).toMatchObject({ round: 1, phase: { kind: 'hero' } });
    story.battleClock.advanceBy(5_000);
  });

  when(/^j'ouvre la feuille de l'Équipement pendant 30 s, puis la ferme$/u, async () => {
    // La feuille de l'Équipement ouverte en combat met le combat en pause, comme « Pause » (#159).
    pause();
    story.battleClock.advanceBy(30_000);
    await mountBattle();
  });

  and(/^(?:que )?la manche finit 4 s plus tard$/u, async () => {
    const resumedAt = story.battleClock.now();
    // Le héros joue 2,5 s après la reprise ; l'ennemi, ensuite, ferme la manche.
    story.battleClock.advanceBy(2_500);
    await fight(story, battleSession, { hero: attackOnly, until: happened('roundStarted', 2) });
    after =
      events.find((event) => event.type === 'roundStarted' && event.round === 2)!.at - resumedAt;
    // Jusqu'à la sauvegarde qui suit.
    await fight(story, battleSession, { hero: attackOnly, until: happened('heroPhaseStarted', 2) });
  });

  then(/^la durée de la manche notée est d'environ 9 s, sans les 30 s de pause$/u, async () => {
    const battle = await exportLog();
    expect(after).toBeGreaterThanOrEqual(3_500);
    expect(after).toBeLessThan(4_500);
    expect(battle.rounds[0]!.durationMs).toBe(5_000 + after);
    expect(battle.resumes).toEqual([{ t: 5_000, cause: 'pause' }]);
  });

  // --- La fermeture forcée ---

  let judged: DefensePressRecord;
  let written: BattleLog;
  given(/^un combat en cours, sauvegardé après un impact jugé$/u, async () => {
    await startFight(['ghoul'], { hp: 400 });
    await fight(story, battleSession, {
      hero: attackOnly,
      defend: () => [['parry', -40]],
      until: happened('blowResolved'),
    });
    await story.recorder.settled();
    written = JSON.parse(story.store.values.get('ascent.log.1.battle.1-3')!) as BattleLog;
    judged = defensesOf(written)[0]!;
    expect(judged).toMatchObject({ judgement: 'perfectParry' });
  });

  when(/^l'app est fermée de force, puis rouverte, et que je reprends l'ascension$/u, async () => {
    // L'app est tuée : plus rien ne tourne ni n'est sauvegardé. Rouverte, son horloge de combat
    // repart d'une autre base.
    battleSession.dispose();
    story = await reopened(story);
    events = [];
    await mountBattle();
    await fight(story, battleSession, { defend: () => [['parry', -40]], strike: () => 0 });
    await story.logExport.export();
  });

  then(/^le journal garde les appuis et les actions jusqu'à la dernière sauvegarde$/u, () => {
    const battle = exportedBattle(story);
    expect(defensesOf(battle)).toContainEqual(judged);
    expect(battle.status).toBe('won');
  });

  and(/^l'impact déjà jugé n'est noté qu'une fois$/u, () => {
    const same = defensesOf(exportedBattle(story)).filter(
      (press) =>
        press.enemy === judged.enemy && press.index === judged.index && press.t === judged.t,
    );
    expect(same).toHaveLength(1);
    const keys = defensesOf(exportedBattle(story)).map(
      (press) => `${press.t}:${press.enemy}:${press.index}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  and(/^la reprise est notée dans le combat, qui continue dans le même journal$/u, () => {
    expect(lastExport(story).ascentCount).toBe(1);
    expect(exportedLog(story).battles).toHaveLength(1);
    expect(exportedBattle(story).resumes).toEqual([
      { t: expect.any(Number) as number, cause: 'reopen' },
    ]);
  });

  and(/^le temps passé app fermée ne compte pas dans les durées$/u, () => {
    const battle = exportedBattle(story);
    // Le temps repart du dernier instant écrit, sans le temps passé app fermée.
    expect(battle.resumes[0]!.t).toBe(written.elapsedMs);
    const times = battle.rounds.map((round) => round.t);
    expect([...times].sort((left, right) => left - right)).toEqual(times);
  });

  // --- La version du format ---

  let old: AscentLogV1;
  given(
    /^des journaux d'ascension écrits avant cette story, sans détail des combats$/u,
    async () => {
      const { battles: _, ...body } = beginAscentLog(startAscent(9), LOG_DAY);
      const { id } = await story.logStore.start(beginAscentLog(startAscent(9), LOG_DAY), 20);
      old = {
        ...body,
        id,
        formatVersion: 1,
        status: 'ended',
        end: { kind: 'abandon', tier: 1, floor: 1 },
      };
      story.store.values.set(`ascent.log.${id}`, JSON.stringify(old));
    },
  );

  when(/^j'installe cette version, joue une ascension et exporte le journal$/u, async () => {
    await startFight(['ghoul'], { hp: 400 });
    await fight(story, battleSession, { defend: () => [['parry', -40]], strike: () => 0 });
    await story.logExport.export();
  });

  then(/^le fichier porte la nouvelle version du format$/u, () => {
    expect(lastExport(story).formatVersion).toBe(2);
    expect(exportedLog(story)).toMatchObject({ formatVersion: 2, battles: [{ status: 'won' }] });
  });

  and(
    /^les anciens journaux y figurent encore, avec leur parcours et sans détail des combats, marqués de leur version du format$/u,
    () => {
      const [first] = lastExport(story).ascents;
      expect(first).toEqual(old);
      expect(first).not.toHaveProperty('battles');
    },
  );

  // --- Aucun ralentissement ---

  let writesInUpdates = 0;
  when(/^je joue des parades et des frappes en rythme$/u, async () => {
    const key = 'ascent.log.1.battle.1-3';
    // L'écriture du combat ne répond pas pendant tout le combat.
    story.store.hold(key);
    const set = story.store.set;
    let inUpdate = false;
    writesInUpdates = 0;
    story.store.set = (written, value) => {
      if (inUpdate && written === key) writesInUpdates += 1;
      return set(written, value);
    };
    const press = battleSession.pressDefense.bind(battleSession);
    battleSession.pressDefense = (button, at) => {
      inUpdate = true;
      press(button, at);
      inUpdate = false;
    };
    await fight(story, battleSession, {
      strike: (count) => [0, -90, 45, null][count % 4] ?? null,
      defend: ({ count }) => [[count % 2 === 0 ? 'parry' : 'dodge', [-40, 100, -10][count % 3]!]],
    });
    story.store.release(key);
    await story.logExport.export();
  });

  then(/^l'écart noté de chaque appui est celui que le moteur a jugé$/u, () => {
    const judgedByEngine = events.flatMap((event): [string | null, number | null][] => {
      if (event.type === 'strikeResolved') return [[event.judgement, event.delta]];
      if (event.type === 'blowResolved') return [[event.outcome, event.delta]];
      if (event.type === 'whiffed') return [[event.reason, event.delta ?? null]];
      return [];
    });
    expect(pressesOf(exportedBattle(story)).map((press) => [press.judgement, press.delta])).toEqual(
      judgedByEngine,
    );
  });

  and(
    /^le combat, ses sons et ses animations ne marquent aucun arrêt quand le journal s'écrit$/u,
    () => {
      expect(battleSession.current()!.battle.phase.kind).toBe('over');
      expect(writesInUpdates).toBe(0);
    },
  );

  // --- Partage annulé ---

  let closeMenu: () => void = () => undefined;
  let storedBefore: Map<string, string>;
  given(/^le menu de partage ouvert par « Exporter le journal »$/u, async () => {
    await startFight(['ghoul'], { hp: 400 });
    await fight(story, battleSession, {
      defend: () => [['parry', -40]],
      until: happened('blowResolved'),
    });
    pause();
    story.share.share.mockImplementationOnce(
      (file) =>
        new Promise<void>((resolve) => {
          story.shared.push(file);
          closeMenu = resolve;
        }),
    );
    void story.logExport.export();
    for (let wait = 0; wait < 50 && story.shared.length === 0; wait += 1) await settleStore();
    expect(story.share.share).toHaveBeenCalledTimes(1);
    storedBefore = new Map(story.store.values);
  });

  when(/^je le ferme sans choisir d'application$/u, async () => {
    closeMenu();
    await settleStore();
  });

  then(/^le journal, combats compris, est inchangé et peut être exporté de nouveau$/u, async () => {
    expect(new Map(story.store.values)).toEqual(storedBefore);
    await story.logExport.export();
    expect(story.shared).toHaveLength(2);
    expect(story.shared[1]!.contents).toBe(story.shared[0]!.contents);
    expect(exportedBattle(story).rounds.length).toBeGreaterThan(0);
  });
};

const feature = loadFeature('features/journal-des-combats.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => !tags.includes('@ui');
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
