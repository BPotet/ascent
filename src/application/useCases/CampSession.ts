import type { Ascent, AscentLaunch } from '../../domain/ascent/Ascent';
import {
  EMPTY_CAMP,
  availableShards,
  campOffer,
  campPowers,
  campUnlocks,
  parseCamp,
  serializeCamp,
  unlockAtCamp,
  type Camp,
  type CampOfferEntry,
  type CampPurchase,
} from '../../domain/ascent/camp';
import {
  POWER_TREES,
  equippedPowers,
  powerNodeState,
  unlockPowerAtCamp,
  type PowerNodeState,
  type PowerTreeCode,
} from '../../domain/ascent/powerTree';
import {
  canBearOath,
  kindledPowers,
  oathStanding,
  serializeOaths,
  swearOath,
  type KindledPower,
  type Oath,
  type OathStanding,
} from '../../domain/ascent/oaths';
import type { HeroKind } from '../../domain/battle/combatants';
import { POWERS, basePower, type PowerKind } from '../../domain/battle/powers';
import type { HabitId } from '../../domain/habit/Habit';
import type { Tier } from '../../domain/ascent/tiers';
import type { Unlock } from '../../domain/ascent/unlocks';
import type { BattleSound } from '../ports/BattleSound';
import type { Clock } from '../ports/Clock';
import type { Haptics } from '../ports/Haptics';
import type { KeyValueStore } from '../ports/KeyValueStore';
import type { UnitOfWork } from '../ports/UnitOfWork';
import type { AscentSession } from './AscentSession';
import { CAMP_KEY, UNREADABLE_CAMP_KEY } from './campKeys';
import { OATHS_KEY, UNREADABLE_OATHS_KEY, readOaths } from './oaths';

export { CAMP_KEY, UNREADABLE_CAMP_KEY };
/** Les arbres de pouvoirs ont été ouverts une fois (#235) : le badge « nouveau » s'éteint. */
export const POWER_TREES_SEEN_KEY = 'camp.powerTrees.seen';

/** Un nœud de l'arbre, avec son état. */
export interface PowerTreeNodeView {
  readonly code: PowerTreeCode;
  readonly state: PowerNodeState;
}

/** L'arbre d'un héros (#235) : ses nœuds, dans l'ordre de l'arbre, et le compte des débloqués. */
export interface PowerTreeView {
  readonly nodes: readonly PowerTreeNodeView[];
  /** Les pouvoirs à lui, pouvoir de base compris, sur 5. */
  readonly unlocked: number;
}

export interface CampSessionDependencies {
  readonly keyValueStore: KeyValueStore;
  readonly ascentSession: AscentSession;
  readonly sound: BattleSound;
  readonly haptics: Haptics;
  /** Aujourd'hui : un Serment compte à partir du lendemain du jour où il est prêté (#237). */
  readonly clock: Clock;
  /** Les habitudes, que lient les Serments (#237). */
  readonly unitOfWork: UnitOfWork;
}

/** Une habitude, pour le choix du Serment (#237) : son nom reste sur l'appareil. */
export interface CampHabit {
  readonly id: HabitId;
  readonly name: string;
}

/** Le Serment d'un pouvoir (#237) : son habitude, son nom (`null` s'il est rompu) et son jour. */
export interface CampOath {
  readonly habit: HabitId;
  readonly name: string | null;
  readonly since: string;
}

/** Un Serment prêté : enregistré, en échec (rien n'a changé, on peut réessayer), ou refusé. */
export type SwearResult = 'sworn' | 'failed' | 'refused';

/** Ce que montre le camp : le Total d'Éclats, les Éclats disponibles et les cartes du catalogue. */
export interface CampView {
  readonly status: 'loading' | 'ready';
  readonly shardTotal: number;
  readonly availableShards: number;
  readonly offer: readonly CampOfferEntry[];
  readonly ascentInProgress: boolean;
  /** Le palier et l'étage de l'ascension en cours, pour le bandeau du camp ; `null` sans elle. */
  readonly place: { readonly tier: Tier; readonly floor: number } | null;
  /** Le Camp n'a pas pu être lu, ou sa valeur illisible gardée à part : aucun achat. */
  readonly readOnly: boolean;
  /** Les arbres de pouvoirs des deux héros (#235). */
  readonly trees: Readonly<Record<HeroKind, PowerTreeView>>;
  /** Les pouvoirs équipés d'office de la prochaine ascension, par héros (#235). */
  readonly equipped: Readonly<Record<HeroKind, readonly PowerKind[]>>;
  /** Un arbre a déjà été ouvert : plus de badge « nouveau » (#235). */
  readonly powerTreesSeen: boolean;
  /** Les habitudes, dans l'ordre de création ; `null` si elles n'ont pas pu être lues (#237). */
  readonly habits: readonly CampHabit[] | null;
  /** Les Serments, par pouvoir (#237). */
  readonly oaths: Partial<Readonly<Record<PowerKind, CampOath>>>;
  /** Les pouvoirs qui peuvent porter un Serment : débloqués, ou de base, à 2 Élan ou plus (#237). */
  readonly oathBearers: readonly PowerKind[];
}

/** Un achat : enregistré, en échec (rien n'a changé, on peut réessayer), ou refusé. */
export type UnlockResult = 'unlocked' | 'failed' | 'refused';

type Listener = (view: CampView) => void;

/**
 * La session du camp (`CampSession`, #40, ADR 0017) : elle lit le Camp, calcule les Éclats
 * disponibles à partir du Total d'Éclats de la session d'ascension, et achète un Déblocage en une
 * seule écriture attendue de `camp.unlocks`. Le Total d'Éclats n'est jamais écrit.
 *
 * Elle ne recharge jamais la session d'ascension : le Pied de la tour et le bilan de fin, d'où l'on
 * ouvre le camp, l'ont déjà chargée. Elle est l'unique chemin des Déblocages vers une ascension.
 */
export class CampSession {
  private camp: Camp = EMPTY_CAMP;
  private loading: Promise<void> | null = null;
  private loaded = false;
  private readOnly = false;
  private buying = false;
  private powerTreesSeen = false;
  private habits: readonly CampHabit[] | null = null;
  private oaths: readonly Oath[] = [];
  private oathsReadOnly = false;
  private swearing = false;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly dependencies: CampSessionDependencies) {}

  /** Lit le Camp, une seule fois pour la session. */
  load(): Promise<void> {
    this.loading ??= this.read();
    return this.loading;
  }

  view(): CampView {
    const { ascentSession } = this.dependencies;
    const shardTotal = ascentSession.shardTotal();
    const current = ascentSession.current();
    const ascent = current !== null && current.outcome === null ? current : null;
    return {
      status: this.loaded ? 'ready' : 'loading',
      shardTotal,
      availableShards: availableShards(shardTotal, this.camp),
      offer: campOffer(this.camp, shardTotal, ascent),
      ascentInProgress: ascent !== null,
      place: ascent === null ? null : { tier: ascent.tier, floor: ascent.floor },
      readOnly: this.readOnly,
      trees: this.trees(shardTotal, ascent),
      equipped: {
        sentinel: equippedPowers(this.camp, 'sentinel'),
        wanderer: equippedPowers(this.camp, 'wanderer'),
      },
      powerTreesSeen: this.powerTreesSeen,
      habits: this.habits,
      oaths: Object.fromEntries(
        this.oaths.map(({ power, habit, since }) => [
          power,
          { habit, name: this.habits?.find(({ id }) => id === habit)?.name ?? null, since },
        ]),
      ),
      oathBearers: (Object.keys(POWERS) as PowerKind[]).filter((power) =>
        canBearOath(this.camp, power),
      ),
    };
  }

  private habitIds(): readonly HabitId[] {
    return (this.habits ?? []).map(({ id }) => id);
  }

  /**
   * L'état de chaque Serment aujourd'hui (#237), selon les habitudes faites hier ; `null` pour un
   * état encore inconnu : hier en cours de lecture (`doneYesterday` à `null`) ou habitudes illisibles.
   * Rompu et prêté aujourd'hui se tranchent sans hier.
   */
  oathStandings(
    doneYesterday: readonly HabitId[] | null,
  ): Partial<Record<PowerKind, OathStanding | null>> {
    const today = this.dependencies.clock.today();
    return Object.fromEntries(
      this.oaths.map((oath) => {
        if (this.habits === null) return [oath.power, null];
        const standing = oathStanding(oath, this.habitIds(), doneYesterday ?? [], today);
        const known = doneYesterday !== null || standing === 'broken' || standing === 'fresh';
        return [oath.power, known ? standing : null];
      }),
    );
  }

  /**
   * Les pouvoirs attisés que donnerait un lancement maintenant, par héros (#237), sur ses pouvoirs
   * équipés d'office : aucun tant qu'hier ou les habitudes ne sont pas lus.
   */
  kindledPreview(
    doneYesterday: readonly HabitId[] | null,
  ): Readonly<Record<HeroKind, readonly KindledPower[]>> {
    const kindled = (hero: HeroKind) =>
      this.kindled(equippedPowers(this.camp, hero), doneYesterday);
    return { sentinel: kindled('sentinel'), wanderer: kindled('wanderer') };
  }

  private kindled(
    powers: readonly PowerKind[],
    doneYesterday: readonly HabitId[] | null,
  ): KindledPower[] {
    if (this.habits === null || doneYesterday === null) return [];
    const today = this.dependencies.clock.today();
    return kindledPowers(powers, this.oaths, this.habitIds(), doneYesterday, today);
  }

  /** Relit les habitudes (#237) : après une création, un renommage ou une suppression. */
  async refreshHabits(): Promise<void> {
    this.habits = await this.readHabits();
    this.publish();
  }

  private async readHabits(): Promise<readonly CampHabit[] | null> {
    try {
      const habits = await this.dependencies.unitOfWork.run(({ habits }) => habits.listAll());
      return habits.map(({ id, name }) => ({ id, name: name.value }));
    } catch {
      return null;
    }
  }

  /**
   * Prête le Serment de `power` sur `habit` (#237) : l'écriture de `camp.oaths` est attendue, puis
   * seulement la mémoire change, le camp est publié, le sceau sonne et le téléphone vibre. Un seul
   * Serment à la fois ; habitudes illisibles ou Serments en lecture seule : un échec.
   */
  async swearOath(power: PowerKind, habit: HabitId): Promise<SwearResult> {
    if (!this.loaded || this.swearing) return 'refused';
    if (this.habits === null || this.oathsReadOnly) return 'failed';
    const result = swearOath(this.oaths, {
      camp: this.camp,
      habits: this.habitIds(),
      power,
      habit,
      today: this.dependencies.clock.today(),
    });
    if (result.kind !== 'sworn') return 'refused';
    const { keyValueStore, sound, haptics } = this.dependencies;
    this.swearing = true;
    try {
      await keyValueStore.set(OATHS_KEY, serializeOaths(result.oaths));
    } catch {
      return 'failed';
    } finally {
      this.swearing = false;
    }
    this.oaths = result.oaths;
    this.publish();
    sound.play('seal');
    haptics.success();
    return 'sworn';
  }

  private trees(shardTotal: number, ascent: Ascent | null): Record<HeroKind, PowerTreeView> {
    const owned = campPowers(this.camp);
    const tree = (hero: HeroKind): PowerTreeView => {
      const { base, paths } = POWER_TREES[hero];
      const codes: readonly PowerTreeCode[] = [base, ...paths.flatMap(({ ranks }) => ranks)];
      return {
        nodes: codes.map((code) => ({
          code,
          state: powerNodeState(this.camp, shardTotal, ascent, code),
        })),
        unlocked: codes.filter(
          (code) => code === basePower(hero) || owned.includes(code as PowerKind),
        ).length,
      };
    };
    return { sentinel: tree('sentinel'), wanderer: tree('wanderer') };
  }

  /**
   * Prévient `listener` à chaque changement du camp, d'une ascension (sa fin fait passer « Dès ta
   * prochaine ascension » à « Déjà dans la tour ») ou des Éclats gagnés.
   */
  subscribe(listener: Listener): () => void {
    const { ascentSession } = this.dependencies;
    const notify = () => listener(this.view());
    this.listeners.add(listener);
    const stopAscent = ascentSession.subscribe(notify);
    const stopShards = ascentSession.subscribeShards(notify);
    return () => {
      this.listeners.delete(listener);
      stopAscent();
      stopShards();
    };
  }

  /**
   * Achète `unlock` : l'écriture est attendue, puis seulement la mémoire change, le camp est publié,
   * le son de flamme joue et le téléphone vibre. Un seul achat à la fois.
   */
  unlock(unlock: Unlock): Promise<UnlockResult> {
    return this.buy((camp, shardTotal) => unlockAtCamp(camp, shardTotal, unlock));
  }

  /**
   * Débloque `power` dans l'arbre de pouvoirs (#235) : la même écriture attendue de `camp.unlocks`,
   * tout ou rien, le même son et la même vibration. Un achat à la fois.
   */
  unlockPower(power: PowerTreeCode): Promise<UnlockResult> {
    return this.buy((camp, shardTotal) => unlockPowerAtCamp(camp, shardTotal, power));
  }

  /** Un arbre de pouvoirs est ouvert : le badge « nouveau » s'éteint, pour de bon s'il s'écrit. */
  async markPowerTreesSeen(): Promise<void> {
    if (this.powerTreesSeen) return;
    this.powerTreesSeen = true;
    this.publish();
    // Un échec d'écriture n'empêche rien : le badge reviendra à la prochaine visite.
    await this.dependencies.keyValueStore.set(POWER_TREES_SEEN_KEY, '1').catch(() => undefined);
  }

  private async buy(
    purchase: (camp: Camp, shardTotal: number) => CampPurchase,
  ): Promise<UnlockResult> {
    if (!this.loaded || this.buying) return 'refused';
    const result = purchase(this.camp, this.dependencies.ascentSession.shardTotal());
    if (result.kind !== 'unlocked') return 'refused';
    if (this.readOnly) return 'failed';
    const { keyValueStore, sound, haptics } = this.dependencies;
    this.buying = true;
    try {
      await keyValueStore.set(CAMP_KEY, serializeCamp(result.camp));
    } catch {
      return 'failed';
    } finally {
      this.buying = false;
    }
    this.camp = result.camp;
    this.publish();
    sound.play('burnCrackle');
    haptics.success();
    return 'unlocked';
  }

  /**
   * Commence une ascension avec les Déblocages du Camp et les pouvoirs équipés du héros (#235),
   * fixés jusqu'à sa fin ; rien tant que le Camp n'est pas lu.
   */
  beginAscent(launch: Omit<AscentLaunch, 'unlocks' | 'powers'>): Ascent | null {
    if (!this.loaded) return null;
    return this.dependencies.ascentSession.begin({
      ...launch,
      unlocks: campUnlocks(this.camp),
      powers: equippedPowers(this.camp, launch.hero ?? 'sentinel'),
    });
  }

  private async read(): Promise<void> {
    const { keyValueStore } = this.dependencies;
    let raw: string | null = null;
    try {
      raw = await keyValueStore.get(CAMP_KEY);
    } catch {
      // Illisible pour cette session : rien ne s'achète, la valeur stockée n'est jamais écrasée.
      this.readOnly = true;
    }
    const { camp, unreadable } = parseCamp(raw);
    this.camp = camp;
    this.powerTreesSeen = await keyValueStore.get(POWER_TREES_SEEN_KEY).then(
      (seen) => seen !== null,
      () => false,
    );
    if (unreadable && raw !== null) {
      // La valeur illisible est d'abord gardée à part ; sinon, le camp reste en lecture seule.
      this.readOnly = await keyValueStore.set(UNREADABLE_CAMP_KEY, raw).then(
        () => false,
        () => true,
      );
    }
    await this.readOaths();
    this.habits = await this.readHabits();
    this.loaded = true;
    this.publish();
  }

  /** Lit les Serments (#237), comme le Camp : une valeur illisible est gardée à part d'abord. */
  private async readOaths(): Promise<void> {
    const { keyValueStore } = this.dependencies;
    try {
      const { oaths, unreadable, raw } = await readOaths(keyValueStore, this.camp);
      this.oaths = oaths;
      if (unreadable && raw !== null) {
        this.oathsReadOnly = await keyValueStore.set(UNREADABLE_OATHS_KEY, raw).then(
          () => false,
          () => true,
        );
      }
    } catch {
      // Illisibles pour cette session : aucun Serment ne se prête, la valeur n'est jamais écrasée.
      this.oathsReadOnly = true;
    }
  }

  private publish(): void {
    const view = this.view();
    for (const listener of [...this.listeners]) listener(view);
  }
}
