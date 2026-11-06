/**
 * Aide des scénarios du journal des combats (#197) : un combat d'étage mené par la vraie session
 * d'ascension, avec le vrai enregistreur du journal et le vrai stockage des journaux (voir
 * `ascentLogStory`), joué appui par appui sur l'horloge de combat manuelle : chaque frappe en
 * rythme, chaque impact et chaque avancée d'un ennemi demandent au plan du scénario quel appui
 * faire, à quel écart.
 */
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import type { Ascent } from '../../src/domain/ascent/Ascent';
import type { Tier } from '../../src/domain/ascent/tiers';
import type { ExportedAscentLog } from '../../src/domain/ascentLog/AscentLogExport';
import type {
  ActionRecord,
  BattleLog,
  PressRecord,
  RoundRecord,
} from '../../src/domain/ascentLog/BattleLog';
import { POWERS } from '../../src/domain/battle/powers';
import type { Battle, HeroAction } from '../../src/domain/battle/Battle';
import type { BattleEvent, DefenseButton } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { startAscent } from '../../src/domain/ascent/Ascent';
import { lastExport, savedWithLog, type LogStory } from './ascentLogStory';
import { settleStore } from './tiersStory';

/** Un impact à juger : la manche, l'ennemi, l'index de l'impact et son rang dans le combat. */
export interface ImpactToJudge {
  readonly round: number;
  readonly enemy: number;
  readonly index: number;
  /** Le rang de l'impact dans le combat, à partir de 0. */
  readonly count: number;
  readonly battle: Battle;
}

/** Ce que le joueur fait : un appui (bouton, écart en ms par rapport à l'impact), ou rien. */
export type DefensePress = readonly [DefenseButton, number];

export interface FightPlan {
  /** L'écart de l'appui sur « Frapper » de la frappe de rang `count`, `null` : aucun appui. */
  readonly strike?: (count: number, battle: Battle) => number | null;
  /** Les appuis sur l'impact, dans l'ordre ; aucun : le coup est subi. */
  readonly defend?: (impact: ImpactToJudge) => readonly DefensePress[];
  /** Un appui pendant l'avancée de rang `count` d'un ennemi (hors de tout impact), ou rien. */
  readonly stepIn?: (count: number, battle: Battle) => DefenseButton | null;
  /** L'action du héros à son tour ; par défaut, attaquer sa cible. */
  readonly hero?: (battle: Battle) => HeroAction;
  /** Le combat s'arrête là, avant sa fin. */
  readonly until?: (battle: Battle, events: readonly BattleEvent[]) => boolean;
}

/** L'ascension de graine 3 devant le combat d'étage `kind` contre `enemies`, au palier `tier`. */
export function ascentFacing(
  enemies: readonly EnemyKind[],
  {
    tier = 1,
    kind = 'combat',
    hp = 80,
    battleSeed = 3,
  }: {
    readonly tier?: Tier;
    readonly kind?: 'combat' | 'elite' | 'boss';
    readonly hp?: number;
    readonly battleSeed?: number;
  } = {},
): Ascent {
  const ascent = startAscent(3, { hero: 'sentinel' });
  return {
    ...ascent,
    tier,
    floor: kind === 'boss' ? 6 : 3,
    hero: { ...ascent.hero, hp, maxHp: hp },
    encounter: { kind, enemies, battleSeed },
  };
}

/** L'ascension posée devant son combat (journal écrit), reprise : le combat sera neuf. */
export async function facing(story: LogStory, ascent: Ascent): Promise<void> {
  await savedWithLog(story, ascent);
  await story.session.load();
}

const defaultHero = (battle: Battle): HeroAction =>
  battle.hero.momentum >= POWERS.bulwark.cost && !battle.hero.bulwark
    ? { kind: 'power', power: 'bulwark' }
    : { kind: 'attack' };

/**
 * Mène le combat de la session `battleSession` (déjà commencé) selon `plan`, jusqu'à sa fin ou à
 * `plan.until`. Rend les événements publiés.
 */
export async function fight(
  story: LogStory,
  battleSession: BattleSession,
  plan: FightPlan = {},
): Promise<BattleEvent[]> {
  const clock = story.battleClock;
  const events: BattleEvent[] = [];
  battleSession.subscribe((snapshot) => events.push(...snapshot.events));
  const pressed = new Set<string>();
  let strikes = 0;
  let impacts = 0;
  let stepIns = 0;
  const at = (instant: number) => {
    if (instant > clock.now()) clock.advanceTo(instant);
    return Math.max(instant, clock.now());
  };
  for (let guard = 0; guard < 5_000; guard += 1) {
    const { battle } = battleSession.current()!;
    if (battle.phase.kind === 'over' || plan.until?.(battle, events) === true) break;
    const { phase } = battle;
    if (phase.kind === 'hero') {
      const released = at(clock.now() + 50);
      battleSession.heroAction((plan.hero ?? defaultHero)(battle), released - 20, released);
    } else if (phase.kind === 'heroStrike' && !phase.resolved && !pressed.has(`s${phase.since}`)) {
      pressed.add(`s${phase.since}`);
      const offset = plan.strike?.(strikes, battle) ?? null;
      strikes += 1;
      if (offset !== null) battleSession.pressStrike(at(phase.impactAt + offset));
    } else if (phase.kind === 'enemy' && phase.step.kind === 'attack') {
      const { step } = phase;
      const index = step.impacts.findIndex((impact) => impact.outcome === null && !impact.lost);
      const key = `i${step.startedAt}:${index}`;
      if (index >= 0 && !pressed.has(key)) {
        pressed.add(key);
        const impact = { round: battle.round, enemy: step.enemy, index, count: impacts, battle };
        impacts += 1;
        const impactAt = step.impacts[index]!.at;
        for (const [button, offset] of plan.defend?.(impact) ?? []) {
          battleSession.pressDefense(button, at(impactAt + offset));
          await settleStore();
        }
      } else {
        clock.advanceTo(clock.pending()[0]!);
      }
    } else if (phase.kind === 'enemy' && phase.step.kind === 'stepIn') {
      const key = `p${phase.step.since}`;
      const button = pressed.has(key) ? null : (plan.stepIn?.(stepIns, battle) ?? null);
      if (!pressed.has(key)) stepIns += 1;
      pressed.add(key);
      if (button !== null) battleSession.pressDefense(button, at(clock.now() + 10));
      else clock.advanceTo(clock.pending()[0]!);
    } else {
      clock.advanceTo(clock.pending()[0]!);
    }
    await settleStore();
  }
  await settleStore();
  return events;
}

/** Le journal de l'ascension de graine 3 dans le dernier export. */
export function exportedLog(story: LogStory): ExportedAscentLog {
  return lastExport(story).ascents.at(-1) as ExportedAscentLog;
}

/** Le seul combat du dernier export. */
export function exportedBattle(story: LogStory): BattleLog {
  const [battle] = exportedLog(story).battles;
  return battle!;
}

export const actionsOf = (battle: BattleLog): ActionRecord[] =>
  battle.rounds.flatMap((round) => [...round.actions]);

export const pressesOf = (battle: BattleLog): PressRecord[] =>
  actionsOf(battle).flatMap((action) => [...action.presses]);

/** Les types des effets notés, dans les actions et hors des actions. */
export const effectTypesOf = (battle: BattleLog): Set<string> =>
  new Set(
    battle.rounds.flatMap((round: RoundRecord) => [
      ...round.effects.map((effect) => effect.type),
      ...round.actions.flatMap((action) => action.effects.map((effect) => effect.type)),
    ]),
  );
