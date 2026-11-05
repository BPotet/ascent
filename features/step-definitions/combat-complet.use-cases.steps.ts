/**
 * Scénarios de « Combat complet » (#32), côté règles : exécutés à travers la session de combat
 * (`BattleSession`), avec l'horloge de combat manuelle (`ManualBattleClock`), une graine du combat
 * fixée et un constructeur de combat qui pose les états des scénarios (« la Goule est étourdie »).
 * Les instants sont exacts à la milliseconde. Les scénarios `@ui` passent par l'écran.
 *
 * Correspondance métier : « le joueur touche « Frapper » » = un appui sur « Frapper » daté à
 * l'instant où le doigt se pose ; « la Goule est étourdie » = étourdie pendant une action passée
 * du héros, son action déjà perdue ; « le combat commence » = un nouveau combat de test.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import type { KeyValueStore } from '../../src/application/ports/KeyValueStore';
import {
  battleWith,
  enemyWith,
  heroWith,
  stunnedEnemy,
  type BattleChange,
} from '../../src/application/testing/battleBuilder';
import { FixedSeedSource } from '../../src/application/testing/FixedSeedSource';
import { ManualBattleClock } from '../../src/application/testing/ManualBattleClock';
import {
  silentBattleHaptics,
  silentBattleSound,
} from '../../src/application/testing/recordingBattleFeedback';
import { seedFor } from '../../src/application/testing/battleSeeds';
import { BATTLE_HINT_SEEN_KEYS } from '../../src/application/useCases/battleHints';
import { BattleSession, type BattleSnapshot } from '../../src/application/useCases/BattleSession';
import { actionOrder } from '../../src/domain/battle/actionOrder';
import type { Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, SENTINEL } from '../../src/domain/battle/combatants';
import { scaleDamage } from '../../src/domain/battle/rules';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const GHOUL = 0;
const SPECTER = 1;
const NECROMANCER = 2;

interface World {
  clock: ManualBattleClock;
  session: BattleSession;
  published: BattleSnapshot[];
  /** L'impact de la frappe visée par le scénario. */
  impact: number;
  /** Les PV et la garde de la Goule avant la frappe visée. */
  ghoulBefore: { hp: number; guard: number };
  /** Les dégâts de la frappe de chaque combat (« Pas de critique au hasard »). */
  damages: number[];
  seeds: number[];
  /** « Le combat commence » a ouvert le scénario : l'Élan se vérifie, il ne se pose pas. */
  started: boolean;
  /** Le début de l'action du héros visée. */
  actionAt: number;
}

let world: World;

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>([
    [BATTLE_HINT_SEEN_KEYS.hero, '1'],
    [BATTLE_HINT_SEEN_KEYS.defense, '1'],
  ]);
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

async function startBattle(
  changes: readonly BattleChange[] = [],
  seed = seedFor({ ghoul: 'basic' }),
): Promise<void> {
  const clock = new ManualBattleClock(1_000);
  const session = new BattleSession(
    {
      clock,
      seeds: new FixedSeedSource(seed),
      sound: silentBattleSound(),
      haptics: silentBattleHaptics(),
      keyValueStore: memoryStore(),
    },
    { createBattle: battleWith(...changes) },
  );
  const published: BattleSnapshot[] = [];
  session.subscribe((snapshot) => published.push(snapshot));
  world = {
    ...world,
    clock,
    session,
    published,
    impact: 0,
    ghoulBefore: { hp: ENEMIES.ghoul.maxHp, guard: ENEMIES.ghoul.maxGuard },
  };
  await session.start();
}

function battle(): Battle {
  return world.session.current()!.battle;
}

function all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
  return world.published
    .flatMap((snapshot) => snapshot.events)
    .filter((event): event is EventOf<Type> => event.type === type);
}

/** Fait tourner l'horloge, minuteur après minuteur, jusqu'à ce que `reached` soit vrai. */
function runUntil(reached: (current: Battle) => boolean): void {
  for (let guard = 0; guard < 300 && !reached(battle()); guard += 1) {
    const [next] = world.clock.pending();
    if (next === undefined) throw new Error(`Battle waits in phase ${battle().phase.kind}`);
    world.clock.advanceTo(next);
  }
  expect(reached(battle())).toBe(true);
}

function heroAction(action: Parameters<BattleSession['heroAction']>[0]): void {
  const at = world.clock.now() + 100;
  world.clock.advanceTo(at);
  world.actionAt = at;
  world.session.heroAction(action, at - 60, at);
}

/** « Attaquer » sur la cible ; l'impact de la frappe est noté. */
function attack(): void {
  const { hp, guard } = battle().enemies[GHOUL]!;
  world.ghoulBefore = { hp, guard };
  heroAction({ kind: 'attack' });
  const { phase } = battle();
  if (phase.kind !== 'heroStrike') throw new Error(`No strike: ${phase.kind}`);
  world.impact = phase.impactAt;
}

function strike(at: number): void {
  world.clock.advanceTo(Math.max(world.clock.now(), at));
  world.session.pressStrike(at);
}

/** Jusqu'à la fin de la frappe en cours (sa résolution). */
function toStrikeResolved(): EventOf<'strikeResolved'> {
  runUntil(({ phase }) => phase.kind !== 'heroStrike' || phase.resolved);
  return all('strikeResolved').at(-1)!;
}

/** Jusqu'à la fin de l'action du héros en cours. */
function toHeroActionEnd(): number {
  const phase = battle().phase as { readonly until: number };
  const { until } = phase;
  world.clock.advanceTo(until);
  return until;
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^un combat de la Sentinelle \(Attaque 10, Brise-garde 12\) contre un groupe de la Goule \(50 PV, garde 15\), du Spectre \(35 PV, garde 10\) et du Nécromancien \(45 PV, garde 12\)$/u,
    async () => {
      world = { started: false, damages: [], seeds: [] } as unknown as World;
      await startBattle();
      expect(SENTINEL).toMatchObject({ attackPower: 10, guardDamage: 12 });
      expect(battle().enemies.map(({ kind, hp, guard }) => ({ kind, hp, guard }))).toEqual([
        { kind: 'ghoul', hp: 50, guard: 15 },
        { kind: 'specter', hp: 35, guard: 10 },
        { kind: 'necromancer', hp: 45, guard: 12 },
      ]);
    },
  );

  and("l'ordre d'action du #31 : la Sentinelle, puis les ennemis debout de gauche à droite", () => {
    expect(battle().turn.order).toEqual(['hero', GHOUL, SPECTER, NECROMANCER]);
    expect(actionOrder(battle().enemies)).toEqual(['hero', GHOUL, SPECTER, NECROMANCER]);
  });

  // --- Frappe en rythme (C6) ----------------------------------------------------------------

  given('la Sentinelle attaque la Goule', () => {
    attack();
  });

  when(/^le joueur touche « Frapper » (\d+) ms (avant|après) l'impact$/u, (delay, side) => {
    if (battle().phase.kind === 'hero') attack();
    strike(world.impact + (side === 'avant' ? -1 : 1) * Number(delay));
  });

  when('le joueur ne touche pas « Frapper »', () => {
    attack();
  });

  then(/^la Goule perd (\d+) PV et (\d+) points de garde( \(.+\))?$/u, (hp, guard) => {
    const resolved = toStrikeResolved();
    expect(resolved).toMatchObject({
      enemy: GHOUL,
      damage: Number(hp),
      guardDamage: Number(guard),
    });
    expect(battle().enemies[GHOUL]).toMatchObject({
      hp: world.ghoulBefore.hp - Number(hp),
      guard: Math.max(0, world.ghoulBefore.guard - Number(guard)),
    });
  });

  and("la Sentinelle n'est pas déséquilibrée", () => {
    expect(battle().offBalanceUntil).toBeNull();
    expect(all('offBalanceStarted')).toEqual([]);
  });

  when("le joueur touche « Frapper » 300 ms avant l'impact puis pile à l'impact", () => {
    attack();
    strike(world.impact - 300);
    strike(world.impact);
  });

  then('la frappe est jugée sur le premier appui, sans bonus', () => {
    expect(toStrikeResolved()).toMatchObject({ judgement: 'miss', delta: -300, damage: 10 });
    expect(all('pressIgnored')).toContainEqual(
      expect.objectContaining({ at: world.impact, button: 'strike' }),
    );
  });

  given('deux combats avec des graines différentes', () => {
    world.seeds = [seedFor({ ghoul: 'basic' }), seedFor({ ghoul: 'double' })];
    expect(world.seeds[0]).not.toBe(world.seeds[1]);
  });

  when(/^le joueur frappe la Goule debout avec le même écart de 40 ms$/u, async () => {
    for (const seed of world.seeds) {
      // Une garde qu'aucune frappe ne brise : la Goule reste debout, non étourdie.
      await startBattle([enemyWith(GHOUL, { guard: 99 })], seed);
      attack();
      strike(world.impact + 40);
      world.damages.push(toStrikeResolved().damage);
    }
  });

  then('la Goule perd 15 PV dans les deux combats', () => {
    expect(world.damages).toEqual([15, 15]);
  });

  then("l'appui est jugé « bon » et n'est pas ignoré", () => {
    expect(toStrikeResolved()).toMatchObject({ judgement: 'good', delta: 150 });
    expect(all('pressIgnored')).toEqual([]);
  });

  and(
    /^la transition de phase vers la phase ennemie ne commence qu'à la fin de la fenêtre de la frappe \(impact \+ 160 ms\) et de son animation$/u,
    () => {
      const windowEnd = world.impact + 160;
      world.clock.advanceTo(windowEnd + 319);
      expect(battle().phase.kind).toBe('heroStrike');
      runUntil(({ phase }) => phase.kind === 'transition');
      expect(battle().phase).toMatchObject({ to: 'enemy', since: windowEnd + 320 });
    },
  );

  given('la Sentinelle utilise le pouvoir Rempart', () => {
    heroAction({ kind: 'power', power: 'bulwark' });
    expect(battle().phase.kind).toBe('heroPower');
  });

  when('son effet est résolu, animation comprise', () => {
    world.clock.advanceTo(world.actionAt + 500);
  });

  then('la transition de phase de 800 ms vers la phase ennemie commence', () => {
    expect(battle().phase).toEqual({
      kind: 'transition',
      to: 'enemy',
      since: world.actionAt + 500,
      until: world.actionAt + 1_300,
    });
  });

  // --- Garde et étourdissement (C5) ---------------------------------------------------------

  given('la Goule est étourdie et a déjà perdu son action', async () => {
    await startBattle([
      stunnedEnemy(GHOUL, { actionLost: true, heroAction: 0 }),
      enemyWith(SPECTER, { guard: 99 }),
    ]);
  });

  when('la Sentinelle attaque le Spectre', () => {
    const at = world.clock.now() + 50;
    world.clock.advanceTo(at);
    world.session.heroAction({ kind: 'target', enemy: SPECTER }, at - 30, at);
    attack();
    expect(battle().phase).toMatchObject({ enemy: SPECTER });
  });

  then('à la fin de cette action, la Goule fait son retour en garde', () => {
    toStrikeResolved();
    expect(all('guardRestored')).toEqual([]);
    const end = toHeroActionEnd();
    expect(all('guardRestored')).toEqual([
      { type: 'guardRestored', at: end, enemy: GHOUL, until: end + 400, inPlaceOfAction: false },
    ]);
    expect(battle().enemies[GHOUL]).toMatchObject({ guard: 15, stun: null });
  });

  given(/^la Goule est étourdie( et a 10 PV)?$/u, async (lowHp) => {
    await startBattle([
      stunnedEnemy(GHOUL, { actionLost: true, heroAction: 0 }),
      ...(lowHp === undefined ? [] : [enemyWith(GHOUL, { hp: 10 })]),
    ]);
  });

  when(/^la Sentinelle la frappe( sans appui)?$/u, () => {
    attack();
  });

  then("aucune garde n'est retirée et aucune « Cassure » n'est annoncée", () => {
    expect(toStrikeResolved()).toMatchObject({ guardDamage: 0 });
    expect(all('guardBroken')).toEqual([]);
    expect(battle().enemies[GHOUL]!.guard).toBe(0);
  });

  then('la Goule tombe, et ni étoiles ni retour en garde ne restent', () => {
    toStrikeResolved();
    toHeroActionEnd();
    expect(battle().enemies[GHOUL]).toMatchObject({ hp: 0, stun: null });
    expect(all('enemyDefeated')).toContainEqual(expect.objectContaining({ enemy: GHOUL }));
    expect(all('guardRestored')).toEqual([]);
  });

  when('le joueur frappe parfaitement', () => {
    attack();
    strike(world.impact);
  });

  then(/^la Goule perd 22 PV \(.+\) et aucun point de garde$/u, () => {
    expect(toStrikeResolved()).toMatchObject({ judgement: 'perfect', damage: 22, guardDamage: 0 });
    expect(battle().enemies[GHOUL]).toMatchObject({ hp: 28, guard: 0 });
  });

  // --- Ordre (C1) ---------------------------------------------------------------------------

  given('le Spectre est tombé', async () => {
    await startBattle([enemyWith(SPECTER, { hp: 0 })]);
  });

  when('la phase ennemie se déroule', () => {
    attack();
    runUntil((current) => current.round === 2 && current.phase.kind === 'hero');
  });

  then("le Spectre n'agit pas", () => {
    const acted = [...all('stepInStarted'), ...all('actionLost'), ...all('windUpStarted')];
    expect(acted.filter((event) => event.enemy === SPECTER)).toEqual([]);
    expect(all('stepInStarted').map((event) => event.enemy)).toEqual([GHOUL, NECROMANCER]);
  });

  // --- Élan, pouvoir et répit (C3, C11) -----------------------------------------------------

  given('le combat commence', async () => {
    await startBattle();
    world.started = true;
  });

  then(/^l'Élan de la Sentinelle vaut (\d+)$/u, async (momentum) => {
    if (world.started) {
      expect(battle().hero.momentum).toBe(Number(momentum));
    } else {
      // Sans « le combat commence », l'étape pose l'Élan du combat du scénario.
      await startBattle([heroWith({ momentum: Number(momentum) })]);
    }
  });

  when('elle attaque', () => {
    attack();
  });

  then(/^son Élan vaut (\d+)$/u, (momentum) => {
    expect(battle().hero.momentum).toBe(Number(momentum));
  });

  when(/^elle utilise le pouvoir Rempart \(1 Élan\)$/u, () => {
    runUntil(({ phase }) => phase.kind === 'hero');
    heroAction({ kind: 'power', power: 'bulwark' });
    expect(all('powerUsed')).toHaveLength(1);
  });

  then(/^son Élan vaut 1 et le prochain coup qu'elle subit fait 50 % de dégâts en moins$/u, () => {
    expect(battle().hero).toMatchObject({ momentum: 1, bulwark: true });
    const before = all('blowResolved').length;
    runUntil(() => all('blowResolved').length > before);
    const blow = all('blowResolved')[before]!;
    const { phase } = battle();
    const damage = phase.kind === 'enemy' && phase.step.kind === 'attack' ? phase.step.damage : 0;
    expect(blow).toMatchObject({ outcome: 'suffered', damage: scaleDamage(damage, 90, 50) });
    expect(blow.damage).toBeLessThan(scaleDamage(damage, 90));
    expect(battle().hero.bulwark).toBe(false);
  });

  when('elle réussit une parade parfaite', () => {
    attack();
    runUntil(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'attack');
    const { phase } = battle();
    const impact =
      phase.kind === 'enemy' && phase.step.kind === 'attack' ? phase.step.impacts[0]!.at : 0;
    world.clock.advanceTo(impact);
    world.session.pressDefense('parry', impact);
    expect(all('blowResolved').at(-1)).toMatchObject({ outcome: 'perfectParry' });
  });

  then('son Élan reste à 5', () => {
    expect(battle().hero.momentum).toBe(5);
  });

  given('la Sentinelle a 50 PV sur 80', async () => {
    await startBattle([
      heroWith({ hp: 50 }),
      enemyWith(GHOUL, { hp: 10 }),
      enemyWith(SPECTER, { hp: 0 }),
      enemyWith(NECROMANCER, { hp: 0 }),
    ]);
    expect(battle().hero).toMatchObject({ hp: 50, maxHp: 80 });
  });

  when('le dernier ennemi tombe', () => {
    attack();
    runUntil(({ phase }) => phase.kind === 'over');
  });

  then(/^le combat est gagné et la Sentinelle remonte à 58 PV \(.+\)$/u, () => {
    expect(battle().phase).toMatchObject({ kind: 'over', outcome: 'victory' });
    expect(battle().hero.hp).toBe(58);
    expect(all('respite')).toEqual([expect.objectContaining({ gain: 8, heroHp: 58 })]);
  });
};

// Les scénarios d'interface (`@ui`) sont laissés aux étapes de l'écran.
const feature = loadFeature('features/combat-complet.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => !tags.includes('@ui')) }],
  [steps],
);
