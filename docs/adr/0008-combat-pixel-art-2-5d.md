# ADR 0008 — Combat en pixel art 2.5D

- **Statut** : accepté
- **Date** : 25 octobre 2026
- **Décideur** : Architect (notes techniques de #81), avec la décision du propriétaire du 25 octobre
  sur les tests end-to-end du combat
- **Contexte produit** : épique #30 « Première ascension », story #81 « Combat complet (2/2) : le
  combat en pixel art 2.5D »
- **Avenant** : 27 octobre 2026, plus d'anneau (bug #101, voir en fin de document)
- **Avenant** : 1er novembre 2026, le décor sort de la scène : le fond de palier (#176, voir en fin
  de document)
- **Avenant** : 2 novembre 2026, l'ombre au sol remplace les socles (#184, voir en fin de document)

## Contexte

Le § 5 de l'ADR 0007 fait passer toute animation pixel par `useArtFrames`, sur le fil JS
(`setTimeout`), à 12 images par seconde. C'est incompatible avec le combat : une ruée de 80 ms,
une image d'impact calée sur l'instant de l'impact, un reflet de 90 ms et un anneau qui se ferme pile
à l'impact ne peuvent pas dépendre du fil JS, qui juge aussi les appuis. La scène vectorielle de #31
(ADR 0005) est remplacée par la scène en pixel art 2.5D de la maquette v4.1 (`pxlib`,
`duelEngine`).

## Décision

1. **Le combat ne passe pas par `useArtFrames`.** Ses images restent à 12 par seconde (83 ms), mais
   elles sont **comptées depuis les instants nominaux** des événements de combat (début de
   l'avancée, de la préparation, de chaque segment, impact) et **choisies sur le fil UI**, à chaque
   image, par des fonctions pures (`enemyPose`, `restPose`, `heroFrame`, `timingRing`, effets de la
   scène, dans `src/adapters/ui/battle/scene/`).
2. La **ruée** est une seule image d'étirement (`lunge`) sur [impact − 80 ms, impact[ ; l'image
   `impact` tombe à l'instant de l'impact.
3. **Seule exception à la cadence de 12 images par seconde : le reflet**, en 3 images de 30 ms.
4. L'**anneau**, la **pulsation du sceau** et les **chiffres** sont de l'interface nette, dessinée
   par-dessus la scène à la cadence de l'écran.
5. Les sprites et les effets sont **précalculés en atlas** (une image par personnage, ses paliers de
   liseré et sa palette rouge ; une image pour les effets), une fois par lancement, pendant
   « Préparation du combat… », jamais pendant la phase ennemie. L'`Atlas` de Skia les dessine ; rien
   n'est peint pixel par pixel à chaque image, et aucun rendu React n'a lieu par image.
6. La règle `pixel-art-skia-in-one-place` ne change pas : `battle/` y est déjà autorisé. Le moteur de
   sprites reste en TypeScript pur ; `SpriteCanvas.toSkImage` convertit les atlas sans passer par le
   cache des sprites.
7. Pendant un **arrêt sur image**, les poses et l'anneau sont figés sur la pose de sa fin, puisque
   le domaine a déjà décalé les instants qui suivent.

## Conséquences

- #34 (pause, aides Complètes et Aucune, mouvement réduit) s'appuie sur `timingRing` et sur le gel
  de `enemyPose`.
- #33 (boss) s'appuie sur `sceneGeometry` pour un ennemi seul et sur un atlas de plus.
- #78 (frise d'action) ne touche pas la scène.
- Le gameplay du combat se vérifie à la main sur l'APK (décision du propriétaire du 25 octobre) :
  l'e2e reste un test de fumée des états stables (F1, F2).
- Risque principal : le coût du dessin. La construction des atlas a lieu au montage (de l'ordre de
  250 ms sous Jest, à mesurer sur le téléphone du propriétaire) ; les images perdues pendant les
  actions des ennemis sont relevées dans le panneau Mesures. Repli : des atlas construits
  personnage par personnage, et des effets réduits.

## Avenant du 27 octobre 2026 — plus d'anneau (bug #101)

Décision du propriétaire du 27 octobre 2026, conforme à l'ADR 0006 (« Le combat se lit par
l'animation seule ») : l'anneau n'est plus dessiné, à aucun niveau d'aides visuelles. `timingRing`
et le composant `Ring` sont supprimés ; les § 1, 4 et 7 et la première conséquence ne concernent
plus l'anneau. Le reflet, le sceau, la palette rouge et les sons restent ; les fenêtres, les durées et
le jugement des appuis ne changent pas. Le point de la scène sur le buste du héros, qui sert à la
ruée des ennemis, à l'éclair d'impact et à l'étincelle de parade, s'appelle `chest`.

## Avenant du 1er novembre 2026 au § 5 — atlas des ennemis à la demande (#38)

Avec les paliers 2 et 3, le jeu passe de 9 à 19 ennemis et 3 aspects de phase 2 ; #171 et #172 en
ajouteront. Préparer tous les atlas à chaque lancement coûterait environ 2,5 fois plus de temps et de
mémoire. Le § 5 devient :

- `prepareBattleScene(kinds)` prépare les héroïnes, les effets et les socles **une fois par
  lancement**, comme avant ;
- les ennemis sont préparés **par type, à la demande**, dans un cache de module : ceux du combat
  d'étage (première ligne et réserve), aspect de phase 2 d'un boss compris. L'écran du combat les
  demande dès que le combat est connu, avant la première phase ennemie ; la scène prépare aussi ceux
  qu'elle montre ;
- la liste écrite à la main des types d'ennemis (`ENEMY_KINDS`) disparaît : les types viennent du
  combat ;
- les tables de la scène préparée (`characters`, `anchors`, `attackAnchors`, `motions`) deviennent
  partielles par type ; celles de l'aspect de phase 2 sont rangées à part (`phase2`). Un type absent
  ne se dessine pas ; il ne peut pas arriver.

## Avenant du 1er novembre 2026 — le fond de palier remplace le décor de la scène (#176)

Chaque palier a son fond, choisi dans l'Atelier (ADR 0010, avenant #176). Le décor quitte la scène :

- **Le fond de palier** (`TierBackdrop`) est un canevas Skia **statique**, sous tout l'écran de
  combat (`StyleSheet.absoluteFill` dans un conteneur de la couleur de la nuit), hors de la vue qui
  tremble. Il n'a ni valeur partagée ni rappel par image : il ne se redessine qu'au changement de
  palier, de mesure de la scène ou de taille de fenêtre. Il est masqué au lecteur d'écran et ne
  reçoit aucun toucher.
- **Placement** (`backdropPlacement`) : le fond remplit la hauteur et se centre, ses côtés rognés.
  Un pixel d'art vaut un **nombre entier de pixels physiques**, arrondi au-dessus
  (`ceil(hauteur × ratio / 160)`), comme le veut l'ADR 0007 § 3 ; le surplus est rogné à parts
  égales en haut et en bas. Sur 390 × 844 à ×3, cela donne 16 pixels physiques par pixel d'art et
  environ 73 pixels d'art visibles en largeur (74 dans la maquette, qui met à l'échelle de façon
  fractionnaire). Sur un écran plus large que l'image, la nuit apparaît sur les côtés.
- **Image** : une image Skia par palier, faite au premier combat de ce palier et gardée dans un cache
  de module. Elle n'entre dans aucun atlas : les atlas des personnages, des héroïnes et des effets ne
  changent pas. Si Skia ne peut pas la faire, seul le voile est dessiné et la nuit reste visible.
- **Voile de lisibilité** (`backdropVeil`) : la nuit à 90 %, dessinée dans le même canevas, au-dessus
  et en dessous du cadre de la scène, avec des fondus de 24 et 28 dp dans la scène. L'écran de combat
  mesure ce cadre dans la fenêtre à chaque mise en page (`onSceneArea`, `measureInWindow`) ; tant
  qu'il n'est pas mesuré, le voile couvre tout l'écran.
- **La scène** devient transparente : `paintBattleStage` et son cache sont supprimés. Les **socles
  restent** dans la scène : leur bord d'or marque la cible. Les `Screen` de l'écran de combat n'ont
  plus de fond propre (`background="transparent"`).
- **Lisibilité dans la scène** : la plaque des ennemis reste pleine (la surface) ; les chiffres et
  mots de scène passent d'une ombre floue à un contour d'encre opaque, sans décalage.

Deux canevas Skia se superposent désormais (le fond, puis la scène). Leur ordre sur Android se
vérifie sur l'APK ; si le fond passait devant, le repli serait de dessiner le fond et le voile dans
le canevas de la scène étendu à tout l'écran, sans tremblement, par un nouvel avenant.

## Avenant du 2 novembre 2026 au § 5 et à l'avenant #176 — l'ombre au sol remplace les socles (#184)

Décision du propriétaire du 2 novembre 2026 : les socles sous les personnages sont retirés. La
maquette validée (`docs/mockups/174-tier-identity/`, `.sock`) pose à leur place une ombre plate et
sombre sous chaque figure.

- **Les socles et leur bord d'or quittent la scène** : `pedestalImage`, `pedestalCenter` et leurs
  trois tailles disparaissent, et avec eux le terme « socle » du code du combat.
- **L'ombre au sol** (`groundShadowImage`) est **une seule image** de 32 × 5 pixels d'art, d'une
  seule couleur (l'encre de la nuit, `#06070C`), opaque, à pans coupés ; son opacité de 55 %
  (`GROUND_SHADOW_OPACITY`) est posée au dessin. Elle est préparée une fois par lancement avec les
  héroïnes et les effets (`prepareBattleScene`, § 5) et dessinée **à l'échelle du personnage** :
  2 dp par pixel d'art sous chaque ennemi (64 × 10 dp, comme la maquette), l'échelle du héros sous
  lui (96 × 15 dp, ou 64 × 10 dp sur un écran étroit).
- **Sa place** vient de `sceneGeometry` : le milieu de son bas (`groundShadowAt`,
  `heroGroundShadowAt`), 3 dp sous le bas de la place d'un ennemi (calé sur 2 dp), au bas de la
  place du héros. Elle a la même taille pour 1, 2 ou 3 ennemis.
- **Chaque ennemi de la première ligne a son ombre, debout ou tombé**, comme dans la maquette. Elle
  ne change avec aucun état (ni estompe, ni désaturation, ni rouge), ne suit ni la ruée ni la frappe,
  n'utilise ni valeur partagée ni horloge : elle reste fixe, en mouvement réduit comme ailleurs.
  Ordre de dessin inchangé : les ombres d'abord (ennemis, puis héros), puis les sprites.
- **La cible n'est plus marquée dans la scène** : elle l'est seulement par sa colonne (double cadre
  d'or de sa plaque, flèche au-dessus de son intention, nom en gras, « cible » au lecteur d'écran,
  #120). L'ombre au sol est la même sous la cible et sous les autres.
- Le dessin de l'ombre reste exclu de la mutation (ADR 0006 § 9) ; sa forme est testée.

## Avenant du 3 novembre 2026 — le voile de phase ennemie et le cadre de la scène dédoublé (#188)

Décision du propriétaire du 3 novembre 2026 : pendant la phase ennemie, la scène s'assombrit sous un
voile d'encre et la Frise d'action pâlit, sauf le combattant qui agit (maquettes
`docs/mockups/170-tiers-two-three/`, `.pst .veil`, et `docs/mockups/174-tier-identity/` v2, C1, C3
et `.frise.dimf`).

- **Le cadre de la scène est dédoublé** dans l'écran de combat : une vue **fixe**
  (`battle-scene-frame`, mesurée : `onLayout`, `measureInWindow` et `onSceneArea` de l'avenant #176
  y restent, sans `overflow: hidden`), qui porte le voile, et au-dessus la **vue qui tremble**
  (`battle-scene-shake`, plein cadre, rognée à ses bords), qui contient tout le reste de la scène, dans
  le même ordre qu'avant : la scène Skia, la pastille de phase, les colonnes des ennemis, les mots de
  scène, les chiffres, l'annonce de phase et les bulles d'aide.
- **Le voile de phase ennemie** (`roles.enemyPhaseVeil`, l'encre `#06070C` à 38 %) est une `View`
  plein cadre, posée sur la vue fixe, **sous** la vue qui tremble et **au-dessus** du fond de palier et
  de son voile de lisibilité (les fondus dans la scène sont assombris aussi). Il ne tremble jamais :
  aucune bande non voilée au bord de la scène. Il est masqué au lecteur d'écran et ne reçoit aucun
  toucher.
- **Une seule source** : le voile et la frise assombrie suivent la pastille de l'en-tête
  (`battleView(battle).phase === 'enemy'`), au même rendu, sans effet ni état ni fondu, en mouvement
  réduit comme ailleurs ; un combat repris s'affiche directement dans le bon état.
- **La frise assombrie** (`trackShade`) : la luminosité par un voile d'encre sur la case
  (`1 − luminosité`, jamais une opacité, ADR 0010, avenant #155), sur la case entière, cadre compris,
  en phase ennemie ; la saturation par une matrice de couleur Skia sur le portrait
  (`SpriteCanvas`, `saturation`, poids de luminance Rec. 709). La case de celui qui agit reste
  intacte ; l'aperçu de la phase du héros ne change pas.
- **Règle pour la suite** : tout nouvel élément de la scène se pose **dans la vue qui tremble** (il
  passe au-dessus du voile) ; rien ne se pose entre le voile et elle.

Une `View` semi-transparente se place désormais entre deux canevas Skia (le fond, sous l'écran, et
la scène, dans la vue qui tremble). Leur ordre sur Android suit la hiérarchie des vues et se vérifie
sur l'APK ; s'il ne la suivait pas, le repli serait de dessiner le voile dans le canevas de la scène,
ou dans celui du fond en lui passant la phase, par un nouvel avenant.
