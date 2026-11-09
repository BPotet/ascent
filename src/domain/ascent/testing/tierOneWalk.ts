// Stryker disable all: aide de test, jamais du code du jeu ; ses mutants ne mesurent rien.
/**
 * Aide de test (#38, « palier 1 inchangé ») : une ascension rejouée au palier 1, du combat imposé
 * de l'étage 1 au boss, avec des choix fixés par la graine, et le seuil du changement de phase des
 * boss du palier 1. Chaque tirage est écrit dans une ligne de texte, comparée à celle figée sur
 * `develop` à `582cc236`, avant les paliers 2 et 3.
 */
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
  type BattleUpdate,
} from '../../battle/Battle';
import type { BattleEvent } from '../../battle/BattleEvent';
import type { EnemyKind } from '../../battle/combatants';
import { drawIntent, type Intent } from '../../battle/intents';
import { seedRandom, type RandomState } from '../../battle/SeededRandom';
import {
  chooseBoon,
  chooseExit,
  endFloorBattle,
  equipItem,
  startAscent,
  type Ascent,
  type Encounter,
} from '../Ascent';
import { encounterMultiplier, encounterMultipliers } from '../tiers';

/** Le nombre de graines rejouées. */
export const WALKED_SEEDS = 200;

function intentText(intent: Intent): string {
  switch (intent.category) {
    case 'attack':
      return `${intent.attack}:${intent.damage}:${intent.windUpMs}:${intent.feintFraction.toFixed(6)}${
        intent.bleed ? `:b${intent.bleed.damage}x${intent.bleed.rounds}` : ''
      }`;
    case 'guard':
      return `guard+${intent.gain}`;
    case 'raise':
      return `raise${intent.ally}`;
    // Tirées sans manche, les intentions de la marche n'exhument jamais (#258, D6).
    case 'exhume':
      return `exhume${intent.slot}`;
  }
}

/** Les intentions tirées de la première ligne, garde intacte puis entamée, aux dégâts du combat. */
function intentsText(enemies: readonly EnemyKind[], seed: number, damagePercent: number): string {
  return [false, true]
    .map((guardDamaged) => {
      let random: RandomState = seedRandom(seed);
      return enemies
        .slice(0, 3)
        .map((kind) => {
          const drawn = drawIntent(kind, random, {
            fallenAlly: null,
            stunned: false,
            guardDamaged,
            damagePercent,
          });
          random = drawn.random;
          return intentText(drawn.intent);
        })
        .join(',');
    })
    .join('/');
}

function encounterText(encounter: Encounter): string {
  // Les multiplicateurs du combat, comme la session les donne (#244, #257).
  const multipliers = encounterMultipliers(1, encounter);
  const { battle } = startBattle({
    seed: encounter.battleSeed,
    defenseHint: false,
    at: 0,
    enemies: encounter.enemies,
    ...multipliers,
  });
  const fresh = battle.enemies.map((enemy) => `${enemy.maxHp}/${enemy.maxGuard}`).join(',');
  return `${encounter.kind}[${encounter.enemies.join(',')}]#${encounter.battleSeed}{${fresh}}<${intentsText(
    encounter.enemies,
    encounter.battleSeed,
    multipliers.tierMultiplier.hpPercent,
  )}>`;
}

/** Une ascension du palier 1, rejouée de l'étage 1 à la victoire sur le boss, en une ligne. */
export function walkTierOne(seed: number): string {
  const parts: string[] = [];
  let ascent: Ascent = startAscent(seed);
  for (let step = 0; step < 20; step += 1) {
    const { encounter } = ascent;
    if (encounter !== null) {
      parts.push(`f${ascent.floor}:${encounterText(encounter)}`);
      const boss = encounter.kind === 'boss';
      ascent = endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });
      parts.push(`g${ascent.lastGold}/${ascent.gold}:i${ascent.foundItem ?? '-'}`);
      if (boss) return parts.join(' ');
      parts.push(`o${ascent.boonOffer?.join(',') ?? '-'}`);
      if (ascent.foundItem !== null) ascent = equipItem(ascent);
      if (ascent.boonOffer !== null) ascent = chooseBoon(ascent, 0);
    }
    parts.push(`x${ascent.exits.map((exit) => `${exit.kind}${exit.groupSize ?? ''}`).join(',')}`);
    ascent = chooseExit(ascent, (seed + ascent.floor) % ascent.exits.length);
  }
  throw new Error(`The walk of seed ${seed} never reached the boss`);
}

/** Rejoue le combat, le héros attaque à son tour, sans défense, jusqu'à sa première frappe jugée. */
function firstStrike(initial: Battle): Battle {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 300; guard += 1) {
    if (events.some((event) => event.type === 'strikeResolved')) return battle;
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) throw new Error('The battle is stuck');
      update = advance(battle, deadline.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The hero never struck');
}

/** Le changement de phase d'un boss du palier 1, frappé une fois à `hp` PV : ses PV et sa phase. */
export function phaseShiftText(boss: EnemyKind, hp: number): string {
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: [boss],
    tierMultiplier: encounterMultiplier(1, 'boss'),
  });
  const wounded: Battle = {
    ...battle,
    enemies: battle.enemies.map((enemy) => ({ ...enemy, hp, guard: 40 })),
  };
  const struck = firstStrike(wounded).enemies[0]!;
  return `${boss}@${hp}:${struck.hp}:${struck.phase2 === true ? 'p2' : 'p1'}:${struck.guard}`;
}
