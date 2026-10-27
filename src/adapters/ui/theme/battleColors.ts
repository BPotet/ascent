// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/**
 * La couche de jeu « Clair-obscur » de la maquette de l'épique #30
 * (`docs/mockups/30-premiere-ascension/index.html`), sur le socle « Nuit d'altitude ».
 */
export const battleColors = {
  background: '#0E1120',
  surface: '#181D2E',
  surfaceRaised: '#232A40',
  line: '#313A55',
  text: '#EEEAE0',
  muted: '#A3A7B8',
  /** Lumière : action principale, parade parfaite, cible. */
  light: '#F2D49B',
  onLight: '#2A1C05',
  lightGlow: 'rgba(242,212,155,0.5)',
  /** Sceau rouge : coup imparable, rien d'autre. */
  seal: '#FF3B3B',
  sealRim: '#FFD0D0',
  onSeal: '#12141B',
  curse: '#E0607A',
  curseSoft: '#3A1724',
  curseLine: 'rgba(224,96,122,0.55)',
  onCurseSoft: '#FFD0D8',
  miss: '#FF9DB0',
  guard: '#8FB8C9',
  heroHp: '#E9DFC8',
  heroHpLow: '#FF9DB0',
  foeHp: '#C46A6A',
  hpTrack: '#2A2F40',
  secondaryButton: '#232A40',
  secondaryLine: '#46506C',
  pill: 'rgba(14,17,32,0.85)',
  badge: 'rgba(10,12,22,0.88)',
  band: 'rgba(10,12,22,0.92)',
  bandEnemyLine: 'rgba(224,96,122,0.6)',
  bandHeroLine: 'rgba(242,212,155,0.6)',
  coach: '#EEEAE0',
  onCoach: '#141826',
  hatch: 'rgba(255,157,176,0.22)',
  /** Les raretés (maquette #88) : Commun, Rare, Épique, aussi écrites en mot et en losanges. */
  rarity: { common: '#C3C7D3', rare: '#7C9CFF', epic: '#C49BFF' },
} as const;
// Stryker restore all
