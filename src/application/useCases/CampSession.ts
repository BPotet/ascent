import type { Ascent, AscentLaunch } from '../../domain/ascent/Ascent';
import {
  EMPTY_CAMP,
  availableShards,
  campOffer,
  campUnlocks,
  parseCamp,
  serializeCamp,
  unlockAtCamp,
  type Camp,
  type CampOfferEntry,
} from '../../domain/ascent/camp';
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
    };
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
  async unlock(unlock: Unlock): Promise<UnlockResult> {
    if (!this.loaded || this.buying) return 'refused';
    const result = unlockAtCamp(this.camp, this.dependencies.ascentSession.shardTotal(), unlock);
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

  /** Commence une ascension avec les Déblocages du Camp ; rien tant que le Camp n'est pas lu. */
  beginAscent(launch: Omit<AscentLaunch, 'unlocks'>): Ascent | null {
    if (!this.loaded) return null;
    return this.dependencies.ascentSession.begin({ ...launch, unlocks: campUnlocks(this.camp) });
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
