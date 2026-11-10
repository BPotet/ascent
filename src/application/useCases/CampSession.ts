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
  equippedSlots,
  isEquippedChoice,
  newPowerStanding,
  ownedPowers,
  parseEquippedPowersMemory,
  parseNewPowers,
  preselectedPowers,
  rememberEquippedPowers,
  serializeEquippedPowersMemory,
  serializeNewPowers,
  toggleEquippedPower,
  type EquippedPowerToggle,
  type EquippedPowersMemory,
  type NewPowerStanding,
} from '../../domain/ascent/equippedPowers';
import {
  EQUIPPED_POWER_SLOTS,
  POWER_TREES,
  powerNodeState,
  unlockPowerAtCamp,
  type PowerNodeState,
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
import {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  NEW_POWERS_KEY,
  POWERS_CARD_SEEN_KEY,
  POWERS_MENU_SEEN_KEY,
  UNREADABLE_CAMP_KEY,
} from './campKeys';
import { OATHS_KEY, UNREADABLE_OATHS_KEY, readOaths } from './oaths';

export {
  CAMP_KEY,
  EQUIPPED_POWERS_KEY,
  NEW_POWERS_KEY,
  POWERS_CARD_SEEN_KEY,
  POWERS_MENU_SEEN_KEY,
  UNREADABLE_CAMP_KEY,
};
/** Les arbres de pouvoirs ont été ouverts une fois (#235) : le badge « nouveau » s'éteint. */
export const POWER_TREES_SEEN_KEY = 'camp.powerTrees.seen';

/** Un nœud de l'arbre, avec son état. */
export interface PowerTreeNodeView {
  readonly code: PowerKind;
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
  /**
   * La présélection des pouvoirs équipés de la prochaine ascension, par héros (#236) : le dernier
   * choix validé au menu des pouvoirs (#270) ou lancé, s'il est valide, sinon les pouvoirs équipés
   * d'office (#235) ; dans l'ordre de l'arbre.
   */
  readonly equipped: Readonly<Record<HeroKind, readonly PowerKind[]>>;
  /** Le nombre de « Valider » qui ont écrit la mémoire, dans cette session (#270, T5). */
  readonly equippedRevision: number;
  /**
   * Les pouvoirs nouveaux de chaque héros (#270), débloqués et pas encore vus dans le menu des
   * pouvoirs : équipés tout seuls (M8), ou en attente d'une place (T4, M9).
   */
  readonly newPowers: Readonly<Record<HeroKind, NewPowerStanding>>;
  /** Le menu des pouvoirs a déjà été ouvert hors ascension : plus de bandeau de première ouverture (#270, M12). */
  readonly powersMenuSeen: boolean;
  /** La carte « Pouvoirs équipés » a déjà été vue : plus de « nouveau » (#270, T8). */
  readonly powersCardSeen: boolean;
  /** Les pouvoirs possédés, par héros (#236) : son pouvoir de base et ses débloqués, dans l'ordre de l'arbre. */
  readonly owned: Readonly<Record<HeroKind, readonly PowerKind[]>>;
  /** Le nombre de pouvoirs équipés de chaque héros : min(3, possédés) (#270, `equippedSlots`). */
  readonly slots: Readonly<Record<HeroKind, number>>;
  /** Un arbre a déjà été ouvert : plus de badge « nouveau » (#235). */
  readonly powerTreesSeen: boolean;
  /** Les habitudes, dans l'ordre de création ; `null` tant qu'elles ne sont pas lues (#237). */
  readonly habits: readonly CampHabit[] | null;
  /** Les Serments, par pouvoir (#237). */
  readonly oaths: Partial<Readonly<Record<PowerKind, CampOath>>>;
  /** Les pouvoirs qui peuvent porter un Serment : débloqués, ou de base, à 2 Élan ou plus (#237). */
  readonly oathBearers: readonly PowerKind[];
}

/** Un achat : enregistré, en échec (rien n'a changé, on peut réessayer), ou refusé. */
export type UnlockResult = 'unlocked' | 'failed' | 'refused';

/**
 * Un « Valider » du menu des pouvoirs (#270, D2) : enregistré ; en échec (la mémoire n'a pas changé,
 * on peut réessayer) ; ou refusé (Camp pas lu, ascension en cours, choix non valide, la mémoire déjà
 * en cours d'écriture).
 */
export type EquipResult = 'equipped' | 'failed' | 'refused';

/**
 * Un lancement (#236, D3) : l'ascension commencée ; un échec de l'écriture du choix (rien n'a
 * commencé, la mémoire n'a pas changé, on peut réessayer) ; ou un refus (Camp pas lu, choix non
 * valide, un lancement déjà en cours).
 */
export type LaunchResult =
  | { readonly kind: 'begun'; readonly ascent: Ascent }
  | { readonly kind: 'failed' }
  | { readonly kind: 'refused' };

/** Ce que reçoit un lancement : les pouvoirs choisis (la présélection par défaut) et hier. */
export type CampLaunch = Omit<AscentLaunch, 'unlocks' | 'powers' | 'kindled'> & {
  readonly powers?: readonly PowerKind[];
  readonly doneYesterday?: readonly HabitId[];
};

const sameChoice = (left: readonly PowerKind[], right: readonly PowerKind[]) =>
  left.length === right.length && left.every((power) => right.includes(power));

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
  private memory: EquippedPowersMemory = {};
  /**
   * Une écriture attendue de la mémoire des pouvoirs équipés est en cours : un « Valider » (#270) ou un
   * lancement. Le verrou commun de `camp.equippedPowers` : ils n'écrivent jamais en même temps.
   */
  private writingMemory = false;
  private equippedRevision = 0;
  private newPowers: readonly PowerKind[] = [];
  private powersMenuSeen = false;
  private powersCardSeen = false;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly dependencies: CampSessionDependencies) {}

  /**
   * Lit le Camp, une seule fois pour la session, et les habitudes (#237) à côté : le camp est prêt
   * dès qu'il est lu, sans attendre les habitudes, qui manquent jusque-là (aucun Serment, aucun
   * attisé).
   */
  load(): Promise<void> {
    this.loading ??= Promise.all([this.read(), this.refreshHabits()]).then(() => undefined);
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
      equipped: { sentinel: this.preselected('sentinel'), wanderer: this.preselected('wanderer') },
      equippedRevision: this.equippedRevision,
      newPowers: {
        sentinel: newPowerStanding(this.preselected('sentinel'), this.newPowers, 'sentinel'),
        wanderer: newPowerStanding(this.preselected('wanderer'), this.newPowers, 'wanderer'),
      },
      powersMenuSeen: this.powersMenuSeen,
      powersCardSeen: this.powersCardSeen,
      owned: {
        sentinel: ownedPowers(this.camp, 'sentinel'),
        wanderer: ownedPowers(this.camp, 'wanderer'),
      },
      slots: {
        sentinel: equippedSlots(this.camp, 'sentinel'),
        wanderer: equippedSlots(this.camp, 'wanderer'),
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

  private preselected(hero: HeroKind): readonly PowerKind[] {
    return preselectedPowers(this.camp, this.memory, hero);
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
   * Les pouvoirs attisés que donnerait un lancement maintenant, par héros (#237), sur les pouvoirs
   * choisis (`powers`, #236), la présélection sinon : aucun tant qu'hier ou les habitudes ne sont
   * pas lus.
   */
  kindledPreview(
    doneYesterday: readonly HabitId[] | null,
    powers: Partial<Readonly<Record<HeroKind, readonly PowerKind[]>>> = {},
  ): Readonly<Record<HeroKind, readonly KindledPower[]>> {
    const kindled = (hero: HeroKind) =>
      this.kindled(powers[hero] ?? this.preselected(hero), doneYesterday);
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
      const codes: readonly PowerKind[] = [base, ...paths.flatMap(({ ranks }) => ranks)];
      return {
        nodes: codes.map((code) => ({
          code,
          state: powerNodeState(this.camp, shardTotal, ascent, code),
        })),
        unlocked: codes.filter((code) => code === basePower(hero) || owned.includes(code)).length,
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
   * tout ou rien, le même son et la même vibration. Un achat à la fois. Débloqué, il devient un
   * pouvoir nouveau (#270, D3) : `camp.newPowers` s'écrit ensuite, sans être attendu, et son échec
   * est ignoré.
   */
  async unlockPower(power: PowerKind): Promise<UnlockResult> {
    const result = await this.buy((camp, shardTotal) => unlockPowerAtCamp(camp, shardTotal, power));
    if (result === 'unlocked') {
      this.newPowers = [...this.newPowers, power];
      this.publish();
      this.writeNewPowers();
    }
    return result;
  }

  private writeNewPowers(): void {
    // Une commodité : sans elle, le pouvoir ne se dit pas « nouveau », c'est tout.
    this.dependencies.keyValueStore
      .set(NEW_POWERS_KEY, serializeNewPowers(this.newPowers))
      .catch(() => undefined);
  }

  /**
   * Le menu des pouvoirs est ouvert (#270, D3) : les pouvoirs nouveaux sont vus, et le bandeau de la
   * première ouverture s'éteint. Rien pendant une ascension : le menu y est en lecture seule, et un
   * pouvoir débloqué en cours d'ascension reste nouveau pour la suivante. Les écritures ne sont pas
   * attendues ; un échec les fera revenir à la prochaine ouverture.
   */
  async markPowersMenuSeen(): Promise<void> {
    if (this.inProgress() || (this.powersMenuSeen && this.newPowers.length === 0)) return;
    const { keyValueStore } = this.dependencies;
    const writes: Promise<void>[] = [];
    if (this.newPowers.length > 0) {
      this.newPowers = [];
      writes.push(keyValueStore.set(NEW_POWERS_KEY, serializeNewPowers([])));
    }
    if (!this.powersMenuSeen) {
      this.powersMenuSeen = true;
      writes.push(keyValueStore.set(POWERS_MENU_SEEN_KEY, '1'));
    }
    this.publish();
    await Promise.all(writes.map((write) => write.catch(() => undefined)));
  }

  /** La carte « Pouvoirs équipés » est vue (#270, T8) : son « nouveau » s'éteint. */
  async markPowersCardSeen(): Promise<void> {
    if (this.powersCardSeen) return;
    this.powersCardSeen = true;
    this.publish();
    await this.dependencies.keyValueStore.set(POWERS_CARD_SEEN_KEY, '1').catch(() => undefined);
  }

  /**
   * Un toucher sur la ligne de `power` dans le brouillon `draft` du menu des pouvoirs (#270, D4) :
   * la règle de la case (`toggleEquippedPower`) sur les pouvoirs possédés du Camp.
   */
  toggleEquippedPower(
    hero: HeroKind,
    draft: readonly PowerKind[],
    power: PowerKind,
  ): EquippedPowerToggle {
    return toggleEquippedPower(this.camp, hero, draft, power);
  }

  /**
   * « Valider » au menu des pouvoirs (#270, D2, ADR 0026) : le choix des deux héros devient la
   * mémoire des pouvoirs équipés, en une seule écriture attendue de `camp.equippedPowers`, dans
   * l'ordre de l'arbre. Un héros à 3 pouvoirs ou moins est mémorisé lui aussi. Un choix égal à la
   * mémoire n'écrit rien. Un échec ne change ni la mémoire ni la vue. Jamais pendant une ascension,
   * ni pendant une autre écriture de la mémoire (un lancement compris).
   */
  async equipPowers(
    choice: Readonly<Record<HeroKind, readonly PowerKind[]>>,
  ): Promise<EquipResult> {
    if (!this.loaded || this.writingMemory || this.inProgress()) return 'refused';
    const heroes: readonly HeroKind[] = ['sentinel', 'wanderer'];
    if (!heroes.every((hero) => isEquippedChoice(this.camp, hero, choice[hero]))) return 'refused';
    if (heroes.every((hero) => sameChoice(this.memory[hero] ?? [], choice[hero]))) {
      return 'equipped';
    }
    const memory = heroes.reduce(
      (remembered, hero) => rememberEquippedPowers(remembered, hero, choice[hero]),
      this.memory,
    );
    this.writingMemory = true;
    try {
      await this.dependencies.keyValueStore.set(
        EQUIPPED_POWERS_KEY,
        serializeEquippedPowersMemory(memory),
      );
    } catch {
      return 'failed';
    } finally {
      this.writingMemory = false;
    }
    this.memory = memory;
    this.equippedRevision += 1;
    this.publish();
    return 'equipped';
  }

  private inProgress(): boolean {
    const current = this.dependencies.ascentSession.current();
    return current !== null && current.outcome === null;
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
   * Lance une ascension (#236, D3) avec les pouvoirs choisis (la présélection par défaut), validés.
   * Pour un vrai choix (4 pouvoirs possédés ou plus) qui change la mémoire, l'écriture de
   * `camp.equippedPowers` est attendue : un échec ne commence rien et ne change pas la mémoire. Avec
   * 3 pouvoirs possédés ou moins, elle part sans être attendue, et son échec est ignoré. Un lancement
   * à la fois, jamais pendant l'écriture d'un « Valider » (#270, le verrou commun de la mémoire).
   * L'écriture non attendue ne pose pas ce verrou : l'ascension commence aussitôt, et un « Valider »
   * est alors refusé (ascension en cours).
   */
  async launchAscent({ powers, ...launch }: CampLaunch): Promise<LaunchResult> {
    if (!this.loaded || this.writingMemory) return { kind: 'refused' };
    const hero = launch.hero ?? 'sentinel';
    const chosen = powers ?? this.preselected(hero);
    if (!isEquippedChoice(this.camp, hero, chosen)) return { kind: 'refused' };
    if (!sameChoice(this.memory[hero] ?? [], chosen)) {
      const memory = rememberEquippedPowers(this.memory, hero, chosen);
      const write = this.dependencies.keyValueStore.set(
        EQUIPPED_POWERS_KEY,
        serializeEquippedPowersMemory(memory),
      );
      if (ownedPowers(this.camp, hero).length > EQUIPPED_POWER_SLOTS) {
        this.writingMemory = true;
        try {
          await write;
        } catch {
          return { kind: 'failed' };
        } finally {
          this.writingMemory = false;
        }
      } else {
        // Une commodité de présélection : la suivante réessaiera.
        write.catch(() => undefined);
      }
      this.memory = memory;
    }
    const ascent = this.beginAscent({ ...launch, powers: chosen });
    return ascent === null ? { kind: 'refused' } : { kind: 'begun', ascent };
  }

  /**
   * Commence une ascension avec les Déblocages du Camp, les pouvoirs choisis du héros (#236, la
   * présélection par défaut ; `null` s'ils ne sont pas un choix valide) et ceux que ses Serments
   * attisent parmi eux (#237), selon les habitudes faites hier de la jauge scellée (`doneYesterday`,
   * aucune par défaut) : tout est fixé jusqu'à sa fin. Rien tant que le Camp n'est pas lu.
   */
  beginAscent({ doneYesterday = [], powers: chosen, ...launch }: CampLaunch): Ascent | null {
    if (!this.loaded) return null;
    const hero = launch.hero ?? 'sentinel';
    const powers = chosen ?? this.preselected(hero);
    if (!isEquippedChoice(this.camp, hero, powers)) return null;
    return this.dependencies.ascentSession.begin({
      ...launch,
      unlocks: campUnlocks(this.camp),
      powers,
      kindled: this.kindled(powers, doneYesterday),
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
    this.powerTreesSeen = await this.flag(POWER_TREES_SEEN_KEY);
    if (unreadable && raw !== null) {
      // La valeur illisible est d'abord gardée à part ; sinon, le camp reste en lecture seule.
      this.readOnly = await keyValueStore.set(UNREADABLE_CAMP_KEY, raw).then(
        () => false,
        () => true,
      );
    }
    await this.readOaths();
    // Une commodité de présélection (#236) : illisible ou en panne, aucune mémoire, sans copie.
    this.memory = await keyValueStore
      .get(EQUIPPED_POWERS_KEY)
      .then(parseEquippedPowersMemory, () => ({}));
    // Les marques « nouveau » du menu des pouvoirs (#270, D3) : illisibles ou en panne, leur valeur
    // par défaut, sans copie à part. Un pouvoir nouveau que le Camp n'a pas est ignoré.
    const owned = campPowers(this.camp);
    this.newPowers = await keyValueStore.get(NEW_POWERS_KEY).then(
      (raw) => parseNewPowers(raw).filter((power) => owned.includes(power)),
      () => [],
    );
    this.powersMenuSeen = await this.flag(POWERS_MENU_SEEN_KEY);
    this.powersCardSeen = await this.flag(POWERS_CARD_SEEN_KEY);
    this.loaded = true;
    this.publish();
  }

  /** Un drapeau « déjà vu » : posé s'il est stocké ; absent ou illisible, pas encore vu. */
  private flag(key: string): Promise<boolean> {
    return this.dependencies.keyValueStore.get(key).then(
      (seen) => seen !== null,
      () => false,
    );
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
