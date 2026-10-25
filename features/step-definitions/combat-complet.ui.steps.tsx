/**
 * Scénarios d'interface (`@ui`) de « Combat complet » (#32) : exécutés à travers l'écran du combat
 * d'essai (`TrialBattleScreen`), sur une vraie session de combat, l'horloge de combat manuelle,
 * une graine du combat fixée et un constructeur de combat qui pose les états des scénarios. Les
 * touchers sont simulés par Gesture Handler. La scène reste dessinée comme aujourd'hui et Skia est
 * simulé sous Jest : « à terre », « étoiles », « premier plan » et « estompés » se vérifient sur ce
 * que l'écran passe à la scène (contrat `battleView` avec #81) et sur les colonnes des ennemis.
 */
import { screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { renderTrialBattle, type TrialBattleTest } from '../../src/adapters/ui/testing/trialBattle';
import { battleView } from '../../src/adapters/ui/state/battleView';
import {
  battleWith,
  changeBattle,
  enemyWith,
  heroWith,
  roundAt,
  stunnedEnemy,
  targetOn,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import { seedFor, type FirstRound } from '../../src/application/testing/trialBattleSeeds';
import { advance, heroAction, startTrialBattle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { actionOrder } from '../../src/domain/battle/actionOrder';
import { DEFAULT_TRIAL_TUNING } from '../../src/domain/battle/TrialTuning';

jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const GHOUL = 0;
const SPECTER = 1;
const NECROMANCER = 2;
const KINDS = ['ghoul', 'specter', 'necromancer'] as const;

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

interface World {
  test: TrialBattleTest | null;
  changes: BattleChange[];
  firstRound: FirstRound;
  impact: number;
  /** L'instant où la cassure a eu lieu, et le combat qui l'a vue. */
  brokenAt: number;
}

let world: World;

beforeEach(() => {
  announce.mockClear();
  world = { test: null, changes: [], firstRound: { ghoul: 'basic' }, impact: 0, brokenAt: 0 };
});

/** L'écran du combat, ouvert avec les états posés par les étapes précédentes. */
async function open(): Promise<TrialBattleTest> {
  world.test ??= await renderTrialBattle({
    seed: seedFor(world.firstRound),
    createBattle: battleWith(...world.changes),
  });
  return world.test;
}

function test(): TrialBattleTest {
  return world.test!;
}

function all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
  return test()
    .snapshots.flatMap((snapshot) => snapshot.events)
    .filter((event): event is EventOf<Type> => event.type === type);
}

function column(enemy: number) {
  return screen.getByTestId(`enemy-${KINDS[enemy]}`);
}

/** La pastille de l'intention d'un ennemi, `null` s'il n'en montre aucune. */
function intentChip(enemy: number) {
  return screen.queryByTestId(`enemy-${KINDS[enemy]}-intent`);
}

function intentIcon(enemy: number, category: string) {
  return within(column(enemy)).queryByTestId(`enemy-${KINDS[enemy]}-intent-${category}`, {
    includeHiddenElements: true,
  });
}

function sceneEnemies(): readonly Record<string, unknown>[] {
  const scene = screen.getByTestId('battle-scene', { includeHiddenElements: true });
  return (scene.props as { enemies: Record<string, unknown>[] }).enemies;
}

function opacityOf(enemy: number): unknown {
  return StyleSheet.flatten(column(enemy).props.style).opacity;
}

/** La frappe en cours, jusqu'à sa résolution. */
async function toStrikeResolved(): Promise<EventOf<'strikeResolved'>> {
  await test().runUntil(() => {
    const { phase } = test().battle();
    return phase.kind !== 'heroStrike' || phase.resolved;
  });
  return all('strikeResolved').at(-1)!;
}

/** Le tour de `enemy` dans la phase ennemie de la manche `round` (action, perte ou retour). */
async function toTurnOf(enemy: number, round: number): Promise<void> {
  await test().runUntil(() => {
    const battle = test().battle();
    const { phase } = battle;
    return battle.round === round && phase.kind === 'enemy' && phase.step.enemy === enemy;
  });
}

async function toHeroPhaseOf(round: number): Promise<void> {
  await test().runUntil(() => {
    const battle = test().battle();
    return battle.round === round && battle.phase.kind === 'hero';
  });
}

/** Une parade parfaite sur le premier coup de la Goule, puis la contre-attaque. */
async function parryGhoulPerfectly(): Promise<void> {
  const impact = await test().toWindUpOf(GHOUL);
  await test().touchDefense('parry', impact);
  await test().advanceTo(impact + 90);
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^un combat de la Sentinelle \(Attaque 10, Brise-garde 12\) contre un groupe de la Goule \(50 PV, garde 15\), du Spectre \(35 PV, garde 10\) et du Nécromancien \(45 PV, garde 12\)$/u,
    () => {
      // L'écran s'ouvre à la première étape qui en a besoin, avec les états du scénario.
    },
  );

  and("l'ordre d'action du #31 : la Sentinelle, puis les ennemis debout de gauche à droite", () => {
    const { battle } = startTrialBattle({
      seed: 1,
      tuning: DEFAULT_TRIAL_TUNING,
      defenseHint: false,
      at: 0,
    });
    expect(actionOrder(battle.enemies)).toEqual(['hero', GHOUL, SPECTER, NECROMANCER]);
  });

  // --- Frappe parfaite (C6) -----------------------------------------------------------------

  given('la Sentinelle attaque la Goule', async () => {
    const opened = await open();
    await opened.attack();
    const { phase } = opened.battle();
    if (phase.kind !== 'heroStrike') throw new Error(`No strike: ${phase.kind}`);
    world.impact = phase.impactAt;
    expect(phase.impactAt - phase.since).toBe(700);
    expect(
      within(screen.getByTestId('battle-pad')).getByRole('button', { name: 'Frapper' }),
    ).toBeOnTheScreen();
  });

  when(
    /^le joueur touche « Frapper » 40 ms après l'impact de la frappe \(préparation de 700 ms\)$/u,
    async () => {
      await test().strike(world.impact + 40);
    },
  );

  then(/^la Goule perd 15 PV et 18 points de garde \(×1,5\)$/u, () => {
    expect(all('strikeResolved').at(-1)).toMatchObject({
      enemy: GHOUL,
      judgement: 'perfect',
      damage: 15,
      guardDamage: 18,
    });
    expect(screen.getByText('−15')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Goule, cible, 35 PV sur 50/u })).toBeOnTheScreen();
  });

  and("l'arrêt sur image de 90 ms et le libellé « Frappe parfaite » accompagnent la frappe", () => {
    expect(all('hitStopStarted')).toEqual([
      { type: 'hitStopStarted', at: world.impact + 40, until: world.impact + 130 },
    ]);
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent(/^Frappe parfaite/u);
    expect(announce).toHaveBeenCalledWith('Frappe parfaite, 15 dégâts');
  });

  and("le mot « Critique » n'apparaît jamais", () => {
    expect(screen.queryByText(/critique/iu, { includeHiddenElements: true })).toBeNull();
    for (const [sentence] of announce.mock.calls) {
      expect(sentence).not.toMatch(/critique/iu);
    }
  });

  // --- Cassure de garde (C5) ----------------------------------------------------------------

  given(/^la garde du (Spectre|Nécromancien) est à (\d+)$/u, (who, guard) => {
    const enemy = who === 'Spectre' ? SPECTER : NECROMANCER;
    world.changes.push(enemyWith(enemy, { guard: Number(guard) }));
  });

  when('la Sentinelle lui inflige 12 points de garde', async () => {
    const opened = await open();
    await opened.touchEnemy(SPECTER);
    await opened.attack();
    expect(await toStrikeResolved()).toMatchObject({ enemy: SPECTER, guardDamage: 12 });
  });

  then('la garde du Spectre est à 0 et il est étourdi', () => {
    expect(test().battle().enemies[SPECTER]).toMatchObject({
      guard: 0,
      stun: { actionLost: false },
    });
  });

  and("« Cassure » s'affiche, avec l'arrêt sur image, la vibration et le son de cassure", () => {
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent('Cassure');
    const broken = all('guardBroken').at(-1)!;
    expect(all('hitStopStarted')).toContainEqual(
      expect.objectContaining({ at: broken.at, until: broken.at + 90 }),
    );
    expect(test().haptics.played).toContain('guardBreak');
    expect(test().sound.played).toContain('guardBreak');
  });

  and(
    "le Spectre est à terre, avec les étoiles d'étourdissement, et « Étourdi ×1,5 » s'affiche sous lui",
    () => {
      // La scène dessine le Spectre à terre et ses étoiles (#81).
      expect(sceneEnemies()[SPECTER]).toMatchObject({ kind: 'specter', down: true });
      expect(within(column(SPECTER)).getByText('Étourdi ×1,5')).toBeOnTheScreen();
    },
  );

  // --- Cassure par le héros (C5.3 à C5.7) ---------------------------------------------------

  given('la Sentinelle brise la garde de la Goule pendant sa phase de la manche 3', async () => {
    world.changes.push(roundAt(3), enemyWith(GHOUL, { guard: 8 }));
    const opened = await open();
    await opened.attack();
    await toStrikeResolved();
    expect(all('guardBroken')).toEqual([expect.objectContaining({ enemy: GHOUL, by: 'strike' })]);
    expect(opened.battle().round).toBe(3);
  });

  when(/^vient l'action de la Goule dans la phase ennemie de la manche (\d+)$/u, async (round) => {
    await toTurnOf(GHOUL, Number(round));
  });

  then("la Goule reste à terre et n'agit pas, pendant 250 ms", async () => {
    const { phase } = test().battle();
    expect(phase).toMatchObject({ kind: 'enemy', step: { kind: 'lostAction', enemy: GHOUL } });
    const { since, until } = (phase as { step: { since: number; until: number } }).step;
    expect(until - since).toBe(250);
    expect(sceneEnemies()[GHOUL]).toMatchObject({ down: true });
    expect(all('actionLost')).toEqual([{ type: 'actionLost', at: since, enemy: GHOUL, until }]);
  });

  and(
    "elle ne passe pas au premier plan, ne fait pas d'avancée et les autres ennemis ne sont pas estompés",
    async () => {
      expect(sceneEnemies().map((enemy) => enemy.active)).toEqual([false, false, false]);
      expect(sceneEnemies().map((enemy) => enemy.dimmed)).toEqual([false, false, false]);
      expect([SPECTER, NECROMANCER].map(opacityOf)).toEqual([undefined, undefined]);
      // Toute la manche : jamais d'avancée de la Goule.
      await toHeroPhaseOf(4);
      expect(all('stepInStarted').map((event) => event.enemy)).toEqual([SPECTER, NECROMANCER]);
    },
  );

  and("le lecteur d'écran annonce « Goule, étourdie, n'agit pas »", () => {
    expect(announce).toHaveBeenCalledWith("Goule, étourdie, n'agit pas");
  });

  when('la phase du héros de la manche 4 commence', async () => {
    await toHeroPhaseOf(4);
  });

  then("la Goule n'affiche aucune intention", () => {
    expect(intentChip(GHOUL)).toBeNull();
    expect(test().battle().enemies[GHOUL]!.intent).not.toBeNull();
  });

  when('la Sentinelle frappe la Goule sans appui', async () => {
    expect(test().battle().target).toBe(GHOUL);
    await test().attack();
    await toStrikeResolved();
  });

  then(/^la Goule perd 15 PV \(10 × 1,5\) et aucun point de garde$/u, () => {
    expect(all('strikeResolved').at(-1)).toMatchObject({
      enemy: GHOUL,
      damage: 15,
      guardDamage: 0,
    });
    expect(test().battle().enemies[GHOUL]!.guard).toBe(0);
  });

  and(
    "à la fin de l'action de la Sentinelle, la Goule se relève en 400 ms et sa garde revient à 15",
    async () => {
      const end = (test().battle().phase as { readonly until: number }).until;
      expect(all('guardRestored')).toEqual([]);
      await test().advanceTo(end);
      expect(all('guardRestored')).toEqual([
        { type: 'guardRestored', at: end, enemy: GHOUL, until: end + 400, inPlaceOfAction: false },
      ]);
      expect(test().battle().enemies[GHOUL]).toMatchObject({ guard: 15, stun: null });
      expect(sceneEnemies()[GHOUL]).toMatchObject({ down: false });
    },
  );

  and("son intention de la manche 4 s'affiche", () => {
    expect(intentIcon(GHOUL, 'attack')).toBeOnTheScreen();
  });

  and('elle agit normalement dans la phase ennemie de la manche 4', async () => {
    await toTurnOf(GHOUL, 4);
    expect(test().battle().phase).toMatchObject({ step: { kind: 'stepIn', enemy: GHOUL } });
  });

  // --- Cassure par une contre-attaque (C8, C5.5, C5.6) -------------------------------------

  given('la garde de la Goule est à 10', () => {
    // La Sentinelle frappe le Spectre, qu'aucun coup ne brise : seule la contre-attaque touche
    // la Goule. La manche 3, comme le second scénario qui l'emploie.
    world.changes.push(
      enemyWith(GHOUL, { guard: 10 }),
      enemyWith(SPECTER, { guard: 99 }),
      targetOn(SPECTER),
      roundAt(3),
    );
  });

  when('le joueur pare parfaitement un coup de la Goule', async () => {
    await open();
    await parryGhoulPerfectly();
  });

  then(
    /^la contre-attaque inflige 12 points de garde \(100 % du Brise-garde\) et la Goule est étourdie$/u,
    () => {
      expect(all('counterAttacked').at(-1)).toMatchObject({ enemy: GHOUL, guardDamage: 12 });
      expect(test().battle().enemies[GHOUL]).toMatchObject({
        guard: 0,
        stun: { actionLost: false },
      });
    },
  );

  and("« Cassure » s'affiche, seul mot du résultat pendant la phase ennemie", () => {
    expect(screen.getByTestId('battle-feedback')).toHaveTextContent(/^Cassure$/u);
    expect(screen.queryByText(/contre-attaque/u)).toBeNull();
  });

  and("« Étourdie ×1,5 » s'affiche sous la Goule", () => {
    expect(within(column(GHOUL)).getByText('Étourdie ×1,5')).toBeOnTheScreen();
  });

  and("le lecteur d'écran annonce « Cassure, Goule étourdie »", () => {
    expect(announce).toHaveBeenCalledWith('Cassure, Goule étourdie');
  });

  and(
    'le joueur pare parfaitement son coup pendant la phase ennemie de la manche 3, et la contre-attaque la brise',
    async () => {
      const opened = await open();
      await parryGhoulPerfectly();
      expect(opened.battle().round).toBe(3);
      const broken = all('guardBroken').at(-1)!;
      expect(broken).toMatchObject({ enemy: GHOUL, by: 'counter' });
      world.brokenAt = broken.at;
    },
  );

  then("l'intention de la Goule est un cercle barré", () => {
    expect(intentIcon(GHOUL, 'skip')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Goule, 44 PV sur 50, étourdie/u }),
    ).toBeOnTheScreen();
  });

  when('la Sentinelle utilise Rempart', async () => {
    await test().power();
    expect(all('powerUsed')).toHaveLength(1);
  });

  then('la Goule se relève en 400 ms, sans avancée ni attaque, et sa garde revient à 15', () => {
    const { phase } = test().battle();
    expect(phase).toMatchObject({ kind: 'enemy', step: { kind: 'guardRestore', enemy: GHOUL } });
    const { since, until } = (phase as { step: { since: number; until: number } }).step;
    expect(until - since).toBe(400);
    expect(all('guardRestored').at(-1)).toMatchObject({ enemy: GHOUL, inPlaceOfAction: true });
    expect(test().battle().enemies[GHOUL]).toMatchObject({ guard: 15, stun: null });
    expect(
      all('stepInStarted').filter((event) => event.enemy === GHOUL && event.at > world.brokenAt),
    ).toEqual([]);
  });

  and("sa garde n'est jamais restaurée avant ce moment", () => {
    const restoredAt = all('guardRestored').at(-1)!.at;
    const before = test().snapshots.filter(
      ({ battle }) => battle.now > world.brokenAt && battle.now < restoredAt,
    );
    expect(before.length).toBeGreaterThan(0);
    for (const { battle } of before) expect(battle.enemies[GHOUL]!.guard).toBe(0);
  });

  and('à la manche 5, la Goule agit normalement', async () => {
    await toHeroPhaseOf(5);
    await test().attack();
    await toTurnOf(GHOUL, 5);
    expect(test().battle().phase).toMatchObject({ step: { kind: 'stepIn', enemy: GHOUL } });
  });

  // --- Tous les ennemis étourdis (C5.4, C12) ------------------------------------------------

  given(
    "la Goule, le Spectre et le Nécromancien sont étourdis et n'ont pas encore perdu leur action",
    async () => {
      world.changes.push(stunnedEnemy(GHOUL), stunnedEnemy(SPECTER), stunnedEnemy(NECROMANCER));
      await open();
      for (const enemy of [GHOUL, SPECTER, NECROMANCER]) {
        expect(intentIcon(enemy, 'skip')).toBeOnTheScreen();
      }
    },
  );

  when('la Sentinelle termine son action', async () => {
    await test().attack();
    await toStrikeResolved();
    const end = (test().battle().phase as { readonly until: number }).until;
    await test().advanceTo(end);
    world.impact = end;
  });

  then("les trois actions perdues s'enchaînent, 250 ms chacune", async () => {
    await toHeroPhaseOf(2);
    const end = world.impact;
    expect(all('actionLost')).toEqual([
      { type: 'actionLost', at: end, enemy: GHOUL, until: end + 250 },
      { type: 'actionLost', at: end + 250, enemy: SPECTER, until: end + 500 },
      { type: 'actionLost', at: end + 500, enemy: NECROMANCER, until: end + 750 },
    ]);
  });

  and("il n'y a ni transition de phase de 800 ms, ni annonce « Phase ennemie »", () => {
    expect(all('phaseTransitionStarted')).toEqual([]);
    expect(announce).not.toHaveBeenCalledWith('Phase ennemie. Prépare ta parade.');
    expect(test().sound.played).not.toContain('enemyPhase');
  });

  and("la phase du héros suivante commence avec l'annonce « À toi »", () => {
    expect(all('heroPhaseStarted').at(-1)).toEqual({
      type: 'heroPhaseStarted',
      at: world.impact + 750,
      announced: true,
    });
    expect(screen.getByTestId('phase-banner')).toHaveTextContent('À toiVise et attaque');
    expect(announce).toHaveBeenCalledWith('À toi. Vise et attaque.');
    expect(test().sound.played).toContain('heroPhase');
  });

  // --- Intentions (C2) ----------------------------------------------------------------------

  and('son intention est Garde, affichée par un bouclier et « +3 », sans mot', async () => {
    world.changes.push(enemyWith(NECROMANCER, { intent: { category: 'guard', gain: 3 } }));
    await open();
    expect(intentIcon(NECROMANCER, 'guard')).toBeOnTheScreen();
    expect(intentChip(NECROMANCER)).toHaveTextContent('+3', { exact: true });
  });

  when("il exécute l'intention Garde", async () => {
    await test().attack();
    await test().runUntil(() => {
      const { phase } = test().battle();
      return phase.kind === 'enemy' && phase.step.kind === 'support';
    });
  });

  then(/^sa garde remonte de 3 points \(30 % de 12\)$/u, () => {
    expect(all('guardRaised')).toEqual([
      expect.objectContaining({ enemy: NECROMANCER, gain: 3, guard: 7 }),
    ]);
    expect(test().battle().enemies[NECROMANCER]!.guard).toBe(7);
    // Le gain s'envole au-dessus de sa garde, à côté du « +3 » de l'intention.
    expect(within(column(NECROMANCER)).getAllByText('+3')).toHaveLength(2);
    expect(announce).toHaveBeenCalledWith('Nécromancien relève sa garde, plus 3');
  });

  and("sans cette intention, sa garde ne remonte jamais d'elle-même", () => {
    const raisedAt = all('guardRaised')[0]!.at;
    for (const { battle } of test().snapshots.filter(({ battle }) => battle.now < raisedAt)) {
      expect(battle.enemies[NECROMANCER]!.guard).toBe(4);
    }
  });

  and('sa garde remonte aussi à son maximum à son retour en garde, après un étourdissement', () => {
    // Le Nécromancien étourdi, son action perdue : la prochaine action du héros le relève.
    const started = startTrialBattle({
      seed: 1,
      tuning: DEFAULT_TRIAL_TUNING,
      defenseHint: false,
      at: 0,
    });
    const battle = changeBattle(
      started.battle,
      stunnedEnemy(NECROMANCER, { actionLost: true, heroAction: 0 }),
    );
    const attacked = heroAction(battle, {
      action: { kind: 'attack' },
      touchStartedAt: 900,
      releasedAt: 1_000,
    });
    const { battle: after, events } = advance(attacked.battle, 2_180);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'guardRestored', enemy: NECROMANCER }),
    );
    expect(after.enemies[NECROMANCER]).toMatchObject({ guard: 12, stun: null });
  });

  given(/^le Nécromancien \(garde max 12\) a tiré l'intention Garde$/u, async () => {
    world.changes.push(
      enemyWith(NECROMANCER, { guard: 8, intent: { category: 'guard', gain: 3 } }),
    );
    await open();
    expect(test().battle().enemies[NECROMANCER]).toMatchObject({ maxGuard: 12 });
  });

  then(
    /^son intention affiche un bouclier et « \+3 » \(30 % de 12, entier inférieur\), sans mot$/u,
    () => {
      expect(intentIcon(NECROMANCER, 'guard')).toBeOnTheScreen();
      expect(intentChip(NECROMANCER)).toHaveTextContent('+3', { exact: true });
    },
  );

  and(/^le lecteur d'écran lit « (.+) »( sans nombre)?$/u, (sentence: string, noNumber) => {
    const [name] = sentence.split(',');
    const enemy = screen.getByRole('button', { name: new RegExp(`^${name}, `, 'u') });
    const label = enemy.props.accessibilityLabel as string;
    expect(label).toMatch(new RegExp(`${sentence.slice(name!.length + 2)}$`, 'u'));
    if (noNumber !== undefined) expect(label.split('intention')[1]).not.toMatch(/\d/u);
  });

  and(/^le lecteur d'écran lit « Goule, intention : attaque », sans nombre$/u, () => {
    const label = screen.getByRole('button', { name: /^Goule, / }).props
      .accessibilityLabel as string;
    expect(label).toMatch(/, intention : attaque$/u);
    expect(label.split('intention')[1]).not.toMatch(/\d/u);
  });

  given(
    /^la Goule a tiré (une double frappe de 3 \+ 3|un coup simple de 5 dégâts)$/u,
    async (move) => {
      world.firstRound = { ghoul: move.startsWith('une double') ? 'double' : 'basic' };
      const opened = await open();
      expect(opened.battle().enemies[GHOUL]!.intent).toMatchObject(
        move.startsWith('une double')
          ? { category: 'attack', attack: 'double', damage: 3 }
          : { category: 'attack', attack: 'basic', damage: 5 },
      );
    },
  );

  then(
    /^son intention affiche une lame seule, sans « 6 », sans « 3 \+ 3 » et sans type de coup$/u,
    () => {
      expect(intentIcon(GHOUL, 'attack')).toBeOnTheScreen();
      expect(intentChip(GHOUL)).toHaveTextContent('', { exact: true });
      for (const hidden of [/\b6\b/u, /3 \+ 3/u, /2×3/u, /double frappe/u]) {
        expect(within(column(GHOUL)).queryByText(hidden)).toBeNull();
      }
    },
  );

  then(
    /^son intention affiche une lame seule, sans mot ni nombre, pour tout héros et avec ou sans Rempart$/u,
    () => {
      expect(intentIcon(GHOUL, 'attack')).toBeOnTheScreen();
      expect(intentChip(GHOUL)).toHaveTextContent('', { exact: true });
      // Avec le Rempart actif, l'intention montrée ne change pas (C2.3).
      const withBulwark = changeBattle(test().battle(), heroWith({ bulwark: true }));
      expect(battleView(withBulwark).enemies[GHOUL]!.intent).toEqual({ category: 'attack' });
    },
  );

  when('la Goule commence sa préparation', async () => {
    world.impact = await test().toWindUpOf(GHOUL);
  });

  then("le lecteur d'écran annonce « Goule, coup simple »", () => {
    expect(announce).toHaveBeenCalledWith('Goule, coup simple');
    expect(screen.queryByText(/coup simple/u)).toBeNull();
  });

  when('le joueur ne touche rien', () => {
    // Rien : l'horloge avance seule dans l'étape suivante.
  });

  then(/^la Sentinelle perd 4 PV \(5 × 0,9, entier inférieur\)$/u, async () => {
    await test().advanceTo(world.impact + 160 + 32);
    expect(all('blowResolved').at(-1)).toMatchObject({ outcome: 'suffered', damage: 4 });
    expect(screen.getByText('−4')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^La Sentinelle, PV 76 sur 80/u)).toBeOnTheScreen();
  });

  given('la Goule est tombée', () => {
    world.changes.push(
      enemyWith(GHOUL, { hp: 0 }),
      enemyWith(SPECTER, { guard: 99 }),
      targetOn(SPECTER),
    );
  });

  and(
    "l'intention du Nécromancien est Relever, affichée par une flèche vers le haut, sans mot ni nombre",
    async () => {
      world.changes.push(enemyWith(NECROMANCER, { intent: { category: 'raise', ally: GHOUL } }));
      await open();
      expect(intentIcon(NECROMANCER, 'raise')).toBeOnTheScreen();
      expect(intentChip(NECROMANCER)).toHaveTextContent('', { exact: true });
    },
  );

  when('la phase ennemie se déroule', async () => {
    await test().attack();
    await test().runUntil(() => all('allyRaised').length > 0);
  });

  then(/^la Goule revient avec 25 PV \(50 %\), garde pleine, non étourdie$/u, () => {
    expect(test().battle().enemies[GHOUL]).toMatchObject({ hp: 25, guard: 15, stun: null });
    expect(
      screen.getByRole('button', { name: /^Goule, 25 PV sur 50, garde 15 sur 15/u }),
    ).toBeOnTheScreen();
  });

  and("elle n'agit qu'à partir de la manche suivante", () => {
    // L'ordre d'action de la manche est figé : la Goule, tombée à son début, n'y est pas.
    expect(test().battle().turn.order).not.toContain(GHOUL);
  });

  and("jusqu'à la fin de la manche, son intention s'affiche en cercle barré", async () => {
    expect(intentIcon(GHOUL, 'skip')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /relevée, n'agit pas$/u })).toBeOnTheScreen();
    await test().runUntil(() => test().battle().phase.kind !== 'enemy');
    expect(all('stepInStarted').map((event) => event.enemy)).not.toContain(GHOUL);
    await toHeroPhaseOf(2);
    expect(intentIcon(GHOUL, 'skip')).toBeNull();
    expect(test().battle().turn.order).toContain(GHOUL);
    await test().attack();
    await toTurnOf(GHOUL, 2);
    expect(test().battle().phase).toMatchObject({ step: { kind: 'stepIn', enemy: GHOUL } });
  });

  // --- Élan (C3) ----------------------------------------------------------------------------

  given(/^l'Élan de la Sentinelle vaut 0$/u, async () => {
    world.changes.push(heroWith({ momentum: 0 }));
    await open();
  });

  then(
    /^le pouvoir Rempart \(1 Élan\) est visible mais indisponible, et dit qu'il manque 1 Élan$/u,
    () => {
      const power = screen.getByRole('button', {
        name: 'Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan',
      });
      expect(power).toBeDisabled();
      expect(within(power).getByText('Il manque 1 Élan')).toBeOnTheScreen();
      expect(screen.getByLabelText(/Élan 0 sur 5/u)).toBeOnTheScreen();
    },
  );
};

// Seuls les scénarios d'interface (`@ui`) : les autres passent par la session de combat.
const feature = loadFeature('features/combat-complet.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
