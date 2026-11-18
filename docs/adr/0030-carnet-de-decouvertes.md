# ADR 0030 — Le carnet de découvertes

- **Statut** : accepté
- **Date** : 18 novembre 2026
- **Décideur** : Architect (notes techniques de #282, D1 à D12), écrit par le dev
- **Contexte produit** : épique #278, story socle #282 « Le carnet de découvertes : le Bestiaire se
  remplit au fil des combats » ; #283 (la page d'un ennemi) et #284 (les Objets) s'y appuient
- **Avenant** : 18 novembre 2026, une lecture ratée est relancée à chaque `flush` (bug #295, voir en
  fin de document)

## Contexte

Le joueur ouvre depuis le Pied de la tour un **carnet de découvertes** dont le **Bestiaire** montre,
palier par palier, chaque ennemi du jeu (Élites et boss compris) en « ??? », **rencontré** ou
**vaincu**. Il se remplit tout seul pendant les ascensions et ne rapporte rien (décisions du
propriétaire du 12/11/2026 : carnet vide à la mise à jour, accès par le Pied de la tour seulement,
aucune récompense de collection, « ennemi » partout). Les règles du Game Designer (G1 à G6, B1 à
B19, C1 à C5) demandent un état monotone, jamais perdu, idempotent, indépendant du jeu, et enregistré
au plus tard avec le combat qui l'a produit.

## Décision

1. **Les découvertes d'une mise à jour du combat sont une règle pure du domaine** (D1,
   `domain/discoveryBook/battleDiscoveries.ts`). D'abord les événements, dans leur ordre : l'entrée
   d'un Renfort, d'un invoqué ou d'un exhumé rend rencontré ; `enemyDefeated` et `summonedFell`
   rendent vaincu. Puis la lecture de la première ligne d'après la mise à jour, jamais la réserve ni
   les places d'une Invocation annoncée : chaque ennemi est rencontré, un ennemi à 0 PV est vaincu.
   Cette lecture couvre le début du combat et sa reprise (une ascension en cours à la mise à jour
   est prise en compte ainsi), et ne change rien le reste du temps.
2. **Le nom de code d'une place est suivi événement par événement** (D2,
   `domain/battle/enemyKinds.ts`, `kindsAlong`) : extrait sans changement de `battleFeedback`, qui
   l'utilise aussi. Une chute et un Renfort à la même place dans la même mise à jour gardent chacun
   leur ennemi.
3. **Le catalogue du Bestiaire vient de `TIERS`** (D3, `BESTIARY_CATALOG`) : 37 entrées, 12, 12 et
   13 par palier (22 ennemis, 9 Élites, 6 boss). Toutes les lectures reçoivent le catalogue en
   paramètre : un ennemi ajouté arrive « ??? » sans « nouveau », un ennemi retiré est caché sans
   perdre son état.
4. **Le carnet est une valeur du domaine, monotone** (D4, `domain/discoveryBook/DiscoveryBook.ts`).
   Inconnu n'est jamais enregistré. Une montée marque l'entrée « nouveau » (une seule marque) ; les
   marques s'effacent à la sortie du carnet, Bestiaire et Objets. Le compteur du carnet ne compte
   que les entrées présentes dans le jeu (`newEntryCount(book, { bestiary, items? })`, extensible
   pour #284).
5. **Le stockage** (D5) : la clé `discoveryBook` du Stockage clé-valeur, JSON versionné
   (`{ "version": 1, "lastTier": 2, "enemies": {…}, "items": {} }`), jamais effacée par l'app. Une
   valeur illisible est recopiée sous `discoveryBook.unreadable`, puis le carnet repart vide ; si la
   copie échoue, le carnet ne vit qu'en mémoire et n'écrit jamais. Aucune migration SQL,
   `SAVE_VERSION` reste 1.
6. **Écrit au plus tard avec le combat** (D6). `AscentSession.onBattle` appelle
   `discoveryBook.record(before, battle, events)` en mémoire, **avant** de remplacer `this.battle` :
   `before` est le combat sauvegardé à une reprise, `null` à un combat neuf. `save()` met l'écriture
   du carnet dans sa file, juste avant celle de l'ascension :
   `this.writing.then(() => book.flush().catch(() => undefined)).then(write)`. Un échec ou une
   attente du carnet ne retient ni ne saute jamais l'écriture de l'ascension : `flush()` se résout
   aussitôt tant que le carnet n'est pas lu, et ne rejette jamais. Les points de sauvegarde ne
   changent pas : chaque chute pour de bon arrive dans une mise à jour sauvegardée (un test le
   vérifie, frappes et contre-attaques comprises).
7. **La place de l'enregistrement face à l'attente de fin du combat** (condition 5 de l'analyse
   d'impact). L'enregistrement est fait **après** la garde `settling` de `onBattle`, avec le journal
   d'ascension. La mise à jour qui termine le combat passe toujours (la garde est posée après elle) ;
   les mises à jour ignorées pendant l'attente (fumée de la Brûlure, chute des invoqués, jusqu'à
   environ 800 ms) viennent après la fin du combat : aucune chute ni entrée n'y arrive, et leur
   première ligne est déjà enregistrée.
8. **Le carnet n'est jamais écrasé après une lecture ratée** (D7). `DiscoveryBookSession` lit la clé
   à la première demande. Tant que la lecture n'a pas réussi, les découvertes attendent en mémoire,
   sans aucune écriture, et aucune montée n'est rendue (on ne sait pas si l'entrée était déjà là) ;
   à la première lecture réussie, elles sont fusionnées (`mergeBooks`) puis écrites. L'écran montre
   l'erreur, « Réessayer » relit. Les écritures de la session passent par sa propre file.
9. **Le palier montré à l'ouverture** (D8) : celui de l'ascension en cours, sinon `lastTier` (le
   palier du dernier combat d'étage commencé, noté à chaque combat neuf), sinon le palier 1.
10. **La ligne du carnet est en mémoire** (D9). `AscentSession.newPages()` : les montées vers vaincu
    du combat, dans l'ordre des chutes ; remises à zéro à chaque combat neuf (jamais à une reprise),
    vidées à une défaite, au choix d'une sortie, au Passage de palier, à l'abandon, au lancement et
    au retour au pied de la tour. Une page remplie avant une pause compte encore à la reprise du même
    combat ; après une fermeture forcée, la ligne ne revient pas, les marques « nouveau » restent.
11. **Indépendance** (D10) : le carnet ne lit du combat que la première ligne et les événements, de
    l'ascension que le palier. Rien ne remonte vers le combat, le butin, les Éclats ou le Camp ; une
    même graine donne les mêmes écritures de `ascent.current` et les mêmes événements, carnet vide,
    plein ou absent.
12. **Build de preview seulement** (D11) : la route `/book` ramène à l'accueil sur un autre canal.
13. **Points d'extension** (D12) : `BestiaryRecord` acceptera `pageSeen?: true` sans changer de
    version (#283) ; la case reçoit `onOpen?` (absent ici : elle n'est pas un bouton) ; `items` et
    `ItemRecord` existent dès la version 1 ; l'écran garde la place des onglets (#284).
    La page d'un ennemi (#283) s'y branche : voir l'[ADR 0032](0032-page-d-un-ennemi.md) (la marque
    `pageSeen`, les cases ouvrables et la sortie du carnet face à une page poussée).

## Conséquences

- Un nouveau cas d'usage, `DiscoveryBookSession`, dépendance facultative de `AscentSession` : sans
  elle, l'ascension se joue exactement comme avant. Aucun port nouveau, aucune migration.
- La silhouette d'un ennemi rencontré est tirée de son portrait, en deux teintes de la palette d'art
  (`#252B48`, `#47527A`), les plus proches de l'encre de la maquette (`#232945`, `#46527F`) : aucune
  teinte n'est ajoutée à la palette.
- Risques acceptés : la ligne du carnet perdue après une fermeture forcée entre la victoire et la
  sortie ; un abandon au Passage de palier rouvre le carnet au palier précédent ; une lecture du
  carnet en échec pendant un combat n'annonce aucune page de ce combat.
- Rien ne quitte le téléphone ; une désinstallation seule efface le carnet.

## Avenant du 18 novembre 2026 — la lecture ratée est relancée d'elle-même

- **Décideur** : orchestrateur, 18/11/2026, sur le bug #295
- **Contexte** : après une lecture ratée, seules l'ouverture du carnet et « Réessayer » relisaient
  (§ 8). Une lecture ratée au démarrage, une Goule vaincue puis remplacée par un Renfort, et une
  fermeture sans ouvrir le carnet : la découverte, restée en mémoire, était perdue, et la relecture
  de la première ligne à la reprise ne la voyait plus (G2).

### Décision

1. **`flush()` relance une lecture ratée**, sans l'attendre : il se résout aussitôt, comme avant,
   tant que le carnet n'est pas lu. La lecture relancée, si elle réussit, fusionne les découvertes en
   attente et écrit le carnet par la file de la session (§ 8).
2. **Pourquoi `flush` et non `noteTier`** : `flush` est appelé à chaque point de sauvegarde de
   l'ascension, y compris dans un combat repris, où `noteTier` n'est pas appelé : chaque point de
   sauvegarde redonne une chance d'écrire les découvertes en attente. La relance ne précède pas pour
   autant l'écriture de l'ascension de ce point de sauvegarde (voir les conséquences). `record` n'en
   relance pas : il suit chaque mise à jour du combat.
3. **Invariants gardés** : rien n'est écrit tant que la lecture n'a pas réussi ; une valeur
   illisible est toujours copiée à part avant toute écriture ; l'écriture de l'ascension n'attend
   jamais la relecture ; au plus une lecture à la fois et une relance par point de sauvegarde, sans
   minuterie ni boucle de relecture.

### Conséquences

- Risque accepté : au point de sauvegarde où la relance réussit, le carnet s'écrit juste après
  l'ascension, et non juste avant (§ 6). Une fermeture forcée dans cet intervalle, d'environ un
  aller-retour du stockage, perd pour de bon les découvertes en attente qui ne sont plus en première
  ligne du combat sauvegardé : la relecture de la première ligne à la reprise ne les voit plus. Ce
  risque n'existe qu'après une lecture ratée.
- Risque résiduel, soumis au propriétaire : si la lecture échoue à chaque point de sauvegarde
  jusqu'à la fermeture ou la fin de l'ascension, les découvertes en attente sont perdues. Il est
  inévitable avec D7, qui interdit d'écrire un carnet non lu, et reste un écart à G2 de #282. C'est
  une nette amélioration par rapport à avant, où une seule lecture ratée au démarrage suffisait à
  perdre toutes les découvertes de l'ascension tant que le carnet n'était pas ouvert.
- Pendant une relance, le carnet affiché passe de l'erreur à la lecture, comme avec « Réessayer ».
