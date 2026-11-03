# ADR 0013 — L'Invocation

- **Statut** : accepté
- **Date** : 3 novembre 2026
- **Décideur** : Architect (notes techniques de #172, corrigées par l'analyse d'impact et la note du
  PM du 03/11/2026), écrit par le dev
- **Contexte produit** : épique #170, story #172 « L'Invocation : la Reine des phalènes et les
  Phalénides »

## Contexte

Le Codex donne à la phase 2 de la Reine des phalènes un champ `summon` (`enemy`, le nom de code de
l'ennemi appelé ; `count`, de 1 à 2) que le jeu ne savait pas jouer. Jusqu'ici, la première ligne
d'un combat ne changeait qu'au début d'une manche, par le renfort de la réserve (P3b). L'Invocation
est annoncée au milieu d'une manche (au coup qui fait changer le boss de phase) et ses ennemis
n'entrent qu'à la manche suivante : le combat doit garder cette annonce, la sauvegarder, l'afficher
et la reprendre. Les règles 6 (place libre) et 7 (tombé remplacé) sont des décisions du propriétaire
du 01/11/2026, confirmées par le Game Designer.

## Décision

### 1. La règle dans `summon.ts`, l'état dans le combat

- `Summon` (`combatants.ts`) = `{ enemy: EnemyKind; count: 1 | 2 }`, porté par
  `EnemyProfile.phase2Summon`. Seule la Reine en a une.
- `src/domain/battle/summon.ts` est pur et sans hasard : `freeSlots(enemies, count)` rend les places
  libres de la première ligne (3 places) dans l'ordre de la règle 6 (les places vides d'abord, puis
  celles des ennemis tombés, chaque fois de gauche à droite, au plus `count`). Un tombé que vise
  l'intention Relever d'un allié **debout** n'est pas libre : l'intention affichée s'accomplit
  (exception du Game Designer). `PendingSummon` = `{ summoner, kind, slots }`.
- `Battle.summon?: PendingSummon` : l'Invocation annoncée, pas encore entrée (absente : aucune).
  `EnemyState.summoned?: true` : un ennemi entré par une Invocation (glossaire : **Invoqué**).

### 2. L'annonce au changement de phase

`shiftPhase` reçoit le combat. Un boss qui a `phase2Summon` compte ses places libres **une seule
fois**, au changement de phase ; s'il en a, `battle.summon` est posé et `summonCalled { at, enemy,
kind, slots }` suit `bossPhaseShifted`. Sans place libre, il change de phase (garde, Initiative,
coups) et n'invoque rien. Rien n'est reporté : une place libérée plus tard ne déclenche aucune
Invocation. Une seule fois par combat (`phase2`), jamais du coup qui fait tomber le boss.

### 3. L'ordre du début de manche

`startRound` : **Saignement → Brûlure → entrée des invoqués → renfort → tirages → ordre d'action**.
L'entrée remplace chaque place réservée, de gauche à droite, par un ennemi neuf `summoned: true`
(`summonEntered { at, enemy, kind }` par place), puis efface `battle.summon`. Les invoqués tirent
leur intention dans cette manche et n'ont jamais agi dans celle du changement de phase (ils
n'existaient pas encore).

### 4. Les valeurs du palier : `summonMultiplier`

`Battle.summonMultiplier` (`BattleOptions.summonMultiplier`) porte le multiplicateur du palier des
invoqués, posé par la session pour **tout** combat d'étage, boss compris. `tierMultiplier` garde son
sens (combats ordinaires seulement, ADR 0012 § 1) : le boss n'est jamais multiplié. Les dégâts des
intentions d'un invoqué suivent `summonMultiplier`, ceux des autres `tierMultiplier`.

### 5. La chute avec le boss

Quand tombe un ennemi qui a `phase2Summon`, chaque invoqué encore debout tombe avec lui
(`summonedFell`, sans `enemyDefeated`, sans Or) et une Invocation encore annoncée est annulée.
`isWon` ne change pas. L'écran qui suit le combat attend la fin de leur chute (780 ms après elle,
sur l'horloge de combat, comme la fumée de la Brûlure).

### 6. La règle 7, par l'ordre du début de manche

Un tombé dont la place est réservée ne peut plus être relevé : à la manche suivante, les invoqués
entrent avant les tirages, donc avant toute intention Relever, et avant le renfort, qui ne peut
plus prendre une place réservée. Aucune intention Relever n'est tirée pendant qu'une Invocation est
annoncée (elle est annoncée en cours de manche, et entre au début de la suivante).

### 7. L'aperçu de la frise

`nextRoundOrder` calcule l'ordre sur la première ligne **projetée** (les invoqués annoncés à leurs
places). `pendingSummon(battle)` la lit pour l'interface : la poussière et les cases en pointillé
(`TrackEntry.pending`) viennent de l'état, l'annonce et la sortie des événements.

## Conséquences

- Pas de migration, `SAVE_VERSION` inchangé : `battle.summon`, `battle.summonMultiplier` et
  `enemies[].summoned` sont facultatifs. Absents : aucune Invocation, × 1, non invoqué. Un combat
  sauvegardé entre l'annonce et l'entrée est repris avec sa poussière, sans annonce (aucun
  événement au `resumeBattle`), et les invoqués entrent à la manche suivante.
- La première ligne peut passer de 1 à 3 ennemis en cours de combat : l'écran prépare avant le
  combat les atlas des ennemis invocables, et la scène compte les places de poussière dans ses
  colonnes (disposition du boss qui invoque, à trois colonnes).
- Les sons : `wingRustle` à l'annonce, `wingRustleLoud` à l'entrée, une fois pour toute
  l'Invocation, après le Saignement (700 ms) et la Brûlure (1 000 ms plus tard) de la manche.
- Les règles valent pour tout boss qui invoque ; seule la Reine invoque aujourd'hui. Les phrases du
  lecteur d'écran que la maquette ne fixe pas (une place vide sans tombé, deux tombés) sont dérivées
  de la maquette.
