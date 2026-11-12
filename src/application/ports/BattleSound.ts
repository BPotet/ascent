/**
 * Les sons du combat : un par résultat, un pour le sceau, un par sens de l'annonce de phase, ceux
 * du combat complet (#32) : frappe, frappe parfaite, cassure de garde, action perdue, retour en
 * garde, garde levée, allié relevé et Rempart, un par type de reflet (#81, C2.10), le cliquetis
 * d'os de l'ennemi qui se relève seul (#106), la goutte du Saignement (prototype #107), le choc
 * de bouclier de la Riposte du Rempart (#128), les trois sons de la Brûlure (#171) : le souffle
 * de flamme, le crépitement et l'extinction d'une flamme, et les deux bruissements d'ailes de
 * l'Invocation (#172) : à l'annonce, puis, plus fort, à l'entrée des invoqués, et ceux du Beffroi
 * (#266) : le reflet de balayage, le bourdon grave de la préparation d'un Balayage, le raclement de
 * sabot de la Charge et le gong fêlé de la Charge brisée, et ceux des Jardins de cendre (#267) :
 * l'éclatement sec de la Cosse de braise, le souffle d'une Cosse étouffée, le battement d'ailes et
 * le tintement du Vol d'Élan, et ceux des Catacombes (#268) : la bougie soufflée à la chute du
 * Porte-cierge et le couinement court de l'avancée d'un Rat de crypte.
 */
export type BattleSoundCue =
  | 'perfectParry'
  | 'parry'
  | 'dodge'
  | 'hit'
  | 'whiff'
  | 'seal'
  | 'enemyPhase'
  | 'heroPhase'
  | 'victory'
  | 'defeat'
  | 'strike'
  | 'perfectStrike'
  | 'guardBreak'
  | 'lostAction'
  | 'guardRestore'
  | 'guardUp'
  | 'raise'
  | 'bulwark'
  | 'glint'
  | 'glintDouble'
  | 'glintPerilous'
  | 'glintDull'
  | 'boneRattle'
  | 'bleed'
  | 'shieldClash'
  | 'flameBreath'
  | 'burnCrackle'
  | 'burnOut'
  | 'wingRustle'
  | 'wingRustleLoud'
  | 'glintSweep'
  | 'sweepDrone'
  | 'chargeScrape'
  | 'chargeBroken'
  | 'emberBurst'
  | 'emberSmother'
  | 'momentumSteal'
  | 'candleSnuff'
  | 'ratSqueak';

export const BATTLE_SOUND_CUES: readonly BattleSoundCue[] = [
  'perfectParry',
  'parry',
  'dodge',
  'hit',
  'whiff',
  'seal',
  'enemyPhase',
  'heroPhase',
  'victory',
  'defeat',
  'strike',
  'perfectStrike',
  'guardBreak',
  'lostAction',
  'guardRestore',
  'guardUp',
  'raise',
  'bulwark',
  'glint',
  'glintDouble',
  'glintPerilous',
  'glintDull',
  'boneRattle',
  'bleed',
  'shieldClash',
  'flameBreath',
  'burnCrackle',
  'burnOut',
  'wingRustle',
  'wingRustleLoud',
  'glintSweep',
  'sweepDrone',
  'chargeScrape',
  'chargeBroken',
  'emberBurst',
  'emberSmother',
  'momentumSteal',
  'candleSnuff',
  'ratSqueak',
];

/**
 * La latence attendue par défaut, en ms, tant que le téléphone n'en a pas mesuré assez : la
 * médiane de l'essai 2 de l'ADR 0006. Partagée avec les doublures de test.
 */
export const DEFAULT_SOUND_LATENCY_MS = 67.5;

/**
 * Son de combat (`BattleSound`) — port qui joue les sons du combat, préchargés. Ne lève jamais
 * d'erreur : un téléphone sans son reste jouable (la bannière et la vibration ne changent pas).
 */
export interface BattleSound {
  play(cue: BattleSoundCue): void;
  /**
   * La latence attendue (`expectedLatency`), en ms : le temps prévu entre la demande d'un son et
   * le début de sa lecture. Un son calé sur un instant (le reflet) est demandé d'autant plus tôt.
   */
  expectedLatency(): number;
}
