# ADR 0007 — Identité pixel art

- **Statut** : accepté
- **Date** : 24 octobre 2026
- **Décideur** : Architect (notes techniques de #72), avec les décisions du propriétaire du 24 octobre
- **Contexte produit** : épique #71 « Toute l'app en pixel art », stories #72 (Vue Journée, en-tête,
  barre d'onglets, démarrage) et #73 (Vue Semaine, Vue Mois, panneaux)

## Contexte

L'épique #71 étend à toute l'app le style de la tour : une nuit bleue, une lumière chaude, un
contour sombre d'un pixel d'art autour de chaque forme (maquette `docs/mockups/71-pixel-art/`).
Le propriétaire a tranché trois points le 24 octobre :

1. pas de niveau du personnage dans cette épique : l'en-tête montre l'expérience seule ;
2. le ciel du jour, qui s'éclaire avec les habitudes faites, est retenu ;
3. les images (personnage, tour, ciel, icônes) sont **dessinées par le code**, remplaçables plus
   tard par un pack ou un artiste sans changer les écrans.

L'épique est livrée en deux stories. La première (#72) habille la Vue Journée, l'en-tête du
personnage, la barre d'onglets et le démarrage ; la seconde (#73) le reste. Entre les deux, les deux
styles coexistent à l'écran.

## Décision

### 1. Des sprites dessinés par le code, en TypeScript pur

Un **sprite** (`Sprite`) est une image en pixels d'art : `{ width, height, pixels: Uint8Array }`, où
chaque pixel est un indice de la palette d'art (`artPalette.tints`, 0 = transparent). Le moteur de
la maquette (`grid`, `px`, `rect`, `ell`, `line`, `poly`, `finish`, tramage ordonné `bay`)
est porté en TypeScript dans `src/adapters/ui/pixelArt/sprites/`, sans React ni Skia : il se teste
en Node, et il est déterministe (les étoiles du ciel suivent une suite à graine fixe).

Les écrans ne connaissent que des noms (`characterSprite`, icône `check12`…), jamais le dessin.

### 2. Deux rendus du même modèle

- **`SpriteCanvas`** (Skia) pour les grandes images : ciel, personnage, tour, étincelle, emblème.
  C'est le **seul module du pixel art qui importe Skia** (règle `pixel-art-skia-in-one-place`). Il
  crée une image Skia à partir des pixels RGBA, mise en cache par clé, et la dessine au plus proche
  voisin (`FilterMode.Nearest`, `MipmapMode.None`). Il est toujours décoratif. Sous Jest, il est
  remplacé par `pixelArt/testing/fakeSpriteCanvas.tsx` dans les projets `integration` et `bdd` ;
  un test de fumée le rend avec le vrai Skia.
- **`PixelIcon`** (des `View`) pour les icônes de 16 et 24 dp : une `View` par suite horizontale de
  pixels de même couleur. Une Vue Journée a trois ou quatre icônes par ligne : en Skia, ce serait une
  quarantaine de canevas.

### 3. Le pixel d'art arrondi au pixel physique

Le **pixel d'art** vaut 2 dp (`ART_PIXEL`), 3 dp pour les grands moments (`ArtScale` = 2 ou 3).
`artPixelSize(scale)` l'arrondit à un nombre entier de pixels physiques
(`PixelRatio.roundToNearestPixel`) : sur une densité fractionnaire (2,625 sur beaucoup d'Android),
un sprite reste net. Aucun sprite n'est mis à l'échelle de façon fractionnaire, ni agrandi par une
animation : un rebond est une image dessinée un pixel d'art plus haut.

#### Avenant du 30 octobre 2026 : les icônes de bienfait et de bénédiction (#157)

`ArtScale` vaut 2, 3, 4 ou 6. Une icône de bienfait ou de bénédiction a une **taille commune de
48 dp** : une icône de 24 × 24 est dessinée à ×2, une de 16 × 16 à ×3 ; au grand moment (« Bienfait
obtenu »), 96 dp, à ×4 ou ×6. Une seule fonction calcule l'échelle d'une icône
(`iconScale(image, dp)` = `dp / image.w`) : elle refuse une icône qui n'est pas carrée et toute
échelle autre que 2, 3, 4 ou 6, fractionnaire ou non. Sur une densité fractionnaire, le pixel d'art
entier prime sur les 48 dp exacts (environ 46 à 49 dp à 2,625) ; l'**écrin** (`IconWell`) garde sa
taille fixe et centre l'icône. Ces icônes passent par `SpriteCanvas` (§ 2), pas par des `View` :
`PixelIcon` et les petites images dans une ligne de texte gardent les `View`, l'écrin les icônes de
48 dp et plus (au plus 5 canevas sur « Dernière porte »).

### 4. Deux polices

- **Police pixel** (`pixelFont`, Pixelify Sans 700) : titres, chiffres de jeu, mots isolés, jamais
  sous 18 px, jamais une phrase. Un texte en police pixel passe à la ligne : ni `numberOfLines`, ni
  `adjustsFontSizeToFit`, ni `allowFontScaling={false}`.
- **Police de texte** (`textFont`, Inter 400 à 700) : tout ce qui se lit.

Écart à la maquette retenu pour respecter le critère exécutable des 18 px : dans le compteur de la
Vue Journée, « 2/5 » est en police pixel 22 et « faites » en police pixel 18 (Inter 13 dans la
maquette) ; la pastille « +10 XP » est en 18 (16 dans la maquette).

### 5. Une cadence de 12 images par seconde

Toutes les animations pixel passent par `useArtFrames` : une image toutes les 83 ms, sans
interpolation ni mise à l'échelle animée. En mouvement réduit, il passe directement à la dernière
image. Exception : le combat, qui ne passe pas par `useArtFrames` (ADR 0008). Les vibrations et les annonces au lecteur d'écran ne dépendent pas du rendu.

### 6. Le ciel du jour est une règle de jeu

`daySkyOf(doneCount, expectedCount, activeCount)` (domaine) donne la lumière du ciel du jour, de 0
(nuit, sans habitude active) à 1 (lever du soleil, toutes les habitudes attendues faites, ou aucune
attendue). Le cas d'usage `getDaySky` la lit pour l'en-tête des trois vues. Le dessin
(`paintDaySky`) reste dans l'interface.

### 7. Coexistence avec l'ancien thème jusqu'à #73

Les composants partagés avec les écrans de #73 (`HabitRow`, `XpFloat`, `TargetReachedBadge`,
`DifficultyIcon`, `StateMessage`, `AddHabitButton`, `Toast`) sont déplacés tels quels dans
`src/adapters/ui/components/legacy/`, et leurs versions pixel prennent le chemin et le nom d'origine.
Tout ce qui n'est pas visuel (libellés, annonces, durées, `targetToastOf`) est d'abord sorti dans
`format/` et `state/`, partagé par les deux versions. La règle `no-legacy-in-pixel-art` interdit au
pixel art et aux écrans réécrits d'importer `legacy/`. #73 rebranche ses écrans sur les versions
pixel, puis supprime `legacy/` et cette règle.

#### Avenant du 25 octobre 2026 : fin de la coexistence (#73)

Décidé par l'Architect (notes techniques de #73), colonnes confirmées par le PM le 25 octobre.

- **`legacy/` et sa règle sont supprimés.** La Vue Semaine, la Vue Mois, le Détail du jour, les
  panneaux « Nouvelle habitude » et « Modifier l'habitude » et la confirmation de suppression sont
  rebranchés sur les versions pixel ; `components/legacy/`, `Glyph`, `LinkButton` et `bounce`
  disparaissent. La règle `no-legacy-in-pixel-art` part avec le dossier.
- **Une nouvelle règle protège les écrans d'habitudes** : `habit-screens-in-pixel-art` interdit à
  `pixelArt/`, `components/`, `screens/`, `format/` et `state/` d'importer l'ancien thème
  (`theme/colors`, `theme/metrics`, `theme/typography`), sauf au combat et à la sonde de toucher
  (`Button`, `Screen`, `TrialBattleEntry`, `TouchProbeScreen`, `TrialBattleScreen`). Avenant de
  #121 : l'entrée du combat d'essai est retirée, et l'écran de combat sort de l'exception ; restent
  `Button`, `Screen` et `TouchProbeScreen`.
- **Le rebond par mise à l'échelle de la Vue Semaine est retiré** (§3) : une case qui passe à
  « fait » joue l'étincelle (`Burst`) et relève sa coche d'un pixel d'art pendant 2 images, comme
  dans la Vue Journée.
- **`theme/` et Sora restent**, pour le combat et la sonde de toucher seulement. Leur retrait viendra avec l'épique #30.
- **Les colonnes de la Vue Semaine et de la Vue Mois font au plus 48 dp** :
  `weekColumnWidth(largeur) = min(48, largeur / 7)`. La cible d'une case de la Semaine fait 48 dp
  de haut au moins, celle d'un jour du Mois 58 dp (`minHeight`) ; la case dessinée garde 40 × 40 dp.
  Aucun défilement horizontal, aucune zone de toucher qui dépasse sa colonne (pas de `hitSlop`
  latéral) : sur un écran de 320 dp, la cible la plus petite fait 40 × 48 dp, sans chevauchement.

## Conséquences

- Pas de migration, pas de port nouveau : seule la présentation change, plus une règle de jeu pure
  (le ciel du jour).
- Une dépendance ajoutée : `@expo-google-fonts/pixelify-sans` (graisse 700 seulement).
- Le ciel est peint en JavaScript (environ 13 000 pixels d'art pour l'en-tête) : un cache par
  lumière et par taille évite de le repeindre. À mesurer sur le build de preview ; repli : peindre
  en bandes plus larges.
- Jusqu'à #73, l'en-tête et la barre d'onglets en pixel art surmontent les corps actuels de la Vue
  Semaine et de la Vue Mois.
