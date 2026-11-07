import { useEffect, useReducer } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  BURN_AFTER_BLEED_MS,
  BURN_OUT_AFTER_BLOW_MS,
  BURN_OUT_AFTER_CRACKLE_MS,
  bledIn,
  summonEntryDelay,
} from '../../../application/useCases/battleFeedback';
import type { BattleSession, BattleSnapshot } from '../../../application/useCases/BattleSession';
import type { Battle } from '../../../domain/battle/Battle';
import type { BattleEvent, BlowOutcome } from '../../../domain/battle/BattleEvent';
import type { BurnRing } from '../battle/BurnChip';
import type { HeroPose, SceneBurn, SceneSpark } from '../battle/sceneTypes';
import {
  announcementsFor,
  damageFloat,
  feedbackText,
  secondChanceBannerText,
  summonBannerText,
  type DamageFloat,
  type FeedbackText,
} from '../format/battleText';

/** L'état d'affichage de l'écran de combat, tiré des événements de combat. */
export interface BattleDisplay {
  readonly snapshot: BattleSnapshot | null;
  /** Les derniers mots du combat (« Parfait », « Frappe parfaite », « Cassure »). */
  readonly feedback: { readonly texts: readonly FeedbackText[]; readonly key: number } | null;
  /** Le dernier chiffre qui s'envole (« −4 », « +3 »). */
  readonly float: { readonly float: DamageFloat; readonly key: number } | null;
  readonly heroPose: HeroPose;
  /** L'instant où la pose du héros a commencé, pour ses images. */
  readonly heroPoseSince: number;
  /** La dernière étincelle de parade : dorée (parfaite), bleu acier (bonne). */
  readonly spark: SceneSpark | null;
  /** L'instant du dernier coup reçu (vignette rouge), jamais avec « réduire les animations ». */
  readonly hurtAt: number | null;
  /** L'instant de la chute de chaque ennemi brisé, par place. */
  readonly downSince: Readonly<Record<number, number>>;
  /** Le nombre de renforts entrés à chaque place : un renfort a sa propre colonne. */
  readonly arrivals: Readonly<Record<number, number>>;
  readonly shakeKey: number;
  /** L'instant où le Rempart s'est usé (#128), jusqu'à la fin du coup ; `null` sinon. */
  readonly bulwarkWornAt: number | null;
  /** La dernière Riposte du Rempart (#128) : l'onde va de l'écu à l'ennemi qui a frappé. */
  readonly riposte: { readonly at: number; readonly enemy: number } | null;
  /**
   * Le dernier chiffre sur le héros : il reste visible quand un chiffre sur un ennemi part au même
   * instant (le touché qui use le Rempart, puis la riposte, #128).
   */
  readonly heroFloat: { readonly float: DamageFloat; readonly key: number } | null;
  /** L'instant du dernier lancer instantané de Pas de l'ombre (#173) : son ombre glisse. */
  readonly shadowStepAt: number | null;
  /** L'instant du dernier soin de Tenir bon (#235, K12) : le halo d'or ; `null` sinon. */
  readonly healedAt: number | null;
  /** La dernière contre-attaque renforcée par Représailles (#235) : l'éclat d'or sur l'ennemi. */
  readonly retaliation: { readonly at: number; readonly enemy: number } | null;
  /** La dernière prise et la dernière extinction de la Brûlure, pour la scène (#171). */
  readonly burnFx: Pick<SceneBurn, 'lit' | 'ticked' | 'out'>;
  /** Le dernier cercle de l'étiquette de la Brûlure (#171). */
  readonly burnRing: BurnRing | null;
  /** Le dernier « −N » de la Brûlure, à part des autres chiffres sur le héros (#171). */
  readonly burnFloat: {
    readonly float: DamageFloat;
    readonly key: number;
    readonly delayMs: number;
  } | null;
  /** La dernière annonce de l'Invocation (#172) : « Elle appelle les Phalénides ». */
  readonly summonBanner: {
    readonly key: number;
    readonly at: number;
    readonly title: string;
    readonly line: string;
  } | null;
  /**
   * L'Invocation sur la scène (#172) : l'instant de l'annonce (la poussière se lève), puis, par
   * place, l'instant où l'invoqué sort de la poussière et celui où il y retombe avec son boss.
   */
  readonly summonFx: {
    readonly calledAt: number | null;
    readonly entered: Readonly<Record<number, number>>;
    readonly fell: Readonly<Record<number, number>>;
  };
  /**
   * Le dernier relèvement de la seconde chance (#206, S2, S3) : de `at` à la fin du bandeau, son
   * titre et ses lignes, et le « +40 » en or qui part après le gel.
   */
  readonly secondChance: {
    readonly key: number;
    readonly at: number;
    readonly until: number;
    readonly title: string;
    readonly lines: readonly string[];
    readonly float: DamageFloat;
  } | null;
}

export const INITIAL_DISPLAY: BattleDisplay = {
  snapshot: null,
  feedback: null,
  float: null,
  heroPose: 'idle',
  heroPoseSince: 0,
  spark: null,
  hurtAt: null,
  downSince: {},
  arrivals: {},
  shakeKey: 0,
  bulwarkWornAt: null,
  riposte: null,
  heroFloat: null,
  shadowStepAt: null,
  healedAt: null,
  retaliation: null,
  burnFx: { lit: null, ticked: null, out: null },
  burnRing: null,
  burnFloat: null,
  summonBanner: null,
  summonFx: { calledAt: null, entered: {}, fell: {} },
  secondChance: null,
};

const POSE_OF_OUTCOME: Readonly<Record<BlowOutcome, HeroPose>> = {
  perfectParry: 'counter',
  parry: 'parry',
  dodge: 'dodge',
  perilousParry: 'hit',
  suffered: 'hit',
};

/** Le premier coup de Frappe furtive commence (#236) : l'esquive et l'ombre de Pas de l'ombre. */
function ambushOpens(event: BattleEvent): boolean {
  return event.type === 'strikeStarted' && event.power === 'ambush' && (event.hit ?? 1) === 1;
}

/** La pose du héros après un événement, ou `null` s'il ne la change pas. */
function poseAfter(event: BattleEvent, pose: HeroPose): HeroPose | null {
  switch (event.type) {
    case 'blowResolved':
      return POSE_OF_OUTCOME[event.outcome];
    case 'whiffed':
      return 'off';
    // Une frappe de pouvoir (#236) : Fracas abat sa lame chargée, Coup de bouclier frappe de l'écu.
    case 'strikeResolved':
      return event.power === 'crushingBlow'
        ? 'crush'
        : event.power === 'shieldBash'
          ? 'bash'
          : 'strike';
    case 'counterAttacked':
      return 'strike';
    // Le coup de bouclier, sur place (#128).
    case 'bulwarkCountered':
      return 'bash';
    // Le lancer d'un pouvoir instantané : les lames levées (#173) ; Tenir bon aussi, l'arme levée
    // qui brille (#235, K12). Le Rempart garde sa pose.
    case 'powerUsed':
      return event.instant === true || event.power === 'holdFast' ? 'cast' : null;
    // La préparation : la lame chargée de Fracas, l'esquive dans l'ombre de Frappe furtive (#236).
    case 'strikeStarted':
      return event.power === 'crushingBlow'
        ? 'crushRaise'
        : ambushOpens(event)
          ? 'ambushRaise'
          : 'raise';
    // Un coup reçu reste visible pendant l'avancée suivante ou la transition vers le héros.
    case 'windUpStarted':
    case 'heroPhaseStarted':
      return 'idle';
    case 'phaseTransitionStarted':
      return event.to === 'enemy' ? 'idle' : null;
    case 'offBalanceEnded':
      return pose === 'off' ? 'idle' : null;
    case 'battleEnded':
      return event.outcome === 'defeat' ? 'fallen' : 'idle';
    // Le héros tombé se relève sur la scène après le gel (#206).
    case 'secondChanceUsed':
      return 'fallen';
    default:
      return null;
  }
}

/** L'étincelle d'une parade : dorée à rayons pour une parade parfaite, bleu acier pour une bonne. */
function sparkOf(event: BattleEvent): SceneSpark | null {
  if (event.type !== 'blowResolved') return null;
  if (event.outcome === 'perfectParry') return { kind: 'gold', at: event.at };
  return event.outcome === 'parry' ? { kind: 'steel', at: event.at } : null;
}

/** Un coup reçu : la vignette rouge et la secousse. */
function hurts(event: BattleEvent): boolean {
  return (
    event.type === 'blowResolved' &&
    (event.outcome === 'suffered' || event.outcome === 'perilousParry')
  );
}

/**
 * Les mots d'une mise à jour : « Frappe parfaite » puis « Cassure » quand la frappe brise la garde
 * (F4, F5) ; « Cassure » seul quand c'est la contre-attaque (P3b) ou la riposte (#128).
 */
function wordsOf(events: readonly BattleEvent[], battle: Battle): FeedbackText[] {
  const texts = events.flatMap((event) => feedbackText(event, battle) ?? []);
  const broken = texts.some((text) => text.tone === 'break');
  return broken
    ? texts.filter((text) => text.title !== 'Parfait · contre-attaque' && text.tone !== 'riposte')
    : texts;
}

/** Les événements qui finissent un coup ennemi : « Rempart usé » disparaît (#128). */
const BLOW_ENDS: ReadonlySet<BattleEvent['type']> = new Set([
  'stepInStarted',
  'windUpStarted',
  'phaseTransitionStarted',
  'heroPhaseStarted',
  'battleEnded',
]);

/** L'instant d'usure du Rempart après un événement : posé à l'usure, oublié à la fin du coup. */
function bulwarkWornAfter(event: BattleEvent, wornAt: number | null): number | null {
  if (event.type === 'bulwarkWorn') return event.at;
  return BLOW_ENDS.has(event.type) ? null : wornAt;
}

const nextRing = (display: BattleDisplay, kind: BurnRing['kind']): BurnRing => ({
  kind,
  key: (display.burnRing?.key ?? 0) + 1,
});

/**
 * La Brûlure d'un événement (#171) : les flammes allumées depuis la 1re nouvelle charge ; au début
 * d'une manche, `afterBleed` ms après le Saignement (B5), les flammes grandissent avec le
 * crépitement, puis la dernière part en fumée 800 ms plus tard ; après une parade parfaite ou une
 * esquive, 80 ms après son son ; toutes ensemble à la fin du combat (les charges d'avant, lues dans
 * la mise à jour précédente). L'étiquette est cerclée à chaque prise et extinction.
 */
function burnAfter(
  display: BattleDisplay,
  event: BattleEvent,
  burnBefore: number,
  afterBleed: number,
): BattleDisplay {
  switch (event.type) {
    case 'heroBurning':
      return {
        ...display,
        burnFx: { ...display.burnFx, lit: { at: event.at, from: event.stacks - event.added } },
        burnRing: nextRing(display, 'new'),
      };
    case 'burnTicked':
      return { ...display, burnFx: { ...display.burnFx, ticked: event.at + afterBleed } };
    case 'burnExtinguished': {
      const delay =
        event.cause === 'blow' ? BURN_OUT_AFTER_BLOW_MS : afterBleed + BURN_OUT_AFTER_CRACKLE_MS;
      return {
        ...display,
        burnFx: { ...display.burnFx, out: { at: event.at + delay, slots: [event.stacks] } },
        burnRing: nextRing(display, 'down'),
      };
    }
    case 'burnCleared':
      return {
        ...display,
        burnFx: {
          ...display.burnFx,
          out: { at: event.at, slots: Array.from({ length: burnBefore }, (_, slot) => slot) },
        },
      };
    default:
      return display;
  }
}

/**
 * L'Invocation d'un événement (#172) : l'annonce et la poussière qui se lève ; la sortie de chaque
 * invoqué, dans sa propre colonne, après le Saignement et la Brûlure de la manche (`afterRound`,
 * comme son bruissement) ; sa chute avec le boss.
 */
function summonAfter(
  display: BattleDisplay,
  event: BattleEvent,
  battle: BattleSnapshot['battle'],
  afterRound: number,
): BattleDisplay {
  const { summonFx } = display;
  switch (event.type) {
    case 'summonCalled': {
      const summoner = battle.enemies[event.enemy]!.kind;
      return {
        ...display,
        summonBanner: {
          key: (display.summonBanner?.key ?? 0) + 1,
          at: event.at,
          ...summonBannerText(summoner, event.kind, event.slots.length),
        },
        summonFx: { ...summonFx, calledAt: event.at },
      };
    }
    case 'summonEntered': {
      // L'invoqué entre debout, sans l'animation de chute de l'ennemi tombé qu'il remplace.
      const { [event.enemy]: _fallen, ...downSince } = display.downSince;
      return {
        ...display,
        downSince,
        arrivals: { ...display.arrivals, [event.enemy]: (display.arrivals[event.enemy] ?? 0) + 1 },
        summonFx: {
          ...summonFx,
          entered: { ...summonFx.entered, [event.enemy]: event.at + afterRound },
        },
      };
    }
    case 'summonedFell':
      return {
        ...display,
        summonFx: { ...summonFx, fell: { ...summonFx.fell, [event.enemy]: event.at } },
      };
    default:
      return display;
  }
}

export function displayOf(
  previous: BattleDisplay,
  snapshot: BattleSnapshot,
  reducedMotion: boolean,
): BattleDisplay {
  let display: BattleDisplay = { ...previous, snapshot };
  const burnBefore = previous.snapshot?.battle.hero.burn ?? 0;
  const afterBleed = bledIn(snapshot.events) ? BURN_AFTER_BLEED_MS : 0;
  const afterRound = summonEntryDelay(snapshot.events);
  const texts = wordsOf(snapshot.events, snapshot.battle);
  if (texts.length > 0) {
    display = { ...display, feedback: { texts, key: (display.feedback?.key ?? 0) + 1 } };
  }
  for (const event of snapshot.events) {
    display = burnAfter(display, event, burnBefore, afterBleed);
    display = summonAfter(display, event, snapshot.battle, afterRound);
    const float = damageFloat(event);
    if (event.type === 'secondChanceUsed' && float !== null) {
      display = {
        ...display,
        secondChance: {
          key: (display.secondChance?.key ?? 0) + 1,
          at: event.at,
          until: event.until,
          ...secondChanceBannerText(event, snapshot.battle),
          float,
        },
      };
    } else if (float?.kind === 'burn') {
      const key = (display.burnFloat?.key ?? 0) + 1;
      display = {
        ...display,
        burnFloat: { float, key, delayMs: afterBleed },
      };
    } else if (float !== null) {
      const flying = { float, key: (display.float?.key ?? 0) + 1 };
      display = { ...display, float: flying, ...(float.at === 'hero' && { heroFloat: flying }) };
    }
    const pose = poseAfter(event, display.heroPose);
    if (pose !== null) display = { ...display, heroPose: pose, heroPoseSince: event.at };
    const spark = sparkOf(event);
    if (spark !== null) display = { ...display, spark };
    display = { ...display, bulwarkWornAt: bulwarkWornAfter(event, display.bulwarkWornAt) };
    if ((event.type === 'powerUsed' && event.instant === true) || ambushOpens(event)) {
      display = { ...display, shadowStepAt: event.at };
    }
    if (event.type === 'heroHealed') display = { ...display, healedAt: event.at };
    if (event.type === 'counterAttacked' && event.retaliation === true) {
      display = { ...display, retaliation: { at: event.at, enemy: event.enemy } };
    }
    if (event.type === 'bulwarkCountered') {
      display = { ...display, riposte: { at: event.at, enemy: event.enemy } };
    }
    if (event.type === 'reinforcementEntered') {
      // Le renfort entre debout, sans l'animation de chute de l'ennemi qu'il remplace.
      const { [event.enemy]: _fallen, ...downSince } = display.downSince;
      display = {
        ...display,
        downSince,
        arrivals: { ...display.arrivals, [event.enemy]: (display.arrivals[event.enemy] ?? 0) + 1 },
      };
    }
    if (event.type === 'guardBroken') {
      display = { ...display, downSince: { ...display.downSince, [event.enemy]: event.at } };
    }
    const hurt = hurts(event);
    if ((hurt || spark?.kind === 'gold') && !reducedMotion) {
      display = {
        ...display,
        hurtAt: hurt ? event.at : display.hurtAt,
        shakeKey: display.shakeKey + 1,
      };
    }
  }
  return display;
}

/** Ce que le lecteur d'écran annonce d'une mise à jour, dans l'ordre des événements. */
export function announcementsOf(snapshot: BattleSnapshot): string[] {
  return announcementsFor(snapshot.events, snapshot.battle);
}

interface Action {
  readonly snapshot: BattleSnapshot;
  readonly reducedMotion: boolean;
}

function reduce(display: BattleDisplay, action: Action): BattleDisplay {
  return displayOf(display, action.snapshot, action.reducedMotion);
}

/**
 * Le combat affiché : la session est démarrée au montage, chaque mise à jour devient un état
 * d'affichage (mot, chiffre, pose du héros, étincelle, vignette, secousse) et des annonces au
 * lecteur d'écran. Avec « réduire les animations », ni vignette ni secousse ; le son et la
 * vibration ne changent pas (la session les joue).
 */
export function useBattleDisplay(session: BattleSession, reducedMotion: boolean): BattleDisplay {
  const [display, dispatch] = useReducer(reduce, INITIAL_DISPLAY);

  useEffect(() => {
    const unsubscribe = session.subscribe((snapshot) => {
      dispatch({ snapshot, reducedMotion });
      for (const announcement of announcementsOf(snapshot)) {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    });
    return unsubscribe;
  }, [session, reducedMotion]);

  useEffect(() => {
    session.start().catch(() => undefined);
    return () => session.dispose();
  }, [session]);

  return display;
}
