import type { TextStyle } from 'react-native';

/**
 * La police pixel (`pixelFont`) : Pixelify Sans 700, pour les titres, les chiffres de jeu et les
 * mots isolés, à 18 px au moins. Elle ne porte jamais une phrase. Un texte en police pixel n'a ni
 * `numberOfLines`, ni `adjustsFontSizeToFit`, ni `allowFontScaling={false}` : il passe à la ligne.
 */
export const pixelFont = 'PixelifySans_700Bold';

/** La police de texte (`textFont`) : Inter, pour tout ce qui se lit. */
export const textFont = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** La plus petite taille de la police pixel. */
export const PIXEL_FONT_MIN_SIZE = 18;

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
/** Les styles de texte de l'identité pixel art (maquette, « Polices »). */
export const pixelTypography = {
  /** Titre d'écran : « Aujourd'hui ». */
  screenTitle: { fontFamily: pixelFont, fontSize: 28, lineHeight: 32 },
  /** Titre de l'app au démarrage : « Ascent ». */
  appTitle: { fontFamily: pixelFont, fontSize: 44, lineHeight: 50 },
  /** L'expérience du personnage : « 340 XP ». */
  gameNumber: {
    fontFamily: pixelFont,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  /** Le compteur de la Vue Journée : « 2/5 ». */
  counter: { fontFamily: pixelFont, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
  /** Le mot du compteur : « faites ». */
  counterUnit: { fontFamily: pixelFont, fontSize: 18, lineHeight: 22 },
  /** Titre d'un état (vide, erreur). */
  stateTitle: { fontFamily: pixelFont, fontSize: 24, lineHeight: 29 },
  /** Un moment fort : « Toutes faites ». */
  moment: { fontFamily: pixelFont, fontSize: 20, lineHeight: 24 },
  /** Un changement d'expérience : l'envol et la pastille « +10 XP ». */
  xpChange: { fontFamily: pixelFont, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
  /** Nom d'une habitude. */
  habitName: { fontFamily: textFont.semiBold, fontSize: 16, lineHeight: 21 },
  /** Texte courant, aides, erreurs. */
  body: { fontFamily: textFont.regular, fontSize: 15, lineHeight: 22 },
  /** Libellés, dates, progression. */
  label: { fontFamily: textFont.medium, fontSize: 13, lineHeight: 17 },
  /** L'état écrit d'une ligne : « À faire », « Fait ». */
  statusWord: { fontFamily: textFont.bold, fontSize: 13, lineHeight: 17 },
  /** Le texte d'un message de la Vue Journée. */
  notice: { fontFamily: textFont.medium, fontSize: 14, lineHeight: 20 },
  /** Le titre d'un message de la Vue Journée. */
  noticeTitle: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 20 },
  /** Libellé d'un onglet ; l'onglet actif est en gras. */
  tab: { fontFamily: textFont.semiBold, fontSize: 12, lineHeight: 16 },
  tabActive: { fontFamily: textFont.bold, fontSize: 12, lineHeight: 16 },
  /** Libellé d'un bouton. */
  button: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 19 },
  /** Lien d'action : « Corriger ». */
  link: { fontFamily: textFont.bold, fontSize: 14, lineHeight: 19 },
} as const satisfies Record<string, TextStyle>;
// Stryker restore all
