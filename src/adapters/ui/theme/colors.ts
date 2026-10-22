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
  /** Point d'une habitude « pas fait » sur un jour de la Vue Mois. */
  monthDotMissed: '#8D97AC',
  /** L'icône de difficulté (sommets) sur une ligne ou une carte : 9,5:1 sur la surface. */
  difficulty: '#B9C6E6',
  /** L'option choisie d'un sélecteur (« Difficulté ») et son texte secondaire. */
  optionSelected: 'rgba(124,156,255,0.18)',
  onOptionSelected: '#C9D5FF',
  /** Fond d'un message d'information de panneau (« S'applique à toute cette semaine… »). */
  infoSoft: 'rgba(124,156,255,0.12)',
  infoLine: 'rgba(124,156,255,0.4)',
  /**
   * L'objectif atteint (badge de la Vue Journée, puce de la Vue Semaine) : texte vert sur fond vert
   * léger (8:1), liseré `doneLine`.
   */
  goalSoft: 'rgba(61,220,151,0.16)',
  /** Le message « Objectifs de la semaine atteints » de la Vue Journée (maquette E1, #25). */
  goalsReachedSoft: 'rgba(61,220,151,0.12)',
  goalsReachedLine: 'rgba(61,220,151,0.5)',
  onGoalsReached: '#C9F3DF',
  /** La puce d'une semaine passée dont l'objectif n'est pas atteint : grise, neutre (9:1). */
  chipPast: '#B4BDCE',
  /** La Carte de nouveauté, en haut de la Vue Journée (dégradé de la maquette, ton de départ). */
  whatsNew: '#1F2B4D',
  whatsNewLine: 'rgba(124,156,255,0.55)',
  onWhatsNew: '#C9D3EA',
  /** Barre d'onglets. */
  tabBar: 'rgba(13,17,27,0.97)',
  tabActiveSoft: 'rgba(124,156,255,0.22)',
} as const;
// Stryker restore all
