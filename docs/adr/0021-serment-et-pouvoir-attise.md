# ADR 0021 — Serment et pouvoir attisé

- **Statut** : accepté
- **Date** : 7 novembre 2026
- **Décideur** : Architect (notes techniques de #237), écrit par le dev
- **Contexte produit** : épique #232, story #237 « Le Serment : une habitude tenue hier attise un
  pouvoir »
- **Complète** : [ADR 0017](0017-camp-et-eclats-disponibles.md), [ADR 0019](0019-arbre-de-pouvoirs-et-pouvoirs-equipes.md),
  [ADR 0014](0014-journal-d-ascension.md) et [ADR 0016](0016-journal-des-combats.md) (avenants du
  7 novembre 2026)
- **Numéro** : 0020 est réservé par #244 (rééquilibrage).

## Contexte

Le **Serment** (`Oath`) lie une habitude à un pouvoir débloqué de 2 Élan ou plus. Si l'habitude a
été faite hier, le pouvoir est **attisé** (`KindledPower`) pour toute l'ascension : 1 Élan de
moins, au moins 1. Le Serment compte **à partir du lendemain** du jour où il est prêté ou changé
(décision du propriétaire du 6 novembre 2026). Il faut décider où vit le Serment, comment se lit
« fait hier », quand l'attisé se fige, et comment un Serment devient « rompu » quand son habitude
est supprimée, sans migration et sans qu'aucun nom d'habitude quitte le téléphone.

## Décision

1. **Une clé à part du Camp, `camp.oaths`.** `{ "version": 1, "oaths": [{ "power", "habit",
   "since" }] }` : un code de pouvoir, un identifiant d'habitude et le jour `AAAA-MM-JJ` où il est
   prêté ou changé. Un achat et un Serment n'écrivent jamais la même clé : `CAMP_VERSION`, les
   Éclats et les prix ne bougent pas, par construction. Une valeur illisible est recopiée sous
   `camp.oaths.unreadable` avant de repartir de rien ; sinon les Serments restent en lecture seule,
   comme le Camp (ADR 0017, § 5). Un Serment sur un pouvoir que le Camp ne contient plus est ignoré
   à la lecture, sans être réécrit. Les règles (éligibilité, 1 habitude ↔ 1 pouvoir, « dès
   demain », état du Serment) sont dans `src/domain/ascent/oaths.ts`.
2. **« Rompu » se lit sans écriture.** Supprimer une habitude n'écrit rien dans `camp.oaths` : le
   Serment garde un identifiant qui n'existe plus et se lit `broken` jusqu'à ce qu'un autre Serment
   le remplace. C'est sûr parce qu'un **identifiant d'habitude n'est jamais réutilisé** :
   `AUTOINCREMENT` en SQLite (migration 0002, aucune migration suivante ne reconstruit `habits`),
   `lastHabitId` croissant en mémoire ; le contrat des dépôts le fige (« never gives its id
   again »). Il n'y a pas d'écriture croisée entre SQLite et le Stockage clé-valeur. **Un futur
   import ou une restauration d'habitudes devra garder cette règle.**
3. **« Fait hier » se lit avec la jauge et se fige avec elle.** `fateGaugeCount` donne aussi
   `doneYesterday` : les habitudes existantes cochées « fait » hier, attendues ou non, sur les
   suivis déjà lus (aucune requête nouvelle). La lecture (`FateGaugeReading.doneYesterday`) et le
   **Scellement de la jauge** la gardent : une case cochée pour hier après le lancement de la 1re
   ascension du jour n'attise rien ce jour-là. Une lecture en échec, ou un scellement d'avant cette
   story, a `[]`.
4. **L'attisé se fige dans l'ascension.** `CampSession.beginAscent`, seul chemin, calcule
   `kindledPowers(pouvoirs passés au lancement, Serments, habitudes, doneYesterday, aujourd'hui)` et
   le passe à `startAscent` (`AscentLaunch.kindled`). `Ascent.kindled` garde le code du pouvoir et
   l'**identifiant** de l'habitude (jamais son nom), pour que l'Équipement nomme le Serment tenu même
   après un changement de Serment. Une reprise ne recalcule rien. Aucun tirage n'est ajouté.
5. **`powerCost` reste la seule règle du coût** (ADR 0019). `kindledCost(power) = max(1, coût − 1)`.
   `Battle.kindled?` (codes seuls) n'est posé que s'il n'est pas vide : un combat sans attisé garde
   son JSON. Tout coût affiché vient du `PowerSlot` ou de `powerCost`.
6. **Le Camp lit les habitudes par les ports existants.** `CampSession` reçoit `Clock` et
   `UnitOfWork` ; les habitudes se relisent à chaque changement enregistré par une autre vue
   (`useTrackingChanges`). Le camp est prêt sans attendre les habitudes : tant qu'elles ne sont pas
   lues, aucun Serment ne se prête et rien n'est attisé.

## Conséquences

- **Aucune migration** : `SAVE_VERSION` 1, `CAMP_VERSION` 1, `OATHS_VERSION` 1. Une ascension
  d'avant n'a aucun attisé (`kindled ?? []` après la fusion dans `AscentSession.parse`) ; un combat
  sauvegardé sans `kindled` paie le prix normal ; une nouvelle ascension s'écrit avec
  `"kindled":[]`, comme `powers` et `keys` avant elle.
- **Jour de la mise à jour** (risque accepté) : un scellement fait avant la mise à jour n'a pas
  `doneYesterday` ; rien n'est attisé ce jour-là.
- **Suppression puis lancement immédiat** (risque accepté) : le lancement est synchrone et lit les
  habitudes de la session du camp, relues après la suppression ; dans les quelques millisecondes de
  la relecture, une ascension pourrait encore partir attisée.
- **Une habitude faite mais non attendue hier attise** (point tranché 2), même si la jauge ne la
  compte pas.
- Les noms d'habitudes ne sont ni dans `camp.oaths`, ni dans l'ascension, ni dans les journaux ; ils
  restent sur l'appareil (feuille de l'Équipement, Choix du héros, fiche du pouvoir).
- Le bouton « Rompre » de la maquette n'est pas fait : seule la suppression de l'habitude rompt un
  Serment (hors périmètre de #237).
