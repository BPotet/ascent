# ADR 0010 — Contenu recopié de l'Atelier

- **Statut** : accepté
- **Date** : 29 octobre 2026
- **Décideur** : Architect (notes techniques de #119)
- **Contexte produit** : épique #118, story #119 « La Goule et le Villageois fou animés, et les
  images validées des objets »

## Contexte

L'Atelier de l'ascension est la source de vérité du game design, mais le jeu n'en lit aucun export
(workflow, chemin B). #119 fait entrer en jeu les premières animations complètes (la Goule, le
Villageois fou) et les premières images d'objets validées. Elles remplacent des dessins calculés par
le code (`pxlib`, ADR 0008).

## Décision

1. **Recopie.** Une animation complète ou une image validée est recopiée dans
   `src/adapters/ui/pixelArt/sprites/atelier/data/`, telle quelle, avec les clés de l'export : `w`,
   `h`, `pal`, `red`, `frames`, `anchors` pour une animation (`FullAnimation`) ; `w`, `h`,
   `palette`, `rows` pour une image (`AssetImage`). Un fichier par entrée, nommé d'après son nom de
   code. Elle est générée par un script non versionné, jamais retouchée à la main : toute retouche
   passe par l'Atelier.
2. **Format d'une pose.** Une pose fait `h` lignes de `w` caractères. `.` est transparent ; sinon,
   le caractère est l'indice de la teinte dans la palette, en base 36. Le contour d'encre
   (`#06070C`) est déjà dessiné. Les ancrages sont en pixels d'art de la pose, origine en haut à
   gauche : `eye` le reflet, `tips` le reflet double, `head` les étoiles.
3. **Affichage.** Les teintes sont converties en codes de `artPalette`, sans tenir compte de la
   casse ; une teinte absente est une erreur. Pas de `finish` : ni éclairage, ni second contour, ni
   liseré, ni traînée, ni décalage. La case du combat fait 44 × 52 pixels d'art, à 2 dp ; une pose
   plus petite y est centrée en largeur et calée en bas, sans mise à l'échelle, ses ancrages décalés
   d'autant. Un objet s'affiche à 3 dp sur « Objet trouvé ».
4. **Palette rouge.** Elle est recopiée, mais ne sert qu'à une entité qui a un coup imparable. Ses
   teintes absentes de `artPalette` y sont alors ajoutées (ADR 0007).
5. **Ancrages par pose.** Le combat lit les ancrages de la pose affichée (`poseAnchors`). Un
   personnage encore dessiné par le code garde ses ancrages d'avant (`ant2` pour le reflet, `down`
   pour les étoiles), quelle que soit la pose.
6. **Duplication.** Les données sont exclues de la détection de duplication de Sonar, mais pas la
   conversion (`atelier/fullAnimation.ts`), mesurée et couverte comme le reste du code.

## Conséquences

- Chaque nouvelle animation complète validée (Les Jumeaux, le Squelette…) ne demande qu'un fichier
  de données et une entrée dans `FULL_ANIMATIONS`, sans dessin.
- `OLD_GHOUL`, l'ancien dessin de la Goule, disparaîtra quand le Chevalier déchu, le Squelette et Les
  Jumeaux auront leur animation complète.
- L'ADR 0008 § 5 (atlas précalculés) s'applique toujours : l'atlas d'un personnage animé garde ses
  cases de liseré et de rouge, copies identiques de la pose.

## Avenant du 29/10/2026 (#138)

- **§ 3 Case du combat.** La case du combat fait au moins 44 × 52 pixels d'art, à la taille de
  l'animation complète si elle est plus grande (`battleCell`), à 2 dp. Une pose plus petite que sa
  case y est centrée en largeur et calée en bas, ses ancrages décalés d'autant. La scène garde
  88 × 104 dp par ennemi : une case plus grande y est centrée en largeur et calée en bas
  (`spriteOrigin`), pieds sur le socle, sans réduction ni rognage. `spriteOrigin` est calculée sur
  le fil JS, hors des worklets de la scène.
- **§ 4 Palette rouge.** Une entité qui a un coup imparable, phase 2 comprise (lu dans `ENEMIES`
  et `ATTACKS`), affiche pendant ce coup ses poses d'attaque (`RED_FRAMES`) peintes avec `red` au
  lieu de `pal`, sans liseré ni traînée. Une entité sans coup imparable ne convertit pas sa palette
  rouge ; une palette rouge absente vaut « pas de pose rouge ». `#5A1420` entre dans la palette
  d'art, en fin de `tints` (code 31).
- **Conséquences.** Le dessin du Spectre (#81) est supprimé. Le dessin par le code des ennemis
  (`CharacterArt`, `finish` pour un personnage) n'a plus d'utilisateur une fois #137 et #139
  mergées : une tâche `type:chore` le retire après l'épique #136. Le héros relève de #140.

## 7. Héros (#140, 29 octobre 2026)

L'Errante (`wanderer`) et la Sentinelle (`sentinel`) ont chacune leur animation complète, recopiée
comme au § 1 (`atelier/data/wanderer.ts`, `atelier/data/sentinel.ts`).

- **Poses.** Les 14 poses du héros (`HERO_FRAMES`) : `idle0`, `idle1`, `raise`, `raiseG`, `atk0`,
  `atk1`, `parry0`, `parry1`, `dodge0`, `dodge1`, `hit0`, `hit1`, `off0`, `off1`. Le choix de la
  pose, ses moments et ses durées ne changent pas (`heroFrame`).
- **Pas de clé `red`.** Un héros n'a pas de poses rouges : `FullAnimation.red` est facultative.
- **Case.** Celle du héros, 36 × 44 pixels d'art (`HERO_CELL`), passée explicitement à
  `animationSprite`, jamais la case d'un ennemi. Elle s'affiche à l'échelle entière du héros
  (`sceneGeometry`) : 3 dp par pixel d'art, 2 dp sur un écran de moins de 360 dp.
- **Registre.** Les héroïnes ont leur propre registre (`battle/heroAnimations.ts`,
  `HERO_ANIMATIONS`), distinct de celui des ennemis (`FULL_ANIMATIONS`). La scène prépare l'atlas de
  chaque héroïne et dessine celle de l'ascension (`heroKind`). Les cases de liseré de `raise` et
  `raiseG` restent dans l'atlas, en copies identiques de la pose (ADR 0008 § 5).
- **Ancrages.** Recopiés tels quels, mais le combat ne les lit pas : ni reflet ni étoiles sur le
  héros. Une pointe peut sortir de la pose.
- **Palette.** Les teintes absentes de `artPalette` y sont ajoutées à la fin, comme au § 4 : les
  6 teintes de la Sentinelle 2.5D (codes 32 à 37, après `#5A1420`). Les codes existants ne bougent
  pas.

### Avenant au § 7 du 30/10/2026 (#128) : pose demandée à l'Atelier, pas encore validée

Une pose du héros demandée à l'Atelier et pas encore validée est remplacée par une pose validée de
son animation complète. Cette pose est nommée par une seule constante : pour la Riposte du Rempart,
`BASH_FRAME = 'parry1'` (`battle/scene/heroFrame.ts`), le bouclier levé devant elle, tenu pendant le
coup de bouclier (une avance de 4 dp et un retour, `BASH_ADVANCE_DP`). Elle n'est jamais dessinée,
déplacée ni déformée par le code : la scène la place seulement. Une story du chemin B la remplace
après la validation : elle recopie la pose `bash` dans `atelier/data/sentinel.ts`, l'ajoute à
`HERO_FRAMES` (15 poses) et change cette seule constante. L'écu du Rempart (entier, fendu) est un
effet de la scène, dessiné d'après la maquette (`battleEffects.ts`, `shield`) et marqué provisoire :
il suit la même règle quand l'Atelier valide son image.

## Avenant du 29/10/2026 (#139)

Les Jumeaux (`twins`, entrée `nouvelleElite`) et la Gardienne des ossuaires (`ossuaryWarden`) ont
leur animation complète, recopiée comme au § 1 (`atelier/data/twins.ts`,
`atelier/data/ossuaryWarden.ts`), avec leurs **poses d'un coup**.

- **§ 1 Format.** La clé `animation.attackPoses` de l'export est recopiée telle quelle
  (`FullAnimation.attackPoses`, type `AttackPoses`). Ses clés sont des types de coup du domaine
  (`AttackKind`) : `basic` (Carreau d'arbalète) et `delayedPerilous` (Onde de choc) pour les
  Jumeaux ; `double` (Deux tibias) et `perilous` (Mise en ossuaire) pour la Gardienne. Pour une
  entité, un type de coup ne correspond qu'à un coup : le type suffit, sans nom de coup dans le
  domaine. Chaque entrée a le nom du coup dans l'Atelier (`move`, jamais affiché), les lignes
  (`frames`) et les ancrages (`anchors`) de ses poses, à la taille de l'entité, et peut avoir une
  portée (`reach`) et une élévation par pose (`lift`, en pixels d'art entiers).
- **Choix de la pose.** La scène choisit l'image comme avant (`enemyPose`), aux mêmes instants ;
  seule sa source change. L'image vient des poses d'un coup quand l'action est une attaque, que
  l'ennemi a des poses d'un coup pour ce type de coup et que l'image en fait partie : anticipation,
  hésitation, ruée, impact, récupération, 2ᵉ segment d'une double frappe et reflet tenu compris.
  Jamais pendant l'avancée (le type de coup reste caché, C2.8), une Garde, un Relever ou au repos.
- **Portée.** `reach` multiplie le chemin du coup vers le héros, comme dans l'aperçu de l'Atelier
  (1 par défaut). L'avancée ne change pas : le type de coup n'y est pas connu (C2.8). Le recul de
  l'anticipation part de l'avancée (0,3), sans saut, jusqu'à `(0,3 − 0,14) × reach` ; la ruée,
  l'impact, la récupération, la fausse ruée et le retour sont multipliés par `reach`. Pour le
  Carreau d'arbalète (0,5) : recul 0,08, impact 0,425, fin de la récupération 0,15.
- **§ 3 Élévation.** `lift` est un décalage de la scène vers le haut, à 2 dp par pixel d'art : il
  ne grandit pas la case (`battleCell`). Le reflet suit, puisqu'il part de la place de l'image. En
  mouvement réduit, la portée est au quart comme avant, l'élévation au quart arrondi au pixel d'art.
- **§ 4 Palette rouge.** La règle ne change pas : une pose d'un coup est peinte avec `red` pendant
  un coup imparable d'une entité qui joue sa palette rouge. L'atlas a une case rouge pour chaque
  pose de l'Onde de choc et de Mise en ossuaire, aucune pour le Carreau d'arbalète ni Deux tibias.
- **Atlas.** Chaque pose d'un coup a sa case, au seul palier 0 (les paliers d'une pose recopiée
  sont des copies identiques, ADR 0008 § 5). La table (`AtlasTable.attacks`) les numérote à la
  suite des images ; `atlasRect` la lit sur le fil UI, sans concaténation de chaîne. Les ancrages
  des poses d'un coup, la portée et les élévations sont préparés sur le fil JS
  (`prepareBattleScene`, `attackMotion`).
- **Conséquences.** Le registre des animations complètes couvre tous les ennemis
  (`satisfies Record<EnemyKind, …>`) : l'oubli d'un ennemi futur casse la compilation. Le dessin des
  ennemis par le code est supprimé (`OLD_GHOUL`, `NECROMANCER`, `silhouette`, `CharacterArt` et le
  chemin dessiné de `battleCharacters.ts`). La tâche `type:chore` de l'avenant #138 garde le reste :
  les options de personnage de `finish`, les paliers de liseré de l'atlas, le paramètre `tier` et
  la mise à jour de l'ADR 0008 § 5.

## 8. Mutation (#145, 29 octobre 2026)

Les données sont exclues de la mutation des écrans (`stryker.ui.config.mjs`, issue #145), mais pas
la conversion. Le script de recopie, non versionné, écrit `// Stryker disable all` en première ligne
de chaque fichier de données : un test (`scripts/mutation/config.test.mjs`) fait échouer la CI
sinon, car l'exclusion cacherait alors des mutants exécutables.

## 9. Icônes (#157, 30 octobre 2026)

Les 12 icônes validées dans l'Atelier le 30/10/2026 sont recopiées par le script de recopie, en
lecture seule, clé `proposals[chosen]` (`w`, `h`, `palette`, `rows`), en `AssetImage` :

- les 7 **icônes de bienfait** dans `sprites/atelier/data/boonIcons.ts` (`BOON_ICONS`) ;
- les 5 **icônes de bénédiction** dans `sprites/atelier/data/blessingIcons.ts` (`BLESSING_ICONS`),
  une par famille, la même pour ses trois raretés. L'entrée `aegis` de l'Atelier est la famille
  `protection` (ex-« Égide », #105) : la correspondance est écrite en tête du fichier, comme
  `nouvelleArme` → `crossbow` dans `itemImages.ts`.

Les deux registres sont typés `Readonly<Record<BoonKind | BlessingFamily, AssetImage>>`, sans
`Partial` : l'oubli d'un bienfait ou d'une famille casse la compilation. Leur première ligne est
`// Stryker disable all` (§ 8). Les données sont identiques, pixel pour pixel, à la constante `ICONS`
de la maquette validée (`docs/mockups/153-boon-blessing-icons/index.html`), qui sert de référence
versionnée au test de fidélité (`features/icones-bienfaits.feature`).

Les icônes de 16 × 16 apportent 4 teintes absentes de la palette d'art : `#DEE0E7` et `#C3C7D3`
(Écho parfait), `#EEA8B6` (Vigueur), `#F8E7C8` (Élan). Elles s'ajoutent à la fin de `tints` (§ 4) :
les codes existants ne bougent pas, et les tests passent par `tintCode`, jamais par un code écrit en
dur. Une icône validée de nouveau plus tard entre par une story du chemin B.
