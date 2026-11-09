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
  /** Rouge sang du Saignement (prototype #107), jamais le rouge du sceau. */
  blood: '#B32E3C',
  bloodDark: '#8A1E2A',
  bloodSoft: 'rgba(179,46,60,0.3)',
  onBlood: '#FFC2C9',
  /** L'ombre violette de Pas de l'ombre (#173) : trait de l'étiquette, ombre de l'Errante. */
  shadowStep: '#6B5A7A',
  /** Fond de l'étiquette « Pas de l'ombre ». */
  shadowStepBg: '#2A2236',
  /** Texte de Pas de l'ombre : l'étiquette et la mention « Instantané », jamais sans le croissant. */
  onShadowStep: '#DCCFEA',
  /** Trait de l'étiquette juste après le lancer. */
  shadowStepNew: '#B9A6CF',
  /**
   * L'orange braise de la Brûlure (#171, maquette 170) : jamais le rouge du sceau, ni le rouge sang
   * du Saignement, ni l'or des Étincelles. Trait et fond de l'étiquette, son texte (10,1:1).
   */
  burn: '#D9733A',
  burnBg: '#3A2014',
  onBurn: '#FFC9A3',
  /** Le trait de l'étiquette cerclée à une prise, puis à une extinction (fumée grise). */
  burnRing: '#FF9F5A',
  burnSmoke: '#C3C7D3',
  /** Le chiffre « −N » de la Brûlure (7,0:1 sur la scène). */
  burnNumber: '#FF9F5A',
  /**
   * L'Invocation (#172, maquette 170) : la bande sombre de l'annonce (à 94 %, effacée sur les
   * bords) et son texte (15,4:1), aux bords de poussière en pointillé ; l'étiquette « Invoquée » (8,5:1), cernée de fumée.
   */
  summonBand: '#100E14F0',
  summonText: '#ECE6D6',
  /** Le sous-titre de l'annonce (`--parch`). */
  summonLine: '#C9C2B0',
  summonDust: '#8C93A8',
  summonTag: '#C3C7D3',
  summonTagBackground: '#262A36',
  /**
   * Le Fossoyeur (#258, maquette 245) : l'os de l'intention Exhumer, de sa marque de signature et de
   * l'annonce de l'Exhumation (`--grave`, `--grave-bg`, `--on-grave`, 12,9:1) ; la marque grisée
   * (`--muted` sur `--line2`), et le violet d'Élite de la bulle de première rencontre (`--elite`).
   */
  grave: '#A8916A',
  graveBackground: '#2A2219',
  onGrave: '#EADFC6',
  graveOff: '#8C93A8',
  graveOffLine: '#46506C',
  elite: '#C49BFF',
  /** La surface relevée de la bulle de première rencontre (`--raised`) et son texte (`--light`). */
  raised: '#2A3150',
  onRaised: '#FFF3D6',
} as const;
// Stryker restore all
