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
