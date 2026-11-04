# ADR 0015 — Les Déblocages de l'ascension

- **Statut** : accepté
- **Date** : 4 novembre 2026
- **Décideur** : Architect (notes techniques de #195, complétées par l'analyse d'impact du
  04/11/2026), écrit par le dev
- **Contexte produit** : épique #194 (le camp), story #195 « Veillée d'hiver et contenus à
  débloquer dans la tour » ; décision du propriétaire du 03/11/2026 (règles C5 à C8 et C10)

## Contexte

Le camp (#40) vendra des contenus de la tour contre des Éclats : Cœur de braise, l'Épieu de chasse,
la Clochette du guet et la Flamberge, le premier objet Épique. Avant le camp, la tour doit savoir
faire entrer ces contenus quand ils sont débloqués, et seulement alors. Cœur de braise quitte donc
la liste des bienfaits tirés dans chaque offre ; Veillée d'hiver prend sa place. Le palier 1 a un
tirage figé (`testing/tierOneDraws.ts`, #38) : sans Déblocage, la tour doit tirer exactement comme
avant, au renommage près.

## Décision

### 1. Les Déblocages sont un champ de l'ascension, figés à son début

- `src/domain/ascent/unlocks.ts` : `type Unlock = 'huntingSpear' | 'watchBell' | 'emberHeart' |
  'flamberge'`, `UNLOCKS` (l'ordre du catalogue du camp) et `unlockedItems(unlocks)`. Il importe
  `items`, jamais l'inverse.
- `Ascent.unlocks` : les Déblocages de l'ascension. `startAscent` les recopie, sans doublon, depuis
  `AscentLaunch.unlocks` (aucun par défaut) ; rien d'autre ne les change jusqu'à la fin de
  l'ascension. Ils sont sauvegardés avec elle : pause, reprise et fermeture forcée les gardent. Un
  Déblocage obtenu pendant une ascension ne compte qu'à partir de la suivante.
- `Ascent.emberHeartOffered` : Cœur de braise a déjà été proposé dans l'ascension, pris ou non.

### 2. Les bienfaits de base, distincts des bienfaits à débloquer

- `BOON_KINDS` garde les 8 bienfaits (registres de textes et d'icônes) ; `BASE_BOON_KINDS` est la
  liste de base, les 7 sans Cœur de braise. `boonWeights` et donc `drawBoonOffer` ne tirent que
  dans `BASE_BOON_KINDS`.
- Veillée d'hiver (`winterVigil`) prend **exactement la place** de Cœur de braise dans la liste de
  base : même position (la dernière), même poids (Épique, 1). Les tirages sont donc identiques ;
  seul le nom change dans les offres. `emberHeart` reste dans `BOONS`, à la fin : c'est un nom de
  code de sauvegarde (ADR 0010), et le bienfait existe toujours.

### 3. Aucun tirage de plus sans Déblocage

- **Objets** : `drawItem` et `drawLoot` reçoivent les objets débloqués (`unlocked`, vide par
  défaut). Le pool d'une rareté est fait des objets de cette rareté, non portés, et qui ne sont pas
  à débloquer ou le sont. À l'Élite, **le tirage de rareté existant est réutilisé** : sous 20 %
  (`EPIC_ITEM_CHANCE`, sans décalage de la jauge) et s'il reste un Épique débloqué non porté, le
  pool est celui des Épiques ; sinon la règle d'avant (Rare, Commun si tous les Rares sont portés).
  Hors Élite, jamais d'Épique. L'index se tire comme avant : le flux rendu est le même avec et sans
  Déblocage.
- **Cœur de braise** : après une Élite, et seulement s'il est débloqué, pas possédé et pas encore
  proposé, `offerEmberHeart` fait **un** tirage sur le flux du butin, après l'offre. Sous 10 %, il
  remplace le 3e bienfait de l'offre ou s'y ajoute (une offre vide devient une offre de lui seul) ;
  `emberHeartOffered` passe à vrai dès qu'il est proposé. Sinon, aucun tirage.
- Le tirage figé du palier 1 ne change que par le renommage `emberHeart` → `winterVigil`, fait
  sans régénérer et vérifié par `git diff --word-diff`.

### 4. Pas de nouvelle version de sauvegarde

`SAVE_VERSION` reste 1. Une ascension sauvegardée avant #195 est relue avec `unlocks: []` et
`emberHeartOffered: false` (valeurs par défaut de `parse`, comme #92, #93 et #38). Un Cœur de
braise possédé ou dans une offre en attente est relu tel quel : son nom de code existe toujours.

### 5. L'entrée des Déblocages : `AscentLaunch.unlocks`

`AscentSession.begin(launch)` reçoit déjà l'`AscentLaunch` ; il porte maintenant `unlocks`. Dans
#195, personne ne le remplit : la liste est toujours vide pour le joueur. #40 ajoutera la lecture
des Déblocages achetés (son port de stockage) et les passera à `begin`. Aucun port n'est créé ici :
il serait vide et non testé.

## Conséquences

- Sans Déblocage, la tour est celle d'avant ; `tierOne.unchanged.test.ts` et les tests « même flux
  avec et sans Déblocage » le gardent.
- Un appelant qui tirerait dans `BOON_KINDS` ferait revenir Cœur de braise dans les offres : les
  tirages passent par `boonWeights`, et un test sur 10 000 graines le vérifie.
- La porte Élite garde « objet Rare garanti » (décision du propriétaire), même quand la Flamberge
  peut y tomber.
- « Objet trouvé » affiche la rareté d'un objet Épique (« ◆◆◆ Épique » à la couleur Épique) ; les
  objets Communs et Rares ne changent pas.
- Une app plus ancienne ne connaît ni `winterVigil` ni les trois objets : pas de retour arrière
  prévu, comme pour les ajouts précédents.
