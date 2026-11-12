/**
 * Scénarios `@session` du « Serment et du pouvoir attisé » (#237) : une vraie session du camp et
 * d'ascension, la jauge du jour et les habitudes sur des ports en mémoire, et l'horloge réglable du
 * camp (aujourd'hui, le samedi 7 novembre 2026 ; hier, le 6 ; avant-hier, le 5). Le lancement suit
 * le pied de la tour : la jauge est lue, l'ascension commence avec ses habitudes faites hier, puis la
 * jauge est scellée.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  campSessionOf,
  campSetUp,
  campStore,
  type CampStore,
} from '../../src/application/testing/campSetUp';
import type { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import type { AscentSession } from '../../src/application/useCases/AscentSession';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
import { CAMP_KEY, type CampSession } from '../../src/application/useCases/CampSession';
import { getFateGauge, sealFateGauge } from '../../src/application/useCases/fateGauge';
import { OATHS_KEY } from '../../src/application/useCases/oaths';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { serializeCamp } from '../../src/domain/ascent/camp';
import { loadoutOf } from '../../src/domain/ascent/loadout';
import { powerPrice } from '../../src/domain/ascent/powerTree';
import { beginAscentLog } from '../../src/domain/ascentLog/AscentLog';
import { buildAscentLogExport } from '../../src/domain/ascentLog/AscentLogExport';
import {
  heroAction,
  powerAvailability,
  powerCost,
  startBattle,
  type Battle,
} from '../../src/domain/battle/Battle';
import type { HeroKind } from '../../src/domain/battle/combatants';
import type { PowerKind } from '../../src/domain/battle/powers';
import { Day } from '../../src/domain/day/Day';
import type { HabitId } from '../../src/domain/habit/Habit';
import { HabitName } from '../../src/domain/habit/HabitName';
import { heroCard } from '../../src/adapters/ui/format/battleText';
import { powerRows } from '../../src/adapters/ui/format/loadoutText';
import { powerKeyLabel } from '../../src/adapters/ui/format/powerText';
import { battleView } from '../../src/adapters/ui/state/battleView';
import type { settableClock } from '../../src/application/testing/settableClock';

const TODAY = Day.of(2026, 11, 7);
const YESTERDAY = TODAY.plusDays(-1);
const BEFORE_YESTERDAY = TODAY.plusDays(-2);

interface World {
  store: CampStore;
  session: AscentSession;
  camp: CampSession;
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  habits: Map<string, HabitId>;
  ascent: Ascent | null;
  battle: Battle | null;
}

let world: World;

/** Une app neuve, le 7 novembre : Représailles, Tenir bon, Entaille et Brume débloqués par défaut. */
/**
 * Une graine où le héros ouvre le 1er combat, la liste des pouvoirs à l'écran (5 depuis le
 * Porte-cierge et le Rat de crypte, #268 : le 1er groupe de la graine 3 agit avant lui).
 */
const SEED = 5;

async function open(
  powers: readonly PowerKind[] = ['retaliation', 'holdFast', 'rend', 'mist'],
): Promise<void> {
  const store = campStore();
  store.values.set(
    SHARD_TOTAL_KEY,
    JSON.stringify({ version: 1, total: 200, seed: null, awarded: [] }),
  );
  store.values.set(
    CAMP_KEY,
    serializeCamp({
      unlocks: [],
      powers: powers.map((power) => ({ power, price: powerPrice(power) })),
    }),
  );
  const { ascentSession: session, camp, clock, unitOfWork } = campSetUp(store, SEED);
  world = {
    store,
    session,
    camp,
    clock,
    unitOfWork,
    habits: new Map(),
    ascent: null,
    battle: null,
  };
  await addHabit('Courir');
  await addHabit('Lire');
  await session.load();
  await camp.load();
}

async function addHabit(name: string): Promise<void> {
  const habit = await world.unitOfWork.run(({ habits }) =>
    habits.add(HabitName.parse(name), Day.of(2026, 10, 1)),
  );
  world.habits.set(name, habit.id);
}

const habit = (name: string) => world.habits.get(name)!;

async function doneYesterday(name: string): Promise<void> {
  await world.unitOfWork.run(({ checkIns }) =>
    checkIns.save({ habitId: habit(name), day: YESTERDAY, done: true, corrected: false }),
  );
}

/** Un Serment stocké, prêté le jour `since`. */
async function storedOath(power: PowerKind, name: string, since: Day): Promise<void> {
  world.store.values.set(
    OATHS_KEY,
    JSON.stringify({
      version: 1,
      oaths: [{ power, habit: habit(name), since: since.toIsoString() }],
    }),
  );
  await reopen();
}

/** Une app relancée sur le même stockage, avec la même horloge et les mêmes habitudes. */
async function reopen(): Promise<void> {
  const { ascentSession: session } = campSetUp(world.store, SEED);
  world.session = session;
  world.camp = campSessionOf(session, world.store, {
    clock: world.clock,
    unitOfWork: world.unitOfWork,
  });
  await session.load();
  await world.camp.load();
}

async function swear(power: PowerKind, name: string): Promise<void> {
  expect(await world.camp.swearOath(power, habit(name))).toBe('sworn');
}

const gaugeDependencies = () => ({
  clock: world.clock,
  unitOfWork: world.unitOfWork,
  keyValueStore: world.store,
});

/**
 * Le lancement du pied de la tour : la jauge lue, l'ascension commencée avec les pouvoirs choisis
 * (#236, la présélection par défaut), puis la jauge scellée.
 */
async function launch(hero: HeroKind = 'sentinel', powers?: readonly PowerKind[]): Promise<Ascent> {
  const reading = await getFateGauge(gaugeDependencies());
  const ascent = world.camp.beginAscent({
    hero,
    gauge: reading.gauge,
    blessings: reading.blessings,
    doneYesterday: reading.doneYesterday,
    ...(powers !== undefined && { powers }),
  });
  await sealFateGauge(gaugeDependencies(), reading);
  world.ascent = ascent;
  return ascent!;
}

async function firstBattle(): Promise<Battle> {
  const battleSession = world.session.battleSession();
  await battleSession.start();
  world.battle = battleSession.current()!.battle;
  return world.battle;
}

const kindledPowers = () => world.session.current()?.kindled.map(({ power }) => power);

const steps: StepDefinitions = ({ given, when, then, and, but }) => {
  // --- Prêter serment au Camp ---

  given(/^le joueur a débloqué Entaille \(1 Élan\)$/u, async () => {
    await open(['rend']);
  });

  then(/^ni Entaille ni le Rempart \(1 Élan\) ne proposent de Serment$/u, async () => {
    const bearers = world.camp.view().oathBearers;
    expect(bearers).not.toContain('rend');
    expect(bearers).not.toContain('bulwark');
    expect(await world.camp.swearOath('rend', habit('Courir'))).toBe('refused');
  });

  given(/^le joueur n'a pas débloqué Brume$/u, async () => {
    await open(['retaliation']);
  });

  then(/^Brume ne propose pas de Serment$/u, () => {
    expect(world.camp.view().oathBearers).not.toContain('mist');
  });

  but(/^Pas de l'ombre \(3 Élan\), pouvoir de base, en propose un$/u, () => {
    expect(world.camp.view().oathBearers).toContain('shadowStep');
  });

  given(/^« Courir » est liée par un Serment à Représailles$/u, async () => {
    await open();
    await swear('retaliation', 'Courir');
  });

  when(/^le joueur prête un Serment pour Pas de l'ombre$/u, async () => {
    expect(await world.camp.swearOath('shadowStep', habit('Courir'))).toBe('refused');
  });

  then(/^« Courir » n'est pas proposée, ou se montre déjà liée à Représailles$/u, () => {
    expect(world.camp.view().oaths).toEqual({
      retaliation: { habit: habit('Courir'), name: 'Courir', since: '2026-11-07' },
    });
  });

  given(/^Représailles porte le Serment « Courir »$/u, async () => {
    await open();
    await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
  });

  then(/^il ne peut pas porter un second Serment en même temps$/u, async () => {
    await swear('retaliation', 'Lire');
    expect(Object.keys(world.camp.view().oaths)).toEqual(['retaliation']);
    expect(world.camp.view().oaths.retaliation?.name).toBe('Lire');
  });

  // --- Le pouvoir attisé ---

  given(
    /^Représailles porte le Serment « Courir » depuis avant-hier et « Courir » a été faite hier$/u,
    async () => {
      await open();
      await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
      await doneYesterday('Courir');
    },
  );

  when(
    /^(?:le joueur|il) commence une ascension(?: aujourd'hui)? avec la Sentinelle équipée de Représailles$/u,
    async () => {
      const ascent = await launch('sentinel');
      expect(ascent.powers).toContain('retaliation');
    },
  );

  then(/^Représailles est attisé pour toute l'ascension$/u, async () => {
    expect(kindledPowers()).toEqual(['retaliation']);
    const battle = await firstBattle();
    expect(powerCost(battle, 'retaliation')).toBe(1);
  });

  and(
    /^sa ligne dans la liste des pouvoirs dit « 1 Élan · Instantané », avec la marque du pouvoir attisé$/u,
    () => {
      const { pad } = battleView(world.battle!);
      const key =
        pad.kind === 'hero' ? pad.powers.find(({ power }) => power === 'retaliation') : null;
      expect(key).toMatchObject({ cost: 1, baseCost: 2, kindled: true, instant: true });
      expect(powerKeyLabel(key!)).toMatch(/^Pouvoir : Représailles, attisé, 1 Élan au lieu de 2/u);
    },
  );

  and(
    /^la carte de la Sentinelle du Choix du héros et la feuille de l'Équipement le montrent attisé$/u,
    () => {
      const preview = world.camp
        .kindledPreview([habit('Courir')])
        .sentinel.map(({ power }) => power);
      expect(heroCard('sentinel', world.ascent!.powers, preview).label).toContain(
        'Représailles, attisé, 1 Élan',
      );
      const loadout = loadoutOf(world.ascent!);
      const row = powerRows(loadout.powers!, loadout.kindled, { [habit('Courir')]: 'Courir' }).find(
        ({ power }) => power === 'retaliation',
      );
      expect(row?.kindled?.oath).toBe('Serment : « Courir », faite hier.');
    },
  );

  given(/^« Courir » a été faite hier$/u, async () => {
    await open();
    await doneYesterday('Courir');
  });

  and(/^le joueur lie aujourd'hui « Courir » à Représailles par un Serment$/u, async () => {
    await swear('retaliation', 'Courir');
  });

  then(/^Représailles n'est pas attisé et coûte 2 Élan$/u, async () => {
    expect(kindledPowers()).toEqual([]);
    expect(powerCost(await firstBattle(), 'retaliation')).toBe(2);
  });

  given(/^le joueur a lié hier « Courir » à Représailles par un Serment$/u, async () => {
    await open();
    world.clock.setToday(YESTERDAY);
    await swear('retaliation', 'Courir');
    world.clock.setToday(TODAY);
  });

  and(/^« Courir » a été faite hier, avant ou après le Serment$/u, async () => {
    await doneYesterday('Courir');
  });

  given(/^Représailles porte le Serment « Courir » depuis avant-hier$/u, async () => {
    await open();
    await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
  });

  and(/^hier, « Lire » a été faite mais pas « Courir »$/u, async () => {
    await doneYesterday('Lire');
  });

  when(
    /^le joueur remplace aujourd'hui « Courir » par « Lire » dans le Serment de Représailles, puis commence une ascension$/u,
    async () => {
      await swear('retaliation', 'Lire');
      await launch('sentinel');
    },
  );

  then(/^Représailles n'est pas attisé dans cette ascension$/u, () => {
    expect(kindledPowers()).toEqual([]);
  });

  and(/^la fiche dit que le nouveau Serment compte dès demain$/u, () => {
    expect(world.camp.oathStandings([habit('Lire')])).toEqual({ retaliation: 'fresh' });
  });

  given(/^Pas de l'ombre est attisé$/u, () => {
    world.battle = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      hero: 'wanderer',
      enemies: ['ghoul'],
      powers: ['shadowStep'],
      kindled: ['shadowStep'],
    }).battle;
  });

  when(/^l'Errante a 2 Élan pendant la phase du héros$/u, () => {
    world.battle = { ...world.battle!, hero: { ...world.battle!.hero, momentum: 2 } };
    expect(world.battle.phase.kind).toBe('hero');
  });

  then(/^elle peut lancer Pas de l'ombre et il lui reste 0 Élan$/u, () => {
    expect(powerAvailability(world.battle!, 'shadowStep')).toEqual({ kind: 'available' });
    const cast = heroAction(world.battle!, {
      action: { kind: 'power', power: 'shadowStep' },
      touchStartedAt: 950,
      releasedAt: 1_000,
    });
    expect(cast.battle.hero.momentum).toBe(0);
  });

  given(
    /^Représailles porte le Serment « Courir » et « Courir » n'a pas été faite hier$/u,
    async () => {
      await open();
      await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
    },
  );

  when(/^le joueur commence une ascension$/u, async () => {
    await launch('sentinel');
  });

  then(/^Représailles coûte 2 Élan, son prix normal, sans marque$/u, async () => {
    expect(kindledPowers()).toEqual([]);
    const { pad } = battleView(await firstBattle());
    const key =
      pad.kind === 'hero' ? pad.powers.find(({ power }) => power === 'retaliation') : null;
    expect(key).toMatchObject({ cost: 2 });
    expect(key).not.toHaveProperty('kindled');
  });

  given(
    /^« Courir » n'était pas faite hier au lancement de la 1re ascension du jour$/u,
    async () => {
      await open();
      await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
      await launch('sentinel');
      expect(kindledPowers()).toEqual([]);
    },
  );

  when(
    /^le joueur coche « Courir » pour hier, puis reprend cette ascension ou en commence une autre le même jour$/u,
    async () => {
      await doneYesterday('Courir');
      await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
      expect(kindledPowers()).toEqual([]);
      world.session.abandon();
      await launch('sentinel');
    },
  );

  then(/^Représailles n'est pas attisé, ni dans l'une ni dans l'autre$/u, () => {
    expect(kindledPowers()).toEqual([]);
  });

  given(/^une ascension lancée avec Représailles attisé$/u, async () => {
    await open();
    await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
    await doneYesterday('Courir');
    await launch('sentinel');
    expect(kindledPowers()).toEqual(['retaliation']);
  });

  when(
    /^le joueur la reprend un autre jour, alors que « Courir » n'a pas été faite la veille$/u,
    async () => {
      world.clock.setToday(TODAY.plusDays(2));
      await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
    },
  );

  then(/^Représailles reste attisé jusqu'à la fin de cette ascension$/u, async () => {
    expect(kindledPowers()).toEqual(['retaliation']);
    expect(powerCost(await firstBattle(), 'retaliation')).toBe(1);
  });

  when(/^le joueur supprime l'habitude « Courir »$/u, async () => {
    await doneYesterday('Courir');
    await launch('sentinel');
    expect(kindledPowers()).toEqual(['retaliation']);
    await world.unitOfWork.run(({ habits }) => habits.remove(habit('Courir')));
    await world.camp.refreshHabits();
  });

  then(
    /^le Serment disparaît, la fiche de Représailles dit « Serment rompu » et Représailles coûte de nouveau 2 Élan$/u,
    () => {
      expect(world.camp.view().oaths.retaliation?.name).toBeNull();
      expect(world.camp.oathStandings([habit('Courir')])).toEqual({ retaliation: 'broken' });
      expect(world.camp.kindledPreview([habit('Courir')]).sentinel).toEqual([]);
    },
  );

  and(/^Représailles peut porter un nouveau Serment, qui compte dès le lendemain$/u, async () => {
    await swear('retaliation', 'Lire');
    expect(world.camp.oathStandings([habit('Lire')])).toEqual({ retaliation: 'fresh' });
  });

  and(
    /^une ascension déjà lancée avec Représailles attisé le garde attisé jusqu'à sa fin$/u,
    () => {
      expect(kindledPowers()).toEqual(['retaliation']);
    },
  );

  // La Sentinelle a 4 pouvoirs débloqués (#236) et laisse Coup de bouclier de côté au lancement.
  given(
    /^Coup de bouclier porte un Serment tenu hier mais n'est pas équipé pour l'ascension$/u,
    async () => {
      await open(['retaliation', 'holdFast', 'shieldBash', 'crushingBlow']);
      await storedOath('shieldBash', 'Lire', BEFORE_YESTERDAY);
      await doneYesterday('Lire');
      expect(world.camp.oathStandings([habit('Lire')])).toEqual({ shieldBash: 'kept' });
    },
  );

  then(/^rien ne change en combat$/u, async () => {
    const ascent = await launch('sentinel', ['bulwark', 'retaliation', 'holdFast']);
    expect(ascent.powers).not.toContain('shieldBash');
    expect(kindledPowers()).toEqual([]);
    expect(await firstBattle()).not.toHaveProperty('kindled');
  });

  given(/^plusieurs Serments tenus ou ratés$/u, async () => {
    await open();
    await doneYesterday('Courir');
    world.clock.setToday(YESTERDAY);
    await swear('retaliation', 'Courir');
    await swear('mist', 'Lire');
    world.clock.setToday(TODAY);
  });

  then(
    /^les Éclats gagnés, les Éclats disponibles et les prix de l'arbre et du Gardien de la flamme sont les mêmes que sans Serment$/u,
    async () => {
      const sworn = world.camp.view();
      const without = campStore();
      for (const [key, value] of world.store.values) {
        if (key !== OATHS_KEY) without.values.set(key, value);
      }
      const { ascentSession: session, camp } = campSetUp(without);
      await session.load();
      await camp.load();
      const plain = camp.view();
      expect(sworn.shardTotal).toBe(plain.shardTotal);
      expect(sworn.availableShards).toBe(plain.availableShards);
      expect(sworn.offer).toEqual(plain.offer);
      expect(sworn.trees).toEqual(plain.trees);
      expect(world.store.writes(CAMP_KEY)).toBe(0);
      expect(world.store.writes(SHARD_TOTAL_KEY)).toBe(0);
    },
  );

  given(/^une ascension sauvegardée avant cette story$/u, async () => {
    await open();
    const { kindled: _, ...before } = startAscent(3, { powers: ['bulwark', 'retaliation'] });
    world.store.values.set(
      ASCENT_KEY,
      JSON.stringify({ version: 1, ascent: before, battle: null }),
    );
  });

  when(/^le joueur la reprend avec un Serment tenu hier$/u, async () => {
    await doneYesterday('Courir');
    await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
    expect(world.camp.oathStandings([habit('Courir')])).toEqual({ retaliation: 'kept' });
  });

  then(/^aucun pouvoir n'est attisé dans cette ascension$/u, async () => {
    expect(kindledPowers()).toEqual([]);
    expect(await firstBattle()).not.toHaveProperty('kindled');
  });

  given(/^une ascension lancée avec Représailles attisé par « Courir »$/u, async () => {
    await open();
    await storedOath('retaliation', 'Courir', BEFORE_YESTERDAY);
    await doneYesterday('Courir');
    await launch('sentinel');
  });

  let exported = '';

  when(/^le journal d'ascension est exporté$/u, () => {
    const log = beginAscentLog(world.session.current()!, TODAY);
    exported = JSON.stringify(
      buildAscentLogExport([{ log: JSON.stringify(log), battles: [] }], {
        appVersion: '0.6.0',
        buildChannel: 'preview',
        exportedOn: TODAY,
      }),
    );
  });

  then(/^il dit que Représailles est attisé, sans le nom « Courir »$/u, () => {
    expect(JSON.parse(exported)).toMatchObject({ ascents: [{ kindled: ['retaliation'] }] });
    expect(exported).not.toMatch(/Courir|habit/u);
  });
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/serment.feature');
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
