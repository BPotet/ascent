/**
 * Les sons du combat : un par résultat, un pour le sceau, un par sens de l'annonce de phase, ceux
 * du combat complet (#32) : frappe, frappe parfaite, cassure de garde, action perdue, retour en
 * garde, garde levée, allié relevé et Rempart, un par type de reflet (#81, C2.10), et la goutte
 * du Saignement (prototype #107).
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
  | 'bleed';

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
  'bleed',
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
