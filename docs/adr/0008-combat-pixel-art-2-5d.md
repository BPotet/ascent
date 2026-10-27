# ADR 0008 — Combat en pixel art 2.5D

- **Statut** : accepté
- **Date** : 25 octobre 2026
- **Décideur** : Architect (notes techniques de #81), avec la décision du propriétaire du 25 octobre
  sur les tests end-to-end du combat
- **Contexte produit** : épique #30 « Première ascension », story #81 « Combat complet (2/2) : le
  combat en pixel art 2.5D »
- **Avenant** : 27 octobre 2026, plus d'anneau (bug #101, voir en fin de document)

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
