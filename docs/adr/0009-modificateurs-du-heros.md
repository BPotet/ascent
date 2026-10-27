# ADR 0009 — Modificateurs du héros

- **Statut** : accepté
- **Date** : 27 octobre 2026
- **Décideur** : Architect (notes techniques de #92)
- **Contexte produit** : épique #89 « Prototype d'une ascension complète : build et jauge », story
  #92 (héros et bienfaits), préparée en parallèle de #93 (objets et bénédictions)

## Contexte

Les bienfaits (#92), puis les objets et les bénédictions (#93), changent les chiffres du combat :
contre-attaque, Brise-garde, réduction des dégâts, frappe parfaite, étourdi, retour en garde,
garde brisée. Les règles P18 et P21 de #88 demandent que ces effets se combinent **en un seul
calcul, avec un seul arrondi** à l'entier inférieur, que les bonus de frappe parfaite s'additionnent
et que la réduction des dégâts reste plafonnée à 40 %. Le moteur du combat (`Battle.ts`) est aussi
celui du combat d'essai et de la version définitive : il ne doit pas changer sans build.

## Décision

1. Un seul type, `HeroModifiers` (`src/domain/battle/heroModifiers.ts`), est le point d'entrée de
   tout effet de build dans le combat. Les multiplicateurs y sont des **listes de pourcentages**,
   passées telles quelles à `scaleDamage` : un seul arrondi par valeur.
2. `NO_MODIFIERS` est neutre ; `combineModifiers` met les listes bout à bout, additionne les
   points et garde le plus petit retour en garde. Chaque source produit des `HeroModifiers` (`boonModifiers`, plus tard `itemModifiers`),
   et la session d'ascension les combine.
3. Le combat porte ses modificateurs (`Battle.modifiers`, facultatif) : il est sauvegardé et repris
   avec eux. Un combat sans modificateurs (combat d'essai, sauvegarde de #91) n'en a aucun.
4. Les fonctions du combat (`strikeBlow`, `counterBlow`, `restoreGuard`) reçoivent des paramètres
   facultatifs, neutres par défaut. `restoreGuard` sans pourcentage garde 100 % : Relever et le
   changement de phase du boss ne sont pas touchés.

## Conséquences

- Tout nouvel effet de build ajoute un champ à `HeroModifiers` (et à `combineModifiers`), jamais un
  calcul à part dans le moteur.
- Sans modificateurs, le combat d'essai et le combat définitif ne changent pas d'un chiffre : leurs
  tests restent verts sans modification.
- Le type est partagé avec #93 (objets et bénédictions : Attaque, Initiative, Élan de départ, soin
  sur parade parfaite) ; `combineModifiers` prend des modificateurs partiels. Aucun bienfait ne
  touche l'Initiative (P18).
