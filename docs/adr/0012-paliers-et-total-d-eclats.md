# ADR 0012 — Les paliers et le Total d'Éclats

- **Statut** : accepté
- **Date** : 1er novembre 2026
- **Décideur** : Architect (notes techniques de #38), écrit par le dev
- **Contexte produit** : épique #170, story socle #38 « Trois paliers jusqu'au sommet, et les
  premiers Éclats »

## Contexte

Jusqu'à #38, l'ascension s'arrêtait au boss du palier 1 (règle transitoire de #33). La story ajoute
les Jardins de cendre et le Beffroi jusqu'au Sommet, et les **Éclats** (`Shard`), la monnaie gardée
entre les ascensions. Les Éclats sont la première donnée du jeu qui survit à la fin d'une
ascension : la clé `ascent.current` du Stockage clé-valeur est effacée à la chute, à l'abandon et au
Sommet. Un Éclat gagné doit être crédité et sauvegardé avant l'écran qui suit la victoire, et ne
jamais être perdu par une chute, un abandon ou une fermeture forcée.

## Décision

### 1. La règle du palier : la table `TIERS`

`src/domain/ascent/tiers.ts` porte la règle de chaque palier (`Tier` = 1, 2 ou 3) :

- son nom de code (`catacombs`, `ashGardens`, `belfry`) ;
- son **multiplicateur de palier** (`TierMultiplier` = `{ hpPercent, guardPercent }` : 100/100,
  135/125, 175/150) et son pourcentage d'Or (100, 125, 150) ;
- les poids de la taille d'un groupe, par étage, pour 1 à 5 ennemis (0 pour 1 et 5 aux paliers 2
  et 3) ;
- ses ennemis tirés, dans l'ordre du tirage, avec leur poids, leur plafond par groupe et `neverAlone`
  pour un soutien ;
- ses Élites, ses boss et les Éclats de son boss (8, 12, 18).

Au palier 1, la table reprend exactement les tirages d'avant #38 : un test figé sur 200 graines
(`tierOne.unchanged.test.ts`, généré sur `develop` à `582cc236`) le garantit. Les ennemis de #171 et
#172 rejoindront ces listes avec leur story ; les tirages futurs d'une ascension en cours
changeront alors, les tirages révélés restent (P9).

Le multiplicateur ne s'applique qu'aux ennemis des **combats ordinaires** : la session d'ascension
le passe au combat (`Battle.tierMultiplier`) pour un combat d'étage `combat` seulement. Chaque
valeur est multipliée en entiers (`scaleByPercent`, `Math.floor(valeur × pourcentage / 100)`) :
PV max, garde max, dégâts de chaque coup. Jamais l'Initiative ni le Saignement. Un combat sauvegardé
sans multiplicateur est un combat à × 1.

### 2. L'ascension sauvegardée : trois champs de plus, `SAVE_VERSION` inchangé

`Ascent` gagne `tier`, `shardAwards` (les Éclats gagnés pendant l'ascension, montrés au bilan) et
`passage` (le **Passage de palier** en cours, `{ to, step: 'bossDefeated' | 'announce' }`). Une
sauvegarde d'avant #38 est relue au palier 1, sans Éclat ni passage, par les valeurs par défaut de
`parse` (comme #92, #93 et #105). Les noms de code des 10 entrées deviennent des identifiants de
sauvegarde : on ne les renomme plus sans migration (ADR 0010, avenant #152).

### 3. Le Total d'Éclats : une clé à part du Stockage clé-valeur

- **Clé** : `shards.total`, dans la table `key_value` existante (migration 0001). Pas de migration
  SQL, pas de nouveau port, pas de nouvel adaptateur : c'est le même chemin que `ascent.current`.
- **Format** (JSON) : `{ "version": 1, "total": <entier ≥ 0>, "seed": <graine | null>, "awarded":
  [<identifiants>] }`.
  - `total` : le **Total d'Éclats** du joueur (`ShardTotal`).
  - `seed` : la graine de l'ascension des derniers crédits.
  - `awarded` : les identifiants des gains déjà crédités pour cette graine.
- **Identifiant d'un gain** (`ShardAward`) : `<graine>:<palier>:<étage>:elite|boss`, et
  `<graine>:summit`. Un gain déjà dans `awarded` n'est jamais recrédité ; une autre graine repart
  d'une liste vide, jamais d'un total vide (`creditShards`).
- **Ordre** : à une victoire qui rapporte des Éclats, `AscentSession` écrit d'abord `shards.total`,
  attend la fin de l'écriture, puis sauvegarde l'ascension et la publie. L'écran du butin, du boss
  vaincu ou du Sommet ne s'affiche qu'une fois les Éclats sauvegardés.
- **Rattrapage** : au chargement, `load()` crédite les gains de l'ascension en cours qui manquent à
  `awarded` (une écriture échouée ou interrompue). Une écriture qui échoue n'arrête pas l'ascension :
  chaque sauvegarde suivante la retente. Cas limite accepté : un échec répété jusqu'au « Retour au
  pied de la tour » après le Sommet ou une chute, la clé de l'ascension effacée.
- **Fermeture forcée** : à la reprise, le combat repart de l'action en cours (P32) ; un même boss
  rebattu ne rapporte rien de plus, son gain est déjà dans `awarded`.
- **Valeur illisible** : jamais écrasée en silence. Elle est recopiée sous
  `shards.total.unreadable`, puis le total repart de 0. C'est la seule perte possible, testée.
- **Jamais effacée** par l'application : ni par la fin de l'ascension, ni par `leave()`, ni par une
  valeur illisible de `ascent.current`.
- **Lecture** : `AscentSession.load()` lit aussi le Total d'Éclats ; `shardTotal()` le rend et
  `subscribeShards()` prévient à chaque crédit. Le Pied de la tour le lit par la session partagée.

### 4. Débiter le Total d'Éclats (#40) — remplacé par l'ADR 0017

> **Remplacé par l'[ADR 0017](0017-camp-et-eclats-disponibles.md)** (4 novembre 2026). Ce paragraphe
> n'a jamais été codé : le Total d'Éclats n'est jamais débité ; les achats du Camp vivent sous leur
> propre clé, `camp.unlocks`, et les Éclats disponibles sont calculés. Le texte d'origine est gardé
> ci-dessous pour l'historique.

La story qui dépense les Éclats (#40) débite la même clé : elle relit `shards.total`, retire le prix
de `total`, et réécrit la valeur en **gardant `seed` et `awarded` tels quels**, faute de quoi un gain
de l'ascension en cours pourrait être recrédité au chargement. Un débit ne rend jamais `total`
négatif. Les deux écritures (crédit et débit) passent par la même file d'écritures de la session.

## Conséquences

- La règle transitoire de #33 disparaît : vaincre le boss du palier 1 ne termine plus l'ascension ;
  seul le boss du palier 3 mène à la victoire (le Sommet).
- La Bénédiction d'Élan Commune joue au premier combat : l'étage 1 du **palier 1** seulement. La
  Garantie du Feu de camp vaut pour chaque palier.
- Un risque accepté : la perte du total sur une valeur illisible (recopiée à part).
- Rien ne quitte le téléphone.
