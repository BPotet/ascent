# ADR 0017 — Le camp et les Éclats disponibles

- **Statut** : accepté
- **Date** : 4 novembre 2026
- **Décideur** : Architect (notes techniques de #40), écrit par le dev
- **Contexte produit** : épique #194, story #40 « Le camp : le Gardien de la flamme et ses
  déblocages »
- **Remplace** : [ADR 0012](0012-paliers-et-total-d-eclats.md) § 4 « Débiter le Total d'Éclats »

## Contexte

Au Camp, le joueur dépense ses Éclats chez le Gardien de la flamme pour débloquer pour de bon
l'Épieu de chasse, la Clochette du guet, Cœur de braise et la Flamberge (#195). L'ADR 0012 § 4
prévoyait de **débiter** `shards.total` à chaque achat, en gardant `seed` et `awarded`.

La règle validée par le propriétaire (03/11 et 04/11/2026) dit l'inverse : « le Total d'Éclats ne
baisse jamais ». Le bilan de fin affiche « Total : 82 Éclats » après 20 Éclats dépensés, et le Pied
de la tour montre les **Éclats disponibles** (62), le même nombre qu'au Camp. Le § 4 n'a jamais été
codé : aucune donnée stockée n'en dépend.

## Décision

1. **Le Total d'Éclats n'est jamais débité.** `shards.total` ne change ni de format, ni de sens, ni
   d'écritures : seule la session d'ascension l'écrit, à chaque crédit (ADR 0012 § 3).
2. **Une seule clé pour les achats : `camp.unlocks`**, dans le Stockage clé-valeur (table `key_value`
   de la migration 0001, aucune migration SQL). Elle garde chaque Déblocage avec le **Prix de
   déblocage payé** : `{ "version": 1, "unlocks": [{ "unlock": "watchBell", "price": 40 }] }`. Le
   prix payé est stocké pour qu'un futur changement de barème ne change jamais les Éclats
   disponibles d'un joueur. La clé n'est jamais effacée par l'app : ni par la fin d'une ascension,
   ni par `leave()`, ni par le changement de jour.
3. **Les Éclats disponibles sont calculés, jamais stockés** : Total d'Éclats − somme des prix payés,
   jamais sous 0 (`availableShards`, `src/domain/ascent/camp.ts`).
4. **Un achat est une seule écriture d'une seule clé**, donc tout ou rien par construction : la
   session du camp (`CampSession`) attend l'écriture de `camp.unlocks`, et seulement alors met à
   jour sa mémoire, publie, joue le son de flamme et fait vibrer. Une écriture qui échoue ne change
   rien et peut être réessayée. Un seul achat à la fois.
5. **Valeur illisible.** Elle est d'abord recopiée sous `camp.unlocks.unreadable`, puis le Camp
   repart vide (même règle que l'ADR 0012 § 3). Si la copie échoue, ou si la clé ne peut pas être
   lue, le Camp passe en lecture seule pour la session : aucun achat, et la valeur stockée n'est
   jamais écrasée.
6. **Les Déblocages n'entrent dans une ascension que par le camp** : `CampSession.beginAscent` appelle
   `AscentSession.begin` avec les Déblocages du Camp, et refuse tant que le Camp n'est pas lu.
   `AscentSession` n'est pas modifiée. La session du camp ne recharge jamais la session d'ascension :
   le Pied de la tour et le bilan, d'où l'on ouvre le camp, l'ont déjà chargée.
7. **« Dès ta prochaine ascension » est dérivé**, jamais stocké : un Déblocage acheté pendant une
   ascension en cours qui ne l'a pas dans ses `unlocks`. Il redevient « Déjà dans la tour » à la fin
   de l'ascension.

## Conséquences

- Aucun changement de `shards.total`, de `ascent.current` ni de `SAVE_VERSION`. Une app plus
  ancienne ignorerait `camp.unlocks` et ne retirerait rien.
- Le Pied de la tour montre les Éclats disponibles ; le bilan de fin garde le Total d'Éclats.
- Un risque accepté : une clé `camp.unlocks` illisible perd les Déblocages, mais leurs Éclats
  redeviennent disponibles (la valeur est recopiée à part) ; le joueur ne perd pas de valeur. Un
  `shards.total` illisible (repart de 0) met les Éclats disponibles à 0 par le plancher, et les
  Déblocages restent.
- Rien ne quitte le téléphone.

## Avenant du 6 novembre 2026 — les pouvoirs de l'arbre (#235, ADR 0019)

- La clé `camp.unlocks` garde aussi les **pouvoirs débloqués** de l'arbre de pouvoirs, dans l'ordre
  des achats, avec leur prix payé : `{ "version": 1, "unlocks": […], "powers": [{ "power":
  "retaliation", "price": 30 }] }`. `serializeCamp` écrit toujours `powers` ; `powers` absent se lit
  `[]` : **`CAMP_VERSION` reste 1**.
- `parseCamp` rend illisible (§ 5) un code inconnu ou non achetable (pouvoir de base, frappe
  « Bientôt »), un prix qui n'est pas un entier positif, ou un doublon.
- Les **Éclats disponibles** soustraient les prix des Déblocages et des pouvoirs (§ 3) : les deux
  partagent les mêmes Éclats. Un achat de pouvoir suit le § 4 (une écriture attendue, tout ou rien,
  un achat à la fois, son et vibration du camp) et le § 7 (« Dès ta prochaine ascension » dérivé).
- Les **pouvoirs équipés** entrent dans une ascension par le § 6 : `CampSession.beginAscent` passe
  `powers: equippedPowers(camp, hero)` à `AscentSession.begin`.
