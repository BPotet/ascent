import type { TextStyle } from 'react-native';

/**
 * Polices de la maquette : Sora pour les titres et les chiffres, Inter pour le texte.
 * Les noms sont ceux des fichiers de `@expo-google-fonts/sora` et `@expo-google-fonts/inter`,
 * intégrés au build par l'assemblage. Sans eux, le téléphone affiche sa police système.
 */
export const fonts = {
  soraSemiBold: 'Sora_600SemiBold',
  soraBold: 'Sora_700Bold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
/** Styles de texte de la maquette (« Typographie » et écrans E1, E2). */
export const typography = {
  /** Titre d'écran : « Aujourd'hui ». */
  screenTitle: { fontFamily: fonts.soraBold, fontSize: 26, lineHeight: 30 },
  /** Titre d'un état (vide, erreur). */
  stateTitle: { fontFamily: fonts.soraSemiBold, fontSize: 21, lineHeight: 27 },
  /** Titre d'un panneau : « Nouvelle habitude ». */
  sheetTitle: { fontFamily: fonts.soraSemiBold, fontSize: 20, lineHeight: 26 },
  /** L'expérience du personnage dans l'en-tête : « 40 XP ». */
  xp: { fontFamily: fonts.soraBold, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  /** Un changement d'expérience : la pastille et l'envol « +10 XP ». */
  xpChange: {
    fontFamily: fonts.soraBold,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  /** Compteur « 0/3 ». */
  counter: { fontFamily: fonts.soraBold, fontSize: 17, fontVariant: ['tabular-nums'] },
  /** Nom d'une habitude dans une ligne. */
  habitName: { fontFamily: fonts.interSemiBold, fontSize: 16, lineHeight: 21 },
  /** Texte courant. */
  body: { fontFamily: fonts.interRegular, fontSize: 15, lineHeight: 22 },
  /** Saisie d'un champ. */
  input: { fontFamily: fonts.interMedium, fontSize: 17 },
  /** Libellé d'un bouton. */
  button: { fontFamily: fonts.interSemiBold, fontSize: 16 },
  /** Nom d'une option d'un sélecteur : « Moyenne ». */
  optionLabel: { fontFamily: fonts.interSemiBold, fontSize: 14, lineHeight: 18 },
  /** Libellés, dates, aides. */
  label: { fontFamily: fonts.interMedium, fontSize: 13, lineHeight: 18 },
  /** Texte d'un encart de la Vue Journée (aide, encouragement). */
  notice: { fontFamily: fonts.interRegular, fontSize: 14, lineHeight: 20 },
  /** Titre de la période affichée : « Cette semaine ». */
  periodTitle: { fontFamily: fonts.soraSemiBold, fontSize: 16, lineHeight: 21 },
  /** Nom d'une habitude sur sa carte de la Vue Semaine. */
  cardTitle: { fontFamily: fonts.interSemiBold, fontSize: 15, lineHeight: 20 },
  /** Initiale et numéro des jours de la Vue Semaine, légende. */
  small: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16 },
  /** Libellé d'un onglet ; l'onglet actif est en gras. */
  tab: { fontFamily: fonts.interMedium, fontSize: 12, lineHeight: 16 },
  tabActive: { fontFamily: fonts.interSemiBold, fontSize: 12, lineHeight: 16 },
  /** Lien d'action discret : « Revenir à cette semaine ». */
  link: { fontFamily: fonts.interSemiBold, fontSize: 14 },
  /** Message d'un toast. */
  toast: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 19 },
} as const satisfies Record<string, TextStyle>;
// Stryker restore all
