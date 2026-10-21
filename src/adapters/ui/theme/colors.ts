// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/** Couleurs de l'identité visuelle « Nuit d'altitude », reprises de la maquette validée (`docs/mockups/`). */
export const colors = {
  background: '#0F1420',
  surface: '#18202F',
  surfaceRaised: '#222B3D',
  line: '#2E3950',
  text: '#EEF1F7',
  muted: '#9AA4B8',
  placeholder: '#7E889C',
  accent: '#7C9CFF',
  accentRing: 'rgba(124,156,255,0.2)',
  onAccent: '#0B1020',
  disabled: '#2A3349',
  onDisabled: '#6F7A92',
  done: '#3DDC97',
  onDone: '#05261A',
  doneSoft: '#16302A',
  doneText: '#8FE8BF',
  doneLine: 'rgba(61,220,151,0.55)',
  /** Le trait qui sépare « ⋯ » d'une ligne « fait ». */
  doneDivider: 'rgba(61,220,151,0.3)',
  xp: '#FFC94D',
  onXp: '#2A1E00',
  /** Fond de l'avatar du personnage. */
  avatar: '#222E52',
  xpSoft: 'rgba(255,201,77,0.1)',
  xpLine: 'rgba(255,201,77,0.4)',
  onXpSoft: '#FFE3A3',
  hintSoft: 'rgba(124,156,255,0.14)',
  hintLine: 'rgba(124,156,255,0.45)',
  onHint: '#DCE4FF',
  danger: '#FF7A7A',
  onDanger: '#2B0606',
  dangerSoft: 'rgba(255,122,122,0.12)',
  dangerLine: 'rgba(255,122,122,0.45)',
  onDangerSoft: '#FFC9C9',
  skeleton: '#1B2333',
  grab: '#3A4560',
  scrim: 'rgba(5,7,12,0.64)',
  toast: '#EEF1F7',
  onToast: '#121826',
  toastAction: '#2C47D9',
  /** Cases de la Vue Semaine. */
  pendingRing: 'rgba(124,156,255,0.18)',
  missed: '#222B3D',
  onMissed: '#9AA4B8',
  notStarted: '#6B7894',
  upcoming: '#3A4560',
  /** Fond du rappel d'hier, en haut de la Vue Journée. */
  reminder: '#1C2436',
  /** La marque « corrigé » (pastille en coin de case). */
  correctedMark: '#C9D5FF',
  /** Bouton d'icône désactivé (flèches de la Vue Semaine). */
  iconDisabled: '#4A5570',
  /** Barre d'onglets. */
  tabBar: 'rgba(13,17,27,0.97)',
  tabActiveSoft: 'rgba(124,156,255,0.22)',
} as const;
// Stryker restore all
