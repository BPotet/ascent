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
- Une valeur de héros changée dans le Codex ne touche pas une ascension en cours (#173, l'Errante
  passée de 60 à 55 PV) : les PV et les PV max sont figés dans la sauvegarde (`ascent.current`)
  jusqu'à la fin de l'ascension, et ne sont recalculés depuis `HEROES` qu'au début de l'ascension
  et au choix de la bénédiction de départ. Les règles de combat (coût d'un pouvoir, pouvoir
  instantané) sont celles de la version installée, tout de suite, y compris dans le combat repris.
  Aucune migration ni changement de version de sauvegarde.

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

_Levé par l'avenant du 30/10/2026 (#155), en fin de document._

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

## Avenant du 30/10/2026 (#152) : le nom de code d'un objet est stable

Le nom de code d'un objet (`ItemKind`) est un **identifiant de sauvegarde** : l'ascension le garde
dans `equipment` et `foundItem` (`ascent.current`, `SAVE_VERSION = 1`). Seul son **nom affiché**
suit l'Atelier. Quand le Codex en déduit un autre d'un nouveau nom (`armureDeChevalierDechu` pour
l'Armure de chevalier déchu), le jeu garde l'ancien (`blackKnightArmor`), et l'Atelier est réaligné
sur le jeu. Le nom de code ne change qu'avec une migration de sauvegarde, sur une story dédiée.

## Avenant du 30/10/2026 (#155) : la pose `bash` et l'écu du Rempart validés

Il **lève l'avenant au § 7 du 30/10/2026 (#128)** : la pose et l'écu demandés à l'Atelier sont
validés par le propriétaire le 30/10/2026 et recopiés comme au § 1.

- **Pose `bash`.** Recopiée de `assets/sentinel` version 26 (`animation.frames.bash` et
  `animation.anchors.bash`) dans `atelier/data/sentinel.ts`, à sa place alphabétique. La palette ne
  change pas (19 teintes). La scène montre `bash` pendant le coup de bouclier, aux mêmes moments et
  pour la même durée (400 ms, une avance de 4 dp et un retour, `BASH_ADVANCE_DP`). `BASH_FRAME`
  est supprimée.
- **Poses propres à une héroïne.** `HERO_FRAMES` reste **les 14 poses du héros**, communes aux deux
  héroïnes, contrairement à ce que prévoyait l'avenant de #128 (15 poses). Les poses propres à une
  héroïne passent par `heroFrames(kind)` (`battleCharacters.ts`) : les 14 poses du héros, plus
  `bash` pour la Sentinelle. La table `OWN_HERO_FRAMES` est typée sur `HeroKind` : l'oubli d'une
  héroïne future casse la compilation. L'atlas d'une héroïne range `heroFrames(kind)` (17 cases
  pour la Sentinelle, 16 pour l'Errante). L'Errante n'a ni pose ni case `bash` : si on la lui
  demande, elle montre `idle0`. Seule la Sentinelle a le Rempart (domaine), donc seule elle reçoit
  `bash`.
- **Écu du Rempart (`BulwarkShield`).** Recopié de `assets/bulwarkShield` version 1 dans
  `atelier/data/bulwarkShield.ts` : les deux propositions validées, `proposals[0]` « entier »
  (`whole`) et `proposals[1]` « fendu » (`cracked`), deux `AssetImage` de 12 × 15, dont les 6
  teintes sont déjà dans `artPalette`. Sur la scène, l'effet `shield` de l'atlas des effets les
  copie telles quelles dans sa case de 15 × 15, à une colonne du bord gauche, à l'échelle du héros.
  Dans l'interface, `BulwarkShieldGlyph` les rend par des `View` (`AssetRows`, ADR 0007 § 2), à ×2
  devant « Riposte » et à ×1 devant le chiffre de la riposte et dans l'étiquette du Rempart
  (ADR 0007 § 3). L'écu fendu s'affiche tel quel, sans opacité : une opacité serait une
  recoloration. Le dessin de l'écu par le code (`ShieldGlyph`, l'ancien `shield`) est supprimé.
- **Ce qui reste dessiné par le code.** Les 4 éclats d'argent (`silverShard`), l'onde d'argent et le
  choc de bouclier : l'Atelier n'en a pas d'image.

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

## Avenant du 1er novembre 2026 (#38) : aspect de phase 2, poses en plus, teintes

Les 10 entrées des paliers 2 et 3 (export de l'Atelier du 01/11/2026) sont recopiées par le script
de recopie, clé `animation` de `assets/<id>`, dans `sprites/atelier/data/<id>.ts` ; l'en-tête cite le
document et sa sha256. Le champ `icon` (statut `proposé`) n'est pas recopié.

1. **Aspect de phase 2.** `FullAnimation.phase2?: AnimationPhase2` = `{ frames, anchors,
   attackPoses? }`, au format d'une animation complète, sans `w`, `h`, `pal` ni `red` : ceux de la
   phase 1 valent pour lui, palette rouge comprise.
   - La Jardinière des cendres le porte dans `animation.phase2`, recopié tel quel.
   - Le Sonneur des heures et Celle qui exauce le portent dans un document à part,
     `assets/<id>Phase2` (`{ of, phase2 }`), recopié dans son propre fichier
     (`hourRingerPhase2.ts`, `wishGranterPhase2.ts`) qui exporte un `AnimationPhase2` ; le registre
     les joint (`{ ...HOUR_RINGER_ANIMATION, phase2: HOUR_RINGER_PHASE2 }`). La clé `phase2Doc`,
     pointeur de l'Atelier, n'est pas recopiée.
   - **Règle d'affichage** : après le changement de phase (`EnemyState.phase2`), toutes les poses du
     boss viennent de son aspect de phase 2, avec ses ancrages ; pour un coup, ce sont les poses d'un
     coup de la phase 2. Une pose absente de ces poses vient de l'animation complète de phase 2,
     jamais de la phase 1. L'atlas de l'aspect de phase 2 est un second atlas. La bascule a lieu à
     l'instant du changement de phase, sur la pose en cours. Sans aspect de phase 2 (la Gardienne,
     le Prieur), rien ne change.
2. **Poses en plus** (`ExtraFrame` = `rise0`, `rise1`, `guard`, `raiseAlly`), facultatives dans
   `frames` et `anchors`. L'atlas leur donne une case au palier 0, jamais rouge.
   - Se relève seul : `down`, `rise0`, `rise1` (133 ms chacune), puis `idle0`, pour une relève de Se
     relève seul (`guardRestore.cause: 'selfRevive'`) d'une entité qui a `rise0` et `rise1`. Un
     retour en garde après étourdissement garde `down`, `hurt`, `idle0`.
   - Garde et Relever : au milieu de l'action de soutien (de 25 % à 75 %), `guard` pour une Garde et
     `raiseAlly` pour un Relever (`SceneTimeline.support`), si l'entité les a ; sinon `ant1`.
   - Une pose en plus absente de l'entité est refusée par son nom ; dans la scène, elle montre `idle0`.
   - L'œil de `rise0` de la Ronce de cendre est hors de l'image (y = 52), tel que copié : il n'est
     jamais lu.
3. **Grandes cases** : rien de nouveau. Le Veilleur d'airain (48 × 54) et le Saint de pierre
   (48 × 58) s'affichent à leur taille, calés en bas de leur case, à 2 dp par pixel d'art
   (`battleCell`, `spriteOrigin`, avenant #138).
4. **Teintes** : `#D9733A`, `#5E8F82` et `#3D5E57` s'ajoutent à la fin de `artPalette.tints`, aux
   codes 42, 43 et 44 ; les codes existants ne bougent pas (§ 4).


## Avenant du 1er novembre 2026 (#176) : les fonds de palier

Les fonds de palier (`assets/backdropTier1` à `backdropTier3`, export de l'Atelier du 01/11/2026)
sont des images fixes, choisies et validées par le propriétaire.

1. **Recopie.** Le script de recopie (non versionné) recopie `proposals[chosen]` de chaque document,
   ses clés `w`, `h`, `palette` et `rows` telles quelles, dans un fichier par document :
   `sprites/atelier/data/backdropTier1.ts` à `backdropTier3.ts`, qui exportent un `AssetImage`
   (`BACKDROP_TIER_1`…). L'en-tête cite le document, sa sha256, celle de la fiche `codex/<id>` et le
   nom de la proposition ; ni ce nom ni `by` ne sont recopiés dans les données. La première ligne
   est `// Stryker disable all` (§ 8). Le registre `TIER_BACKDROPS` les rassemble, typé
   `Record<Tier, AssetImage>` : un palier sans fond ne compile pas.
2. **Teintes.** Les 26 teintes des fonds absentes de la palette d'art s'ajoutent à la fin de
   `artPalette.tints`, dans l'ordre des paliers, sans doublon ; les codes existants ne bougent pas
   (§ 4). Un fond est opaque partout : il n'a aucun `.`.
3. **Fidélité.** Les trois fonds recopiés sont identiques, pixel pour pixel, à ceux de la maquette
   validée (`docs/mockups/174-tier-identity/`, `ART.bd1` à `ART.bd3`) : mêmes lignes, même palette.
   Un test le vérifie à chaque exécution.

## Avenant du 1er novembre 2026 (#171) : un effet en séquences, un id qui n'est pas le nom de code

Les 4 porteurs de la Brûlure (export de l'Atelier du 01/11/2026) sont recopiés comme au § 1, clé
`animation` de `assets/<id>`, dans `sprites/atelier/data/<nom de code>.ts`, l'en-tête citant le
document et sa sha256 : l'Embrasé, la Gargouille, le Fondeur de cloches (l'élévation `lift` de 9 sur
la pose `lunge` de la Coulée, par les poses d'un coup) et le Brûleur de ronces. L'Embrasé et le
Brûleur de ronces, qui ont un coup imparable, jouent leur palette rouge (§ 4). Les flammes des
porteurs font partie de leurs poses validées : le code n'en dessine aucune.

1. **Id et nom de code.** L'id de l'Atelier `smolderingBrand` correspond au nom de code
   `burningHusk` (identifiant de sauvegarde, ADR 0012 § 2) : le fichier s'appelle `burningHusk.ts`
   et la correspondance est écrite dans son en-tête, comme `nouvelleArme` → `crossbow`.
2. **Un effet en plusieurs séquences.** `assets/burn` (version 2, choix 0, animation `validé`) est
   recopié dans `atelier/data/burn.ts` (`BURN_EFFECT`, type `EffectAnimation`) : sa palette (`pal`)
   et ses séquences (`EffectSequence`) `burn` (la flamme d'une charge, 3 images de 8 × 11, avec la
   case du héros `cell` de 36 × 44 et les 5 places `slots`), `burnHit` (l'éclat de braise, 2 images
   de 16 × 16) et `burnOut` (la fumée, 3 images de 8 × 11). La proposition `proposals[0]` n'est pas
   recopiée : la séquence `burn` la contient. Les images entrent dans l'atlas des effets
   (`battleEffects.ts`, `EFFECT_KINDS`), copiées telles quelles, centrées en largeur dans une case
   carrée de 11 ou 16, comme l'écu du Rempart. Dans l'interface, l'étiquette et le chiffre de la
   Brûlure montrent la 1re image de `burn` par des `View` (`AssetRows`, ADR 0007 § 2), à ×1.
3. **Teintes.** Toutes les teintes des 4 porteurs et de l'effet sont déjà dans `artPalette` : aucune
   n'est ajoutée.

## Avenant du 2 novembre 2026 (#175) : les portraits

Les portraits de la Frise d'action sont les icônes (`icon`) validées des entrées du Codex, et
`iconPhase2` pour un boss à aspect de phase 2 (relecture de l'Atelier du 02/11/2026).

1. **Recopie.** Le script de recopie (non versionné) lit chaque document `assets/<id>` cité par la
   story et **vérifie la sha256 du JSON écrit par `get` contre celle de la story avant d'écrire quoi
   que ce soit** : une sha256 différente l'arrête, rien n'est recopié d'un document non cité. Il
   vérifie pour chaque `icon` et `iconPhase2` : statut `validé`, `chosen: 0`, une proposition de
   24 × 24. Il recopie `proposals[chosen]`, clés `w`, `h`, `palette` et `rows` telles quelles (ni
   `name`, ni `by`, ni `at`, ni `status`), dans un seul fichier,
   `sprites/atelier/data/portraits.ts`, dont l'en-tête cite pour chaque entrée le document, sa
   version, sa sha256, celle de la fiche `codex/<id>`, le nom de la proposition et la
   correspondance id → nom de code (`nouvelEnnemi` → `skeleton`, `nouvelEnnemi2` → `madVillager`,
   `nouvelleElite` → `twins`, `smolderingBrand` → `burningHusk`). Première ligne
   `// Stryker disable all` (§ 8).
2. **Registres.** `PORTRAITS` est typé `Readonly<Record<HeroKind | EnemyKind, AssetImage | null>>`,
   sans `Partial` : un héros ou un ennemi oublié casse la compilation. `null` est une icône pas encore
   validée dans l'Atelier (aucune aujourd'hui). `PHASE_2_PORTRAITS` couvre exactement les boss qui
   ont un aspect de phase 2 (§ avenant #38), vérifié par un test. La Reine des phalènes et la
   Phalénide entrent avec leur story (#172), par le même script.
3. **Choix du portrait** (`trackPortrait`, `sprites/battle/portraits.ts`). En phase 2
   (`EnemyState.phase2`), le portrait de phase 2 s'il existe, sinon celui de phase 1 (la Gardienne
   des ossuaires et le Prieur sans visage gardent le leur). Sans portrait (`null`), la case montre ce
   qu'elle montrait : « Toi » pour le héros, l'initiale d'un ennemi. Jamais de case vide.
4. **Taille exacte en dp, seule exception au pixel physique entier.** Le portrait des petites cases
   est dessiné à 24 dp exacts (×1, prop `size` de `SpriteCanvas`, typée `24` et réservée à ce
   portrait), sans arrondi, au plus proche voisin. Arrondi (`artPixelSize(1)`), il ferait 27,4 dp à
   la densité 2,625 et 32 dp à 1,5 : la frise pleine (4 + 4 cases) dépasserait 343 dp et la dernière
   case de l'aperçu serait rognée, ce que la maquette validée exclut (une ligne, sans défilement).
   Les pixels d'art sont nets aux densités entières ; aux densités fractionnaires, certains ont un
   pixel physique de plus ou de moins. Le portrait de 48 dp de celui qui agit garde la règle (×2,
   `artPixelSize(2)` : 45,7 dp à 2,625, 48 dp à 1,5, dans sa case de 52 dp), comme l'écrin de #157.
5. **Fidélité.** Chaque portrait est identique, pixel pour pixel, à `ART.ic_<id>` (`ART.ic_<id>2`
   pour la phase 2) de la maquette validée `docs/mockups/174-tier-identity/index.html`. Un test le
   vérifie à chaque exécution.
6. **Teintes.** Toutes les teintes des portraits sont déjà dans `artPalette` : aucune n'est ajoutée.
