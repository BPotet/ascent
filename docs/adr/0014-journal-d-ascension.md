# ADR 0014 — Le Journal d'ascension et son export

- **Statut** : accepté, amendé par l'[ADR 0016](0016-journal-des-combats.md) (#197)
- **Avenants** : 5 novembre 2026, les relances de l'offre de bienfaits (#42) et la seconde chance
  (#206), voir en fin de document
- **Date** : 4 novembre 2026
- **Décideur** : Architect (notes techniques de #196), écrit par le dev
- **Contexte produit** : épique #193, story socle #196 « Exporter le journal du parcours de mes
  ascensions »

## Contexte

Le propriétaire teste et règle la tour. Pour rééquilibrer la tour à partir de ses vraies parties,
il veut envoyer, depuis l'APK de preview, le récit de ses 20 dernières ascensions : où il tombe et ce
qu'il choisit. Rien de cela n'est gardé aujourd'hui : la clé `ascent.current` du Stockage clé-valeur
est effacée à la fin de chaque ascension. Le journal ne doit contenir aucune donnée des habitudes,
ne jamais ralentir le combat ni la sauvegarde de l'ascension, et n'exister que dans le build de
preview. La story suivante de l'épique (#197) y ajoutera le détail des combats.

## Décision

### 1. Un journal qui observe l'ascension

Le **Journal d'ascension** (`AscentLog`, `src/domain/ascentLog/`) est un état immuable et
sérialisable, construit par des fonctions pures : `beginAscentLog(ascent, day)`,
`recordAscentStep(log, step)` et `resumeAscentLog(log, ascent)`. Chaque `step` est une transition
que fait déjà la session d'ascension, avec sa cause et l'état `Ascent` **avant** et **après** :
bénédiction prise, objet équipé ou laissé, bienfait pris, sortie franchie, début et fin d'un combat
d'étage (PV et Élan), abandon, boss vaincu, palier suivant. Le journal ne rappelle aucune règle du
domaine et ne tire aucun hasard : il lit les différences entre les deux états.

- Un étage est identifié par `(palier, étage)` : il est remplacé, jamais ajouté deux fois.
  `resumeAscentLog` ajoute l'étage courant s'il manque (reprise après une fermeture forcée).
- L'abandon est une cause explicite : `abandonAscent` finit l'ascension comme une chute.
- Les bénédictions de départ n'y figurent que par leur famille et leur rareté : le type ne prévoit
  aucun autre champ, et un test cherche dans le fichier sérialisé le nom d'une habitude.

### 2. Un enregistreur à part, branché en option sur la session d'ascension

`AscentLogRecorder` (`src/application/useCases/`) tient le journal de l'ascension en cours en
mémoire. `AscentSession` reçoit une dépendance **optionnelle** `ascentLog` : absente, rien ne
change. Présente, la session enregistre chaque transition avant la sauvegarde de l'ascension, puis
demande l'écriture du journal **juste après** (aux mêmes points : choix, pause, fin de combat), et
jamais pendant un combat.

Le journal s'écrit par **sa propre file**, séparée de celle de l'ascension : une écriture à la fois,
au plus une en attente par ascension (la dernière gagne). Il n'attend jamais la sauvegarde de
l'ascension ni le Total d'Éclats, et ne les retarde jamais ; un échec est avalé et réessayé à
l'écriture suivante.

### 3. Le Stockage clé-valeur, sans migration

Le port `AscentLogStore` est implémenté par `KeyValueAscentLogStore` sur le Stockage clé-valeur
existant (table `key_value` de la migration 0001) : un index `ascent.log.index`
(`{ formatVersion, nextId, ids }`, du plus ancien au plus récent) et une clé `ascent.log.<id>` par
journal, en JSON compact. Seuls les **20 derniers** journaux sont gardés, celui en cours compris :
commencer la 21ᵉ ascension efface le plus ancien. Un index illisible repart vide ; ses anciennes
clés sont écrasées au fil des nouveaux journaux.

### 4. Un format versionné

Chaque journal et l'export portent `formatVersion: 1` ; l'export porte aussi la version de l'app et
le canal du build. Ajouter un champ garde la version ; changer le sens d'un champ la fait passer à
2. Un journal abîmé ou d'une version inconnue est laissé de côté à l'export et compté
(`ignoredLogs`) ; il ne bloque jamais l'ascension.

### 5. `expo-sharing` et `expo-file-system` pour le Menu de partage

L'**Export du journal** est un fichier JSON lisible (`ascent-journal-AAAA-MM-JJ.json`), écrit dans
le cache de l'app (`expo-file-system`, aucune permission de stockage) puis envoyé par le **Menu de
partage** d'Android (`expo-sharing`). Le port `FileShare` se résout quand le menu se referme :
Android ne dit pas si le fichier est parti ; il n'y a donc pas de message de succès.

Écarté : `Share.share({ message })` de React Native. Il partage du texte et non un fichier, et un
JSON de quelques centaines de Ko frôle la limite des transactions Binder d'Android, que les
combats de #197 dépasseront.

`expo-sharing` est le seul module natif nouveau : il faut une APK reconstruite. Son plugin de
configuration ne sert qu'à **recevoir** des partages ; il n'est pas ajouté à `app.json`.

### 6. Le build de preview seulement

`src/app/ascent.tsx` (`ascentLogFeature`) n'assemble l'enregistreur et l'export que si
`currentBuildChannel()` vaut `preview`. Sur tout autre canal, la session n'a pas de journal et les
écrans (écran de fin de l'ascension, Pied de la tour) ne reçoivent pas `logExport` : aucun bouton.

## Conséquences

- Aucune migration, aucune table nouvelle ; les clés `ascent.current` et `shards.total` ne changent
  pas. 20 journaux font environ 120 Ko en base.
- Une ascension commencée avant cette version n'a pas de journal ; le journal commence avec la
  première ascension commencée après.
- Si l'app est tuée entre la sauvegarde de l'ascension et celle du journal, le journal peut manquer
  le dernier choix : l'étage courant est rétabli à la reprise, sans doublon. Acceptable pour un outil
  de test.
- #197 ajoutera les combats sous une clé par combat (`ascent.log.<id>.battle.<palier>-<étage>`), pour
  qu'un combat ne réécrive jamais tout le journal, en restant en `formatVersion: 1`.

## Avenant du 5 novembre 2026 — les relances de l'offre de bienfaits (#42)

Une **Relance** (`Reroll`) remplace l'offre de bienfaits en attente par une nouvelle offre. Le
journal la note par une nouvelle cause, `boonOfferRerolled`, comme les autres transitions de la
session (état avant et après, aucun tirage).

- L'étage reçoit un champ **facultatif** `rerolledOffers` : les offres remplacées, dans l'ordre. Il
  est absent sans relance ; un journal sans relance est identique, octet pour octet, à celui d'avant.
- `boonsOffered` reste l'offre dans laquelle le joueur choisit, donc la dernière : `boonChosen` en
  fait toujours partie.
- Les relances qui restent ne sont pas écrites : elles se déduisent de la jauge (`gauge`) et du
  nombre d'offres remplacées.
- **`formatVersion` reste 2** (§ 4) : c'est un champ ajouté, pas un sens changé. Un journal d'avant
  se relit tel quel.

## Avenant du 5 novembre 2026 — la seconde chance (#206)

La **Seconde chance** (`SecondChance`) relève une fois le héros qu'un coup fait tomber à 0 PV. Le
journal note l'étage où elle a servi, sans nouvelle cause : la transition `battleEnded` le voit sur
l'ascension (`before.secondChance && !after.secondChance`).

- L'étage reçoit un champ **facultatif** `secondChanceUsed: true`, posé que le combat soit gagné ou
  perdu. Il est absent ailleurs ; un journal sans seconde chance utilisée est identique, octet pour
  octet, à celui d'avant.
- Aucune donnée des habitudes : la jauge est déjà notée (`gauge: 'fullFavor'`).
- **`formatVersion` reste 2** (§ 4) : c'est un champ ajouté. Un journal d'avant se relit tel quel.
