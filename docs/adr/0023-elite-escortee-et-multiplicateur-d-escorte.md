# ADR 0023 — Élite escortée et multiplicateur d'escorte

- **Statut** : accepté
- **Date** : 8 novembre 2026
- **Décideur** : Architect (notes techniques de #257), écrit par le dev
- **Contexte produit** : épique #245, story #257 « Les Élites des paliers 2 et 3 viennent escortées
  d'ennemis du palier »
- **Complète** : [ADR 0012](0012-paliers-et-total-d-eclats.md),
  [ADR 0016](0016-journal-des-combats.md), [ADR 0018](0018-ennemis-maudits.md) et
  [ADR 0020](0020-multiplicateur-d-elite-et-de-boss.md) (avenants du 8 novembre 2026)

## Contexte

Aux paliers 2 et 3, l'Élite affrontée seule perdait ses tours face à la garde du héros. Le
propriétaire a validé le 07/11/2026 qu'elle vienne escortée d'ennemis ordinaires du palier (EE1 à
EE10), sans fin du combat à sa chute (Q3), puis le 08/11/2026 une colonne PV et dégâts des Élites
à 80 / 80 / 88 %. Jusqu'ici, un combat n'avait qu'un multiplicateur (`Battle.tierMultiplier`), plus
celui des invoqués (`summonMultiplier`) ; l'Élite et son escorte en demandent deux. Il faut aussi
garder les tirages du palier 1 et relire les sauvegardes d'avant, sans migration.

## Décision

1. **Un multiplicateur par ennemi, sur le modèle de l'invoqué.** `Battle.tierMultiplier` reste le
   multiplicateur du combat (celui de l'Élite dans un combat d'Élite). Un champ facultatif,
   `Battle.escortMultiplier`, porte celui de l'escorte ; chaque ennemi d'escorte porte le marqueur
   facultatif `EnemyState.escort`. `startBattle({ escortMultiplier })` marque d'escorte chaque
   ennemi de départ sauf l'indice 0. Une seule lecture interne, `enemyMultiplier(battle, enemy)`,
   choisit le multiplicateur d'un ennemi : `summoned` d'abord, puis `escort`, puis celui du
   combat ; `startRound` la lit pour les dégâts des coups. Se relève seul et l'intention Garde lisent
   déjà les valeurs de l'ennemi. Une lecture exportée, `escortedElite(battle)`, rend l'indice de
   l'Élite (0) quand un ennemi du combat est d'escorte, pour l'interface.
2. **L'escorte est une règle de palier et un tirage de l'ascension.** `TierRule.escortSize` vaut
   0 / 1 / 2. `drawEliteEscort` (`eliteEscort.ts`) tire de gauche à droite parmi les ennemis du
   palier sans soutien (`ESCORT_POOLS`), avec la même fonction que les groupes ordinaires
   (`drawFromPool`, extraite de `drawGroup` sans changer son résultat). `Encounter` ne change pas
   de forme : pour une Élite, `enemies[0]` est l'Élite et la suite son escorte.
3. **Une seule règle des multiplicateurs d'un combat d'étage** : `encounterMultipliers(tier,
   encounter)`, dans `tiers.ts`, avec un paramètre structurel (pas d'import de `Ascent.ts`). Elle
   ajoute `escortMultiplier` (celui du palier) pour une Élite qui n'est pas seule. La session et
   l'aide des marches figées du palier 1 l'appellent.
4. **L'ordre des tirages** dans `chooseExit` : l'Élite (aucun tirage s'il n'y a qu'un candidat),
   l'escorte (un par ennemi, aucun au palier 1), l'ennemi maudit (`eliteCurse`, ADR 0018), la
   graine du combat. Au palier 1, les tirages sont exactement ceux d'avant, à toutes les jauges.
5. **La fin du combat ne demande aucun code moteur** : la victoire exige déjà qu'aucun ennemi ne
   soit debout et que la réserve soit vide, la cible passe déjà au premier ennemi debout, et la
   réserve d'un combat d'Élite est vide (au plus 3 ennemis en première ligne). Les récompenses
   suivent le type de rencontre, jamais le nombre d'ennemis.
6. **Sans migration** (`SAVE_VERSION` 1) : un combat d'Élite sauvegardé avant #257 n'a ni
   `escortMultiplier` ni `escort` et se rejoue sans escorte, à ses valeurs enregistrées ; une
   rencontre d'Élite déjà tirée (1 ennemi) commence sans escorte. Sans ces champs, le JSON d'un
   combat est celui d'avant.

## Alternatives écartées

- Un multiplicateur complet dans chaque `EnemyState` : la donnée dupliquée dans tout le JSON et
  deux sources de vérité avec `tierMultiplier`.
- Une liste de multiplicateurs par indice dans `Battle` : fragile quand un invoqué prend une place.
- Déduire l'escorte de l'indice seul (≥ 1) : illisible pour l'interface et faux après une
  invocation.

## Conséquences

- L'interface lit `escortedElite` pour la disposition de l'ennemi qui mène (`leadLayout`), la
  couronne d'Élite et « L'escorte reste » ; elle ne décide d'aucune règle.
- Une place vide (un ennemi tombé) ne se touche plus, dans tous les combats : ces touchers ne sont
  plus notés comme ignorés dans le journal des combats.
- Les 200 ascensions rejouées du palier 1 changent par les PV et les dégâts des Élites (ADR 0020,
  avenant), jamais par leurs tirages.
- Le garde-fou d'équilibrage (Sommet sous 15 %) changerait `escortMultiplier` du palier 3 en une
  ligne, dans `encounterMultipliers` (hors de cette story).
- Rien ne quitte le téléphone.
