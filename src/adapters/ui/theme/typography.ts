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
  /** Libellés, dates, aides. */
  label: { fontFamily: fonts.interMedium, fontSize: 13, lineHeight: 18 },
  /** Texte d'un encart de la Vue Journée (aide, encouragement). */
  notice: { fontFamily: fonts.interRegular, fontSize: 14, lineHeight: 20 },
  /** Message d'un toast. */
  toast: { fontFamily: fonts.interMedium, fontSize: 14, lineHeight: 19 },
} as const satisfies Record<string, TextStyle>;
// Stryker restore all
