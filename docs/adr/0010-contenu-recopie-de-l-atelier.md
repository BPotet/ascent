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
7. **Mutation.** Les données sont exclues de la mutation des écrans (`stryker.ui.config.mjs`, issue
   #145), mais pas la conversion. Le script de recopie, non versionné, écrit
   `// Stryker disable all` en première ligne de chaque fichier de données : un test
   (`scripts/mutation/config.test.mjs`) fait échouer la CI sinon, car l'exclusion cacherait alors
   des mutants exécutables.

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
