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
import type { HeroKind } from '../../domain/battle/combatants';
import { basePower, type PowerKind } from '../../domain/battle/powers';
import type { Tier } from '../../domain/ascent/tiers';
import type { Unlock } from '../../domain/ascent/unlocks';
import type { BattleSound } from '../ports/BattleSound';
import type { Haptics } from '../ports/Haptics';
import type { KeyValueStore } from '../ports/KeyValueStore';
import type { AscentSession } from './AscentSession';

/** La clé du Camp (ADR 0017) : chaque Déblocage et le prix payé. Jamais effacée par l'app. */
export const CAMP_KEY = 'camp.unlocks';
/** La copie d'une valeur illisible du Camp, gardée avant que le Camp reparte vide. */
export const UNREADABLE_CAMP_KEY = 'camp.unlocks.unreadable';
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
}

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
    };
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
    this.loaded = true;
    this.publish();
  }

  private publish(): void {
    const view = this.view();
    for (const listener of [...this.listeners]) listener(view);
  }
}
