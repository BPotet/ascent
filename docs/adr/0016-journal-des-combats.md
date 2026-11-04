# ADR 0016 — Le journal des combats

- **Statut** : accepté
- **Date** : 4 novembre 2026
- **Décideur** : Architect (notes techniques de #197), écrit par le dev
- **Contexte produit** : épique #193, story #197 « Le journal raconte mes combats, appui par appui »
- **Amende** : [ADR 0014](0014-journal-d-ascension.md), sur deux points (voir « Amendements »)

## Contexte

Le Journal d'ascension (#196, ADR 0014) raconte le parcours d'une ascension. Pour rééquilibrer les
ennemis à partir de ses vraies parties, le propriétaire veut aussi le récit de chaque combat d'étage :
quelles parades et quelles frappes il réussit ou rate, et de combien. Le moteur juge déjà chaque
appui (`judgePress`, fenêtres de 60 et 160 ms) et l'annonce par ses événements de combat. Le journal
ne doit ni rejuger un appui, ni ralentir le combat, ses sons et ses animations, ni retarder la
reprise d'une ascension.

## Décision

### 1. Le journal observe les événements de combat

`BattleLog` (`src/domain/ascentLog/BattleLog.ts`) est un état immuable et sérialisable, construit par
des fonctions pures : `beginBattleLog(place, battle, at)`, `recordBattleEvents(log, battle, events)`,
`pauseBattleLog(log, at)` et `resumeBattleLog(log, at, cause)`. Il ne rappelle aucune règle et ne
tire aucun hasard : l'écart et le jugement notés sont ceux de `strikeResolved`, `blowResolved` et
`whiffed`.

- **En-tête** : le palier, l'étage, le type de combat, l'issue (`inProgress`, `won`, `lost`), le
  héros et les ennemis au début (palier, PV, garde, Initiative), la réserve, `tierMultiplier` et
  `summonMultiplier`, la durée hors pause, les reprises (`pause` ou `reopen`), le garde-fou.
- **Manches** : le début, la durée, l'ordre d'action publié, les intentions tirées, les actions, les
  effets hors action (début de manche, fin du combat) et les appuis ignorés comptés par bouton et par
  cause.
- **Actions**, une par `(manche, acteur)` : ouverte par l'avancée d'un ennemi (du type de son
  intention), sa préparation, l'effet de son intention, son action perdue ou son retour en garde à la
  place de l'action ; pour le héros, sa frappe en rythme ou son pouvoir.
- **Appuis** : frappes (`perfect`, `good`, `miss`, ou `null` sans appui), défenses (`perfectParry`,
  `parry`, `dodge`, `perilousParry`, `suffered`) et appuis ratés (`early`, `late`, `empty`), avec leur
  écart.
- **Effets** : l'événement tel quel, sans ses instants du moteur. Les événements de mise en scène
  (cible, bulle d'aide, transition, avancée, fausse amorce, impact, arrêt sur image, déséquilibre)
  ne sont pas notés.

Deux champs sont **ajoutés** à des événements de combat, sans rien changer à une règle :

- `roundStarted.intents` : l'intention tirée par chaque place de la première ligne (`null` pour un
  ennemi tombé), posée juste après les tirages. L'état publié ne suffit pas : une même avance peut
  déjà avoir consommé l'intention du premier ennemi qui agit.
- `whiffed.delta` : l'écart d'un appui trop tôt ou trop tard, que le moteur calcule pour le juger ;
  absent pour un appui dans le vide. Sans lui, le journal aurait dû recalculer l'écart d'un appui raté
  (« trop tôt, −200 ms »). *Écart aux notes techniques, qui ne prévoyaient que `intents`.*

`enemyInitiative` est exporté tel quel, pour noter l'Initiative des ennemis au début.

### 2. Le temps de combat hors pause

Seul `t`, le temps de combat écoulé hors pause, est noté : `t = base + (at − segmentAt)`. Le segment
s'ouvre au début du combat et à chaque reprise, et se ferme à la pause. Après une fermeture forcée, la
base repart de la durée écrite à la dernière sauvegarde : le temps app fermée ne compte pas. Les
instants du moteur d'avant et d'après une reprise ne sont pas comparables (base monotone) ; les
instants d'impact d'une attaque sont notés en écarts depuis le début de sa préparation.

### 3. Reprise sans doublon

Une action est identifiée par `(manche, acteur)`, un impact jugé par `(manche, ennemi, index)` et une
frappe par `(manche, rang de l'action du héros, coup)` : un impact ou une frappe rejoués remplacent
l'ancien. Les appuis ratés et ignorés, sans identité, sont ajoutés.

### 4. Le garde-fou

Au-delà de **3 000 entrées** (appuis et effets), les manches suivantes sont notées sans détail (début,
durée, ordre, intentions) et `truncated` est posé. Le pire cas reste bien sous 1 Mo par clé, loin de
la limite de 2 Mo par ligne de SQLite sur Android ; un test d'intégration l'écrit et le relit.

### 5. Une clé par combat, sans migration

`KeyValueAscentLogStore` écrit chaque combat sous `ascent.log.<id>.battle.<palier>-<étage>`, en JSON
compact (`saveBattle`, `readBattles`). Le journal liste ses combats (`battles`, palier et étage),
mis à jour au début de chaque combat ; à l'éviction, les combats listés par le journal évincé sont
effacés avant lui. Un journal évincé illisible laisse ses combats orphelins (quelques dizaines de Ko).
`KeyValueStore` ne change pas.

### 6. Une seule file, rien dans la pile du combat

`AscentLogRecorder` tient le combat en cours en mémoire. `recordBattle` n'y fait que des ajouts, en
O(nombre d'événements de la mise à jour) : seules la manche en cours et ses actions sont recopiées.
La même file écrit le parcours puis le combat (jamais le combat avant l'identifiant du journal), une
écriture à la fois, au plus une en attente par ascension et par combat, la dernière gagnant ; un
échec est avalé et réessayé. La sérialisation se fait après un `await`, hors de la pile de
`BattleSession.apply`, dont les sons et les vibrations sont déjà joués.

`AscentSession` commence le combat avec un combat neuf, note la reprise, enregistre chaque mise à
jour, arrête le temps à la pause, et fait écrire le journal aux mêmes points de sauvegarde que le
combat (`SAVED_ON`), jamais entre deux.

À la reprise d'une ascension, le combat en cours (le dernier listé, s'il est à l'étage courant) est
relu **sans être attendu** : l'affichage de la reprise n'attend pas cette lecture. Les changements
reçus d'ici là sont appliqués une fois le combat relu ; sa reprise suivante est notée `reopen`.

### 7. Format version 2

Le journal et l'export passent en `formatVersion: 2`. `parseAscentLog` lit les versions 1 et 2 ;
l'export porte, pour chaque journal de version 2, ses combats complets triés par palier puis étage,
et compte les combats illisibles (`ignoredBattles`). Un journal de version 1 reste tel quel, sans
combats, marqué de sa version ; une ascension en cours avec un journal de version 1 continue ainsi
jusqu'à sa fin, sans combats.

## Amendements à l'ADR 0014

1. **Le journal s'écrit aussi pendant un combat**, aux points de sauvegarde du combat (ADR 0014,
   décision 2 : « jamais pendant un combat »).
2. **Le format passe en version 2** (ADR 0014, conséquences : « en restant en `formatVersion: 1` ») :
   le sens de l'export change (il porte les combats), et les journaux de version 1 restent lisibles.

## Conséquences

- Aucune migration, aucune table ; `ascent.current`, `shards.total` et `ascent.log.index` ne changent
  pas. Un combat ordinaire fait 5 à 20 Ko, un boss long environ 60 Ko ; l'export quelques Mo pour 20
  ascensions, envoyé comme un fichier.
- La sérialisation de la clé du combat à chaque point de sauvegarde occupe le fil JS hors de la pile
  du jugement ; les touchers sont datés sur le fil UI (ADR 0005). À surveiller à la main sur l'APK de
  preview, au boss long.
- Si le journal est écrit mais pas la sauvegarde du combat, un appui raté ou ignoré d'un instant
  rejoué peut figurer deux fois : acceptable pour un outil de test.
- Les combats joués avant cette version restent sans détail.
