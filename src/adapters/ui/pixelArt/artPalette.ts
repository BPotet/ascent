// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
/**
 * La palette d'art (`artPalette`, voir `docs/glossary.md`, #72) : les teintes du prototype de la
 * tour (31 codes, transparent compris, puis celles du contenu de l'Atelier, ajoutées à la fin), qui servent aux sprites et au décor, et les rôles d'interface qui en sont tirés (maquette
 * `docs/mockups/71-pixel-art/`, « Palette et rôles »). Les contrastes documentés sont vérifiés par
 * `artPalette.test.ts`.
 */
export const artPalette = {
  /**
   * Les teintes des sprites : l'indice est le code de couleur d'un pixel (`Sprite.pixels`), 0 est
   * transparent.
   */
  tints: [
    null,
    '#06070C',
    '#10131F',
    '#1C2133',
    '#2A3150',
    '#3E4870',
    '#6B5A7A',
    '#B98E5A',
    '#F2D49B',
    '#FFF3D6',
    '#8C93A8',
    '#D9DCE6',
    '#3E4639',
    '#646D58',
    '#949B7E',
    '#252B48',
    '#47527A',
    '#8995BE',
    '#2A1F36',
    '#4A3660',
    '#BFE6DA',
    '#5B4636',
    '#FF3B3B',
    '#8A1E2A',
    '#E0607A',
    '#FFD0D8',
    '#2C3D6B',
    '#4B63A0',
    '#C9C2B0',
    '#B32E3C',
    '#FF8E8E',
    // La palette rouge du Chevalier déchu et du Prieur sans visage (#138, ADR 0010 § 4).
    '#5A1420',
    // La Sentinelle 2.5D (#140), à la suite : les codes existants ne bougent pas.
    '#8A6A42',
    '#B4B9C8',
    '#646B80',
    '#222C52',
    '#3B5089',
    '#323A62',
    // Les icônes de 16 × 16 (#157) : Écho parfait, puis Vigueur et Élan, à la suite.
    '#DEE0E7',
    '#C3C7D3',
    '#EEA8B6',
    '#F8E7C8',
  ],
  /** Les rôles d'interface. */
  roles: {
    /** Contour des sprites, ombre basse, texte sur l'or. */
    ink: '#06070C',
    /** Fond des vues, champs de saisie. */
    night: '#10131F',
    /** Cadres, lignes, cartes, panneaux. */
    surface: '#1C2133',
    /** Arête haute éclairée, dialogues. */
    raised: '#2A3150',
    /** Trait des cadres (décoratif, jamais seul porteur d'un sens). */
    line: '#3E4870',
    /** Décor, lueur chaude de la tour. */
    dusk: '#6B5A7A',
    /** Bas des boutons d'or, contour du badge. */
    goldDark: '#B98E5A',
    /** Action principale, case « à faire », XP, onglet actif, objectif atteint. */
    gold: '#F2D49B',
    /** Texte principal, reflets. */
    light: '#FFF3D6',
    /** Texte discret, croix « pas fait », icônes inactives. */
    muted: '#8C93A8',
    /** Texte secondaire. */
    parchment: '#C9C2B0',
    /** Information, aide, marque « corrigé ». */
    blue: '#8995BE',
    /** Fond d'une case faite. */
    doneBg: '#15302A',
    /** Trait d'une ligne faite. */
    doneLine: '#3E9E74',
    /** Coche, trait et crans de « fait ». */
    done: '#6FD3A0',
    /** Ombre basse d'une case faite. */
    doneShade: '#0C1F19',
    /** Fond d'une case manquée (jamais de rouge). */
    missedBg: '#2A1F36',
    /** Trait d'une case manquée. */
    missedLine: '#4A3660',
    /** Trait d'erreur. */
    curse: '#E0607A',
    /** Texte et icône d'erreur. */
    error: '#FF8E8E',
    /** Fond d'erreur. */
    errorBg: '#3A1724',
    /** Texte sur le fond d'erreur. */
    pink: '#FFD0D8',
    /** Fond du badge « Objectif atteint » et des puces d'or. */
    goldBg: '#231F1D',
    /** Fond des messages bordés d'or (« Toutes faites », objectif atteint). */
    goldMessageBg: '#1F1E26',
    /** Fond du message « Objectifs de la semaine atteints ». */
    doneMessageBg: '#14262A',
    /** Voile sous un panneau ou une fenêtre. */
    scrim: 'rgba(6,7,12,0.72)',
    /** Fond de la plaque de l'expérience, posée sur le ciel. */
    plate: 'rgba(16,19,31,0.92)',
    /** Lien d'un message clair. */
    toastLink: '#2C3D6B',
    /** Monnaie de la tour (#30) seulement. */
    shard: '#FF9F5A',
    /** Coup imparable dans la tour, rien d'autre. */
    seal: '#FF3B3B',
    /** L'argent du Rempart (#128) : l'écu et la riposte, jamais sans la forme de l'écu. */
    bulwark: '#D9DCE6',
    /** Texte du Rempart : l'étiquette, « Riposte » et son chiffre (#128). */
    bulwarkText: '#E6EAF2',
    /** Rareté Commun : trait de l'écrin et libellé, jamais sans le mot et les losanges (#157). */
    rarityCommon: '#C3C7D3',
    /** Rareté Rare : trait de l'écrin et libellé, jamais sans le mot et les losanges (#157). */
    rarityRare: '#7C9CFF',
    /** Rareté Épique : trait de l'écrin et libellé, jamais sans le mot et les losanges (#157). */
    rarityEpic: '#C49BFF',
    /** Fond de l'écrin d'une icône (#157). */
    well: '#0B0D18',
    /** Fond d'une pastille d'équipement posée dans un cadre (Équipement du pied de la tour, #159). */
    sunken: '#141829',
  },
} as const;
// Stryker restore all
