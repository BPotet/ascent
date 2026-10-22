/** Les sons du combat : un par résultat, un pour le sceau, un par sens de l'annonce de phase. */
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
  | 'defeat';

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
];

/**
 * Son de combat (`BattleSound`) — port qui joue les sons du combat, préchargés. Ne lève jamais
 * d'erreur : un téléphone sans son reste jouable (la bannière et la vibration ne changent pas).
 */
export interface BattleSound {
  play(cue: BattleSoundCue): void;
}
