# ADR 0004 — Mutation en CI : lignes nouvelles, jobs parallèles

- **Statut** : accepté
- **Date** : 22 octobre 2026
- **Décideur** : Architect
- **Contexte produit** : PR #29 (story #23)
- **Avenant** : 22 octobre 2026, mutation des écrans à la demande (issue #54, voir en fin de document)
- **Révisé** : 22 octobre 2026, le groupe `core` est réparti en parts parallèles (voir en fin de document)
- **Avenant** : 29 octobre 2026, le domaine est réparti en parts, un gros fichier coupé en plages de lignes (issue #131, voir en fin de document)
- **Avenant** : 29 octobre 2026, le `core` de la release est pesé en mutants et coupé en plages, jusqu'entre les membres d'une classe (issue #134, voir en fin de document)
- **Avenant** : 29 octobre 2026, délai du « dry run » fixé, écrans pesés en mutants et répartis plage par plage (issue #145, voir en fin de document)
- **Avenant** : 29 octobre 2026, délai par mutant propre aux écrans (issue #147, voir en fin de document)

## Contexte

Jusqu'ici, une PR mutait **en entier** chaque fichier de `src/` qu'elle modifiait
(`scripts/mutation-changed.mjs`, un seul job). Sur la PR #29 (story #23), cela donnait 1 606
mutants. À environ 6 mutants par minute, il fallait environ 4 h 30 : le job a été annulé à son
délai de 60 minutes, sans résultat.

La mesure locale du QA sur cette PR, limitée au code réellement nouveau, donne 73 + 96 + 236
mutants (domaine, application et adaptateurs hors interface, interface), soit environ 1 h 05 en
une seule exécution.

L'écart de l'ADR 0001 « Mutation en PR par fichier modifié » reposait sur l'idée que StrykerJS ne
mute que des fichiers entiers. C'est faux : une entrée `mutate` accepte une plage de lignes
(`fichier:début-fin`), et Stryker additionne les plages d'un même fichier.

## Décision

1. **Hors domaine, on ne mute que les lignes ajoutées ou modifiées** depuis la base de fusion avec
   la branche cible (`git diff -U0`). C'est la définition du « code nouveau » de
   `docs/workflow.md` et de SonarQube. Un fichier ajouté est muté en entier.
2. **Dans le domaine, les fichiers modifiés restent mutés en entier**, avec les seuls tests
   unitaires (`stryker.domain.config.mjs`).
3. **La mutation est répartie en jobs parallèles** : `mutation-plan` calcule les parts (shards),
   un job `mutation-shard` mute chaque part, puis le job final `mutation` rassemble les rapports.
   Les parts sont faites par fichier, sans jamais couper un fichier ; chaque fichier n'est muté
   qu'une fois (PR #21 respectée). En PR : `domain`, `core` (application, persistance, téléphone et
   tout futur dossier), `ui-1` et `ui-2` (adaptateurs d'interface et routes) ; en release, hotfix
   ou à la demande, tout le code en 13 parts.
4. **Les seuils ne s'appliquent qu'au job final**, sur le total des shards, avec la formule de
   Stryker (`mutation-testing-metrics`) : 85 % pour le domaine, 70 % pour le code nouveau hors
   domaine. Les shards tournent sans seuil bloquant.
5. **Aucun seuil ne change.** Les listes `mutate` de `stryker.config.mjs` et
   `stryker.domain.config.mjs` restent la source de vérité de ce qui est muté.

Mise en œuvre : `scripts/mutation/` (`plan.mjs`, `run.mjs`, `score.mjs`, testés par
`npm run test:scripts`). Les chemins sont échappés (`src/app/(tabs)/…`, une future route `[id]`) :
chaque caractère spécial est mis dans une classe d'un seul caractère (`[(]`), car Stryker remplace
toute barre oblique inverse d'un motif par `/`, ce qui rend l'échappement habituel (`\(`) inopérant
sans aucune erreur. Chaque entrée est vérifiée contre la comparaison de Stryker au moment du plan :
un motif qui ne correspond à rien, ou un glob combiné à une plage, fait échouer le plan au lieu de
fausser la mesure en silence. En local,
`npm run mutation:changed` enchaîne les shards puis `npm run mutation:score` ; `npm run mutation`
et `npm run mutation:domain` mutent toujours tout le code.

## Alternatives rejetées

- **Allonger seulement le délai** : les PR resteraient bloquées des heures.
- **Un seuil par shard** : plus strict que la règle, et de petits shards échoueraient par hasard.
- **`ignoreStatic`** : c'est une exclusion de mutants, qui fausse le score.
- **`--incremental` avec un cache** : piste pour plus tard, sur les releases.
- **Réduire les tests du shard `ui`** : moins de mutants seraient tués, donc le score changerait.

## Conséquences

- Un mutant dont le nœud déborde sur des lignes inchangées n'est pas compté (par exemple, la
  suppression d'un bloc dont une seule ligne a changé), comme dans la définition de SonarQube. Le
  domaine n'est pas concerné (fichiers entiers), et la release mute tout.
- Le « dry run » de Stryker est payé une fois par shard : plus de minutes de CI, gratuites pour un
  dépôt public.
- `PARTS` (`scripts/mutation/plan.mjs`) et les délais des jobs sont des réglages à recalibrer, pas
  des seuils. `PARTS.full` reste à calibrer par un lancement manuel du workflow.
- Une release lance 13 shards en plus des autres jobs : avec la limite de 20 jobs simultanés de
  GitHub, un peu d'attente est possible.
- Le check `Mutation tests (StrykerJS)` garde son nom, pour ne pas casser une protection de branche
  qui l'exigerait.
- L'écart « Mutation en PR par fichier modifié » de l'ADR 0001 est supprimé.

## Avenant du 22 octobre 2026 — mutation des écrans à la demande

- **Décideur** : le propriétaire
- **Contexte produit** : issue #54

### Contexte

Même réduite aux lignes nouvelles, la mutation des écrans (`src/adapters/ui/` et `src/app/`) prend
plusieurs dizaines de minutes par PR (parts `ui-1` et `ui-2` de la PR #47, story #31). Elle ralentit
trop chaque story.

### Décision

1. **Par défaut, les écrans ne sont pas mutés** : PR, push, release, hotfix, `npm run mutation`,
   `npm run mutation:changed` et `npm run verify:full`. Ils sortent de la liste `mutate` de
   `stryker.config.mjs` et ont leur propre config, `stryker.ui.config.mjs`, qui reprend les seuils
   du code nouveau.
2. **Le reste est toujours muté, avec les mêmes seuils** : `src/domain/` (85 %),
   `src/application/`, `src/adapters/persistence/` et `src/adapters/device/` (70 %).
3. **La mutation des écrans tourne à la demande du propriétaire** :
   - label `mutation:ui` sur une PR, posé par l'orchestrateur. Quand le label est posé, le workflow
     `Screen mutation` (`.github/workflows/mutation-ui.yml`) mute les lignes nouvelles des écrans ;
     ensuite, pour une PR vers `develop`, chaque push de la PR est muté par `ci.yml` écrans
     compris, car le plan lit le label. Pour une PR de release ou de hotfix vers `main`, `ci.yml`
     ne mute pas la PR : les écrans n'y sont mutés que sur le commit où le label est posé ;
   - lancement manuel du workflow `CI` avec l'entrée booléenne `ui-mutation` (tout le code) ;
   - en local, `npm run mutation:ui` (lignes nouvelles des écrans ; `-- --full` pour tous).
4. **Quand elle tourne, les seuils actuels s'appliquent** : les shards d'écrans sont dans la classe
   du code nouveau (70 %). Aucun seuil ne change.
5. **L'orchestrateur ne pose le label qu'à la demande du propriétaire, et attend le résultat avant
   de merger.** Le check `Screen mutation tests (StrykerJS)` n'existe que sur le commit où le label
   est posé : il ne peut pas être exigé par la protection de branche (un check exigé qui ne
   s'exécute pas bloquerait toutes les autres PR). L'orchestrateur attend donc qu'il soit vert
   avant d'activer l'auto-merge (`/dev-story`, étape Merge), et le désactive s'il était actif.
6. **Le résumé de la CI le dit** : « Screen mutation (…) not requested », avec le nombre de fichiers
   d'écran modifiés non mutés et les moyens de la demander ; ou « requested » quand elle tourne.

Mise en œuvre : `buildPlan()` reçoit l'option `ui` (`exclude` par défaut, `include`, `only`),
choisie par `MUTATION_UI` ou les options `--ui` et `--ui-only` de `scripts/mutation/run.mjs`.

### Alternatives rejetées

- **Ajouter `labeled` aux événements de `ci.yml`** : chaque label (`status:*`…) relancerait toute la
  CI, ou, avec des jobs sautés, couperait le run en cours (même groupe de concurrence) et
  publierait des checks « skipped » qui masqueraient ceux déjà rendus pour le même commit.
- **Relancer les jobs de mutation du run de CI existant** : le run garde les labels de son
  événement d'origine ; il faudrait lire les labels par l'API et attendre la fin du run.
- **Retirer les écrans de la mutation pour de bon** : hors de la décision du propriétaire.
- **Rendre le check `Screen mutation tests (StrykerJS)` exigé** : il n'existe que sur les commits
  où le label est posé ; exigé, il bloquerait toutes les PR sans label.

### Conséquences

- Une PR, une release et un hotfix lancent moins de shards : 3 au plus en release au lieu de 13.
- Quand le label est posé sur une PR ouverte, la mutation des écrans a son propre check
  (`Screen mutation tests (StrykerJS)`), avec un score calculé sur les écrans seuls. Pour une PR
  vers `develop` seulement, aux pushs suivants, elle est comptée dans le check habituel
  `Mutation tests (StrykerJS)` ; pour une PR de release ou de hotfix vers `main`, elle ne porte
  que sur le commit où le label est posé.
- Pour un autre label, les jobs du workflow `Screen mutation` portent un autre nom (« Label without
  mutation … ») : aucun check sauté ne masque un échec de la mutation des écrans sur le même commit.
- Cas limite accepté : une PR créée avec le label déjà posé mute ses écrans deux fois (`ci.yml` à
  l'ouverture, et `mutation-ui.yml`, car GitHub émet aussi un événement `labeled` à la création).
  Les deux résultats doivent être verts.
- Les agents `dev`, `qa` et `reviewer` n'exigent plus la mutation des écrans quand elle n'a pas été
  demandée.

## Révisé le 22 octobre 2026 — mutation du « core » en parts parallèles

- **Décideur** : le propriétaire
- **Contexte produit** : PR #59, qui porte la décision ; mesures prises sur la PR #50 (story #24)

### Contexte

Depuis l'avenant sur les écrans, une PR ne lance plus que deux shards : `domain` et `core`
(application, persistance, téléphone et tout futur dossier hors domaine et hors écrans). Le shard
`core` est devenu le plus long de la CI : environ 25 minutes sur une PR, dont 19 de mutation sur la
PR #50 (299 lignes nouvelles hors domaine), alors que le shard `domain` finit en moins de
3 minutes.

Ce que coûte un shard `core` :

- **Par mutant** : environ 10 secondes en CI (les 6 mutants par minute mesurés plus haut), avec
  `coverageAnalysis: 'perTest'` et `concurrency: 4`.
- **Coût fixe par shard** : environ 5 minutes. Installation (`npm ci`), puis « dry run » de Stryker,
  qui passe toute la suite Jest (130 suites, plus de 2 000 tests, environ 2 min 30 en local) pour
  mesurer la couverture par test. Ce coût est payé par chaque shard, quel que soit son nombre de
  mutants.

### Décision

1. **`PARTS.changed.core` passe de 1 à 3** : sur une PR, le code nouveau hors domaine et hors
   écrans est réparti en `core-1`, `core-2` et `core-3`, par fichier, sans couper un fichier, comme
   les écrans. Durée estimée d'un shard : 5 minutes de coût fixe et environ un tiers des
   14 minutes de mutation, soit **10 minutes environ au lieu de 25**. Au-delà de 3 parts, le coût
   fixe domine (4 parts : environ 8 min 30 ; 6 parts : environ 7 min 30) pour plus de minutes de
   CI et de jobs simultanés.
2. **`PARTS.full.core` passe de 2 à 6** : en release, en hotfix ou au lancement manuel, le groupe
   `core` compte environ 2 000 lignes, soit 7 fois le code nouveau de la PR #50. Avec 2 parts,
   chacune durait près d'une heure (délai : 120 minutes) ; avec 6, environ 20 minutes chacune.
3. **Une seule part reste une seule part** : `split()` supprime les parts vides. Une PR qui ne
   touche qu'un fichier `core` garde un unique shard nommé `core`, sans coût fixe en trop.
4. **Rien d'autre ne change** : seuils (85 % pour le domaine, 70 % pour le code nouveau), score
   calculé au job final sur le total des shards, mutation des écrans à la demande, `PARTS.ui`.

Mise en œuvre : `PARTS` dans `scripts/mutation/plan.mjs`, testé par `npm run test:scripts`. Le
plan de la PR #50 rejoué avec `node scripts/mutation/run.mjs --plan` donne trois parts de 98, 103
et 98 lignes ; le plan complet, six parts de 336 à 344 lignes.

### Conséquences

- Une PR lance jusqu'à 4 shards de mutation (`domain`, `core-1` à `core-3`) au lieu de 2, et 6 avec
  les écrans demandés. Le coût fixe est payé 3 fois pour `core` : plus de minutes de CI, gratuites
  pour un dépôt public.
- Une release lance jusqu'à 7 shards de mutation (17 avec les écrans demandés), sous la limite de
  20 jobs simultanés de GitHub, avec un peu d'attente possible pendant les autres jobs.
- Un fichier très modifié reste dans une seule part : le shard le plus long est au moins celui de
  ce fichier.
- `PARTS` reste un réglage à recalibrer d'après la durée des shards en CI, pas un seuil.

## Avenant du 29 octobre 2026 — le domaine en parts, un gros fichier coupé en plages de lignes

- **Décideur** : Architect
- **Contexte produit** : issue #131 ; constat sur la PR #126 (rapport QA du 29 octobre 2026)

### Contexte

Sur la PR #126, le shard `domain` a été annulé à son délai de 60 minutes, sans score. Il mutait
`src/domain/battle/Battle.ts` en entier (décision 2) : 1 512 lignes, 1 226 mutants, environ 3 h en
local. Le temps vient surtout des mutants qui rendent une boucle du moteur infinie (81 sur les 212
premiers) : chacun coûte le délai `timeoutMS` (10 s) et un redémarrage du processus de test. Ils
comptent comme détectés : le score partiel était d'environ 98 %.

Le problème était masqué : les PR précédentes sur `Battle.ts` (#95, #96, #99, #100, #112, #114)
étaient en mode `prototype`, sans mutation. Il frappera toute PR qui modifie ce fichier (#128 la
première). La release est aussi exposée : tout le domaine (52 fichiers, environ 5 200 lignes) est
muté dans un seul shard limité à 120 minutes, alors que `Battle.ts` seul en demande environ 180.

La décision 3 interdisait de couper un fichier entre deux parts. Hors domaine, cela ne coûte rien :
seules les lignes nouvelles sont mutées. Dans le domaine, un seul gros fichier fixe la durée du
shard.

### Décision

1. **Un gros fichier du domaine est muté en plusieurs plages de lignes, réparties entre les
   parts.** Au-delà de `CHUNK_LINES.domain` lignes (250 au départ), le plan coupe le fichier en
   plages contiguës qui le couvrent de la première à la dernière ligne. Le fichier reste muté
   **en entier** (décision 2 inchangée), sur plusieurs shards.
2. **On ne coupe qu'entre deux instructions de premier niveau** (déclarations de fonctions, de
   types, de constantes, imports), lues avec l'API du compilateur TypeScript. Stryker ne garde un
   mutant que si son nœud est **entièrement** dans une plage (`locationIncluded` de
   `@stryker-mutator/instrumenter`) : une coupe au milieu d'une fonction perdrait en silence les
   mutants qui la traversent, par exemple le bloc vidé de cette fonction. Aucun mutant ne traverse
   deux instructions de premier niveau : chaque mutant est donc compté une fois, et une seule.
   Une instruction plus longue que la limite reste entière.
3. **Le domaine est réparti en parts comme le reste** : `PARTS.changed.domain` passe de 1 à 6,
   `PARTS.full.domain` de 1 à 8. Le poids d'un élément du domaine est son nombre de lignes mutées
   (fichier entier ou plage), et non plus ses seules lignes ajoutées. `split()` garde ses règles :
   une PR qui ne touche qu'un petit fichier du domaine garde un unique shard `domain`.
4. **Rien d'autre ne change** : seuils (85 % pour le domaine, 70 % pour le code nouveau), portée de
   la mesure (fichiers du domaine modifiés en entier en PR, tout le domaine en release), score
   calculé au job final sur le total des shards (`score.mjs` additionne déjà les compteurs, quel
   que soit le découpage), délais des jobs (60 minutes en PR, 120 hors PR).

Mise en œuvre : `scripts/mutation/plan.mjs` (une fonction pure de découpage, la lecture des
instructions avec le compilateur TypeScript regroupée avec les autres effets de bord), testé par
`npm run test:scripts`, dont un test qui compare, avec `@stryker-mutator/instrumenter`, les
mutants d'un fichier entier à la réunion des mutants de ses plages. `docs/workflow.md` dit que le
domaine est lui aussi réparti en parts.

Estimation pour `Battle.ts` : 6 plages d'environ 250 lignes, soit environ 30 minutes de mutation
chacune, plus le coût fixe d'un shard du domaine (installation et « dry run » des seuls tests
unitaires), sous le délai de 60 minutes. Les valeurs de `PARTS.*.domain` et de
`CHUNK_LINES.domain` sont à recalibrer d'après les durées mesurées en CI : sur la PR du correctif
par un lancement manuel du workflow (mode `full`), puis sur la PR #126.

### Alternatives rejetées

- **Relever `timeout-minutes` du shard `domain`** : il faudrait plus de 3 h par PR, et la durée
  grandit avec `Battle.ts`. Déjà rejeté dans la décision initiale (« Allonger seulement le
  délai »).
- **Ne muter que les lignes changées du domaine en PR** : la mesure change. `docs/workflow.md`
  dit que le score du domaine porte sur les fichiers du domaine modifiés : un mutant survivant
  dans une fonction inchangée d'un fichier modifié ne serait plus vu avant la release. C'est une
  règle validée par le propriétaire ; elle ne change pas pour un problème de durée.
- **Couper à un nombre fixe de lignes (`Battle.ts:1-500`, …)** : une coupe dans une fonction
  perd des mutants sans erreur (décision 2 ci-dessus).
- **Baisser `timeoutMS`** : des mutants lents mais survivants deviendraient des timeouts, comptés
  comme détectés : le score monterait artificiellement.
- **`--incremental` avec un cache** : reste une piste pour plus tard ; il ne résout pas une PR qui
  modifie beaucoup un gros fichier.

### Conséquences

- La règle « une part ne coupe jamais un fichier » (décision 3) ne vaut plus que hors domaine. Un
  fichier coupé n'est toujours muté qu'une fois : chaque mutant est dans une seule plage.
- Une PR qui modifie `Battle.ts` lance jusqu'à 9 shards de mutation (`domain-1` à `domain-6`,
  `core-1` à `core-3`), 11 avec les écrans demandés ; une release jusqu'à 14 (24 avec les écrans
  demandés, au-delà des 20 jobs simultanés de GitHub : un peu d'attente). Le « dry run » des tests
  unitaires est payé une fois par shard : plus de minutes de CI, gratuites pour un dépôt public.
- Un fichier coupé apparaît dans plusieurs rapports de shard ; le résumé de la CI liste ses
  mutants non tués shard par shard.
- Une seule instruction de premier niveau très longue (plus de 60 minutes de mutation à elle seule)
  resterait un shard trop long. Si cela arrive, on recoupe aux frontières des membres de cette
  instruction, par un nouvel avenant.
- Mesures à prendre sur la PR du correctif et sur #126 ; si un shard `domain-*` approche encore son
  délai, on recalibre `CHUNK_LINES.domain` et `PARTS.*.domain`, qui sont des réglages et non des
  seuils.

## Avenant du 29 octobre 2026 — le `core` de la release pesé en mutants, coupé jusqu'entre les membres d'une classe

- **Décideur** : Architect
- **Contexte produit** : issue #134 ; constat sur le run [40804197216](https://github.com/BPotet/ascent/actions/runs/40804197216) (mode `full`, `develop` en `0b9bca3c`)

### Contexte

En release, le shard `core-1` a été annulé à son délai de 120 minutes (120 min 26 s, à 268 mutants
sur 276), et le job de score final était rouge : toute release l'aurait été. Les autres shards
`core-*` finissaient entre 49 et 105 minutes de mutation. Les shards `domain-*` tenaient (35
minutes au plus).

| Shard | Lignes (poids) | Mutants | Timeouts | Mutation | Par mutant |
|---|---|---|---|---|---|
| `core-1` | 589 | 276 | ≥ 17 | annulé à 120 min 26 s | ~26 s |
| `core-2` | 589 | 234 | 14 | 105 min | ~27 s |
| `core-3` | 589 | 157 | 24 | 102 min | ~39 s |
| `core-4` | 583 | 247 | 25 | 103 min | ~25 s |
| `core-5` | 588 | 164 | 9 | 51 min | ~19 s |
| `core-6` | 587 | 175 | 10 | 49 min | ~17 s |

Trois causes :

1. **Le calibrage reposait sur environ 10 s par mutant** (révision du 22 octobre 2026). Mesuré : 17
   à 39 s. La config `core` exécute les trois projets Jest, écrans compris, et chaque timeout coûte
   un redémarrage du processus de test. Le « dry run » coûte 2 à 3 min 30 par shard (3 714 tests).
2. **Le poids ne mesurait pas le coût** : `split()` équilibrait les lignes (583 à 589 par part),
   mais les parts allaient de 157 à 276 mutants. `battleFeedback.ts` a plus de mutants (103) que de
   lignes (83).
3. **Un fichier presque indivisible** : `BattleSession.ts` (213 mutants) est en quasi-totalité une
   seule instruction de premier niveau, la classe `BattleSession`. Même le découpage de l'avenant
   précédent ne la coupait pas : seule, elle demandait 90 à 140 minutes. Augmenter le nombre de
   parts ne suffisait donc pas. `AscentSession.ts` (163 mutants, une classe) est le suivant.

### Décision

1. **En release, le poids d'un élément `core` est son nombre de mutants**, et non plus son nombre
   de lignes. Les mutants sont comptés au moment du plan avec `@stryker-mutator/instrumenter`
   (même version que Stryker, même mutateur que `stryker.config.mjs`) : le compte est exact. Les
   règles de `split()` ne changent pas. En PR, le poids d'un élément `core` reste son nombre de
   lignes nouvelles.
2. **En release, un fichier `core` de plus de `CHUNK_MUTANTS.core` mutants (100 au départ) est
   coupé en plages de lignes**, réparties entre les parts, comme un gros fichier du domaine
   (avenant précédent). Le fichier reste muté **en entier**, sur plusieurs shards. La règle « une
   part ne coupe jamais un fichier » (décision 3) ne vaut plus qu'en PR pour le `core`, où seules
   les lignes nouvelles sont mutées.
3. **Une classe plus grande que la limite est coupée entre deux de ses membres** (propriétés,
   constructeur, accesseurs, méthodes), et non plus seulement entre deux instructions de premier
   niveau : c'est le recoupage que l'avenant précédent prévoyait. L'en-tête de la classe va au
   premier membre, son accolade fermante au dernier. Aucun mutant de Stryker ne traverse deux
   membres d'une classe : chaque mutant reste compté une fois, et une seule. Une classe plus petite
   que la limite reste entière. La règle vaut aussi pour le domaine, mesuré en lignes, mais aucune
   classe du domaine ne dépasse aujourd'hui `CHUNK_LINES.domain` : son plan ne change pas.
4. **`PARTS.full.core` passe de 6 à 10** : environ 125 mutants par part, soit environ 55 minutes au
   rythme moyen mesuré et 80 au pire rythme mesuré (39 s par mutant), plus le coût fixe.
   `PARTS.changed.core` reste à 3.
5. **Rien d'autre ne change** : seuils (85 % pour le domaine, 70 % pour le code nouveau), `timeoutMS`
   (10 000), délais des jobs (60 minutes en PR, 120 hors PR), portée de la mesure (tout le `core`
   en entier en release), score calculé au job final sur le total des shards.

Mise en œuvre : `scripts/mutation/plan.mjs` (`outline()` lit aussi les membres d'une classe,
`chunkAtStatements()` reçoit la mesure d'une plage, `mutantLines()` compte les mutants, regroupé
avec les autres effets de bord dans `collectChanges()`), testé par `npm run test:scripts`, dont le
test qui compare, avec l'instrumenter, les mutants d'un fichier entier à la réunion des mutants de
ses plages, sur un échantillon où une classe est coupée entre ses membres. Vérifié aussi à la main
sur `BattleSession.ts`, `AscentSession.ts` et `battleFeedback.ts` : mêmes mutants, coupés ou non.

Plan du mode `full` sur `develop` (`0b9bca3c`) : 10 shards `core` de 125 à 126 mutants (1 253 au
total) ; `BattleSession.ts` en 3 plages (97, 100 et 16 mutants), `AscentSession.ts` en 2 (93 et
70), `battleFeedback.ts` en 2 (21 et 82) ; aucun élément au-dessus de 100 mutants. Les 8 shards
`domain` sont identiques à ceux d'avant.

### Alternatives rejetées

- **Augmenter seulement `PARTS.full.core`** : `BattleSession.ts`, indivisible, restait un shard de
  90 à 140 minutes.
- **Relever `timeout-minutes` des shards hors PR, ou baisser `timeoutMS`** : rejeté par la décision
  initiale et par l'avenant précédent ; baisser `timeoutMS` ferait monter le score artificiellement.
- **Ajouter un `CHUNK_LINES.core`** : la densité de mutants varie d'un fichier à l'autre (0,7 à 1,2
  mutant par ligne) ; une limite en mutants borne directement la durée d'un élément.
- **Couper à l'intérieur d'une méthode** : perd des mutants sans erreur (avenant précédent,
  décision 2).
- **Retirer les écrans des projets Jest de la config `core`** : moins de tests, donc un score qui
  peut changer ; hors du périmètre d'un correctif de répartition.

### Conséquences

- Une release lance jusqu'à 18 shards de mutation (`domain-1` à `domain-8`, `core-1` à `core-10`),
  sous la limite de 20 jobs simultanés de GitHub, avec un peu d'attente possible pendant les autres
  jobs ; 28 avec les écrans demandés. Le coût fixe est payé 10 fois pour `core` : plus de minutes
  de CI, gratuites pour un dépôt public.
- Le plan instrumente les fichiers `core` en mode `full` (environ 2 secondes), dans le job
  `mutation-plan` et dans chaque shard, qui recalcule le plan : même version, même résultat.
- Un fichier `core` coupé apparaît dans plusieurs rapports de shard, comme un fichier du domaine.
- Une méthode de plus de `CHUNK_MUTANTS.core` mutants resterait un élément entier. `PARTS.full.core`
  et `CHUNK_MUTANTS.core` restent des réglages à recalibrer d'après les durées mesurées en CI, pas
  des seuils.
- Mesures du run de vérification (mode `full`, sur la PR du correctif) : à reporter ici et sur
  l'issue #134.

## Avenant du 29 octobre 2026 — délai du « dry run », écrans pesés en mutants et répartis plage par plage

- **Décideur** : Architect
- **Contexte produit** : issue #145 ; constat sur la PR #144 (story #139), run [40922772417](https://github.com/BPotet/ascent/actions/runs/40922772417)

### Contexte

Sur la PR #144, avec le label `mutation:ui`, les deux shards `ui-1` et `ui-2` échouent avant le
premier mutant : `Initial test run timed out!` après 5 minutes, le délai par défaut de Stryker
(`dryRunTimeoutMinutes`), qu'aucune config ne fixait. Le check exigé `Mutation tests (StrykerJS)`
est rouge sans mesure. Le même échec touche toutes les têtes de la PR et le workflow
`Screen mutation`.

Trois constats :

1. **Le « dry run » des écrans dépasse 5 minutes.** Il passe toute la suite Jest (les trois
   projets) dans un seul processus, avec la couverture par test. Pour `core`, environ 3 minutes
   (run 40816846129, `core-2` : Stryker complet en 3 min 17 s, sans mutant). Pour les écrans, le
   code instrumenté (`BattleCanvas.tsx`, `enemyPose.ts`, l'atlas) tourne à chaque image des combats
   rendus par les tests d'intégration et BDD : le total dépasse 5 minutes.
2. **Les « 2 102 mutants » de `ui-1` ne sont pas un écran muté en entier.** `BattleCanvas.tsx` n'est
   muté que sur ses lignes nouvelles (22 plages). Les 2 102 mutants (1 956 pour `ui-2`) viennent
   surtout de deux fichiers ajoutés, `atelier/data/ossuaryWarden.ts` (2 156 lignes) et
   `atelier/data/twins.ts` (1 937 lignes) : un fichier ajouté est muté en entier (décision 1), mais
   ces données recopiées de l'Atelier commencent par `// Stryker disable all` (exclusion par
   commentaire de l'ADR 0001, appliquée au dessin par l'ADR 0006 ; voir ADR 0010 § 8). Tous leurs
   mutants sont `Ignored` : ni placés dans le code (`@stryker-mutator/instrumenter` 10.0.0), ni
   exécutés, ni comptés dans le score.
3. **La répartition des écrans est mal pesée.** Le découpage en plages des avenants #131 et #134 ne
   vaut pas pour `ui`. En PR, un fichier d'écran est un seul élément, pesé en lignes ajoutées. Les
   deux fichiers de données (environ 2 000 lignes, aucun mutant exécuté) prennent chacun un shard,
   et `ui-2` reçoit les 47 mutants exécutables de quatre fichiers. Or un mutant d'écran coûte
   environ 3 minutes (mesure locale du dev : 32 mutants en un peu moins de 2 h). Il est couvert par
   de nombreux tests de rendu, et chaque timeout redémarre un processus Jest. `ui-2` demanderait
   environ 2 h 20, pour un délai de 60 minutes : relever seulement le délai du « dry run » ne
   suffit pas.

### Décision

1. **`dryRunTimeoutMinutes` passe de 5 (défaut de Stryker) à 20**, dans `stryker.config.mjs`. Le
   réglage vaut pour les trois groupes. C'est un garde-fou contre un « dry run » bloqué, pas un
   seuil. 20 minutes, c'est environ 6 fois le « dry run » mesuré pour `core`, et au moins
   35 minutes restent pour les mutants dans un job de 60 minutes.
2. **Les données recopiées de l'Atelier (`src/adapters/ui/pixelArt/sprites/atelier/data/`) sortent
   de la liste `mutate` de `stryker.ui.config.mjs`.** Le score ne change pas : tous leurs mutants
   sont déjà ignorés. Un test vérifie que chaque fichier de ce dossier commence par
   `// Stryker disable all`. Sinon, l'exclusion cacherait des mutants exécutables, et le test
   échoue.
3. **Les écrans sont pesés en mutants exécutables**, comptés au moment du plan avec
   l'instrumenter, comme le `core` de la release (avenant #134). Les mutants ignorés ne comptent
   plus dans aucun poids : ils ne coûtent rien.
4. **En PR, chaque plage de lignes nouvelles d'un écran est un élément à part.** Les plages d'un
   même fichier peuvent aller dans des parts différentes. Aucun mutant n'est perdu ni compté deux
   fois : Stryker ne garde un mutant que s'il tient entièrement dans **une** plage, et les plages du
   diff sont disjointes. La règle « une part ne coupe jamais un fichier » (décision 3) ne vaut donc
   plus que pour le `core` en PR. Un fichier d'écran ajouté, muté en entier, est coupé comme un
   fichier `core` en release, au-delà de `CHUNK_MUTANTS.ui` mutants (10 au départ).
5. **`PARTS.changed.ui` passe de 2 à 8** : environ 11 mutants par part pour une PR comme #144, soit
   environ 35 minutes, plus un « dry run » de 10 minutes au plus. `split()` garde ses règles : une
   petite PR d'écrans garde un seul shard `ui`.
6. **Rien d'autre ne change** : les seuils (85 % pour le domaine, 70 % pour le code nouveau, écrans
   compris quand ils sont mutés), `timeoutMS` (10 000), les délais des jobs (60 minutes en PR, 120
   hors PR), les tests exécutés (les trois projets Jest, sans `findRelatedTests`) et la portée de
   la mesure (lignes nouvelles des écrans en PR).

Mise en œuvre : `stryker.config.mjs`, `stryker.ui.config.mjs` et `scripts/mutation/plan.mjs`
(`mutantLines()` ignore les mutants désactivés ; les écrans sont comptés dans `collectChanges()`),
testés par `npm run test:scripts`.

### Alternatives rejetées

- **Relever seulement `dryRunTimeoutMinutes`** : `ui-2` resterait d'environ 2 h 20 pour un délai de
  60 minutes.
- **Ne lancer que les tests liés** (`findRelatedTests`, ou un seul projet Jest pour les écrans) :
  `findRelatedTests` ignore les routes chargées dynamiquement par expo-router. Moins de tests, c'est
  moins de mutants tués, donc un score qui peut changer. Déjà rejeté dans la décision initiale
  (« Réduire les tests du shard `ui` »).
- **Relever `timeout-minutes` des shards, ou baisser `timeoutMS`** : rejetés par la décision
  initiale et les avenants précédents ; baisser `timeoutMS` ferait monter le score artificiellement.
- **Retirer le `// Stryker disable all` des données** : des milliers de mutants sur des pixels,
  sans test qui puisse les tuer de façon utile.

### Conséquences

- Une PR avec `mutation:ui` lance jusqu'à 8 shards d'écrans, et jusqu'à 17 shards de mutation si
  elle touche aussi `Battle.ts` (`domain-1` à `domain-6`, `core-1` à `core-3`), sous la limite de
  20 jobs simultanés de GitHub. Le « dry run » est payé une fois par shard : plus de minutes de CI,
  gratuites pour un dépôt public.
- Un écran dont les plages sont réparties apparaît dans plusieurs rapports de shard, comme un
  fichier coupé du domaine ou du `core`.
- Le plan instrumente les écrans modifiés en PR (quelques secondes), dans `mutation-plan` et dans
  chaque shard, qui recalcule le plan : même version, même résultat.
- `dryRunTimeoutMinutes`, `PARTS.changed.ui` et `CHUNK_MUTANTS.ui` sont des réglages à recalibrer
  d'après les durées mesurées en CI, pas des seuils.
- **Risque connu, hors périmètre** : la mutation de tous les écrans (lancement manuel avec
  `ui-mutation`, `npm run mutation:ui -- --full`) ne tiendra pas en 10 parts de 120 minutes à
  environ 3 minutes par mutant. Elle n'est lancée qu'à la demande et n'est exigée nulle part. Elle
  aura son propre avenant si le propriétaire la demande.
- Mesures du run de vérification (PR #144 mise à jour après le correctif : durée du « dry run »,
  durée de chaque shard `ui-*`) : à reporter ici et sur l'issue #145.

### Mesures du correctif (plan sur la tête `f63a08fb` de la PR #144)

- **Plan** (`MUTATION_UI=true BASE_REF=origin/develop node scripts/mutation/run.mjs --plan`) :
  8 shards `ui-1` à `ui-8`, aucun fichier `atelier/data/`. 102 mutants exécutables en tout
  (`enemyPose.ts` 55, `fullAnimation.ts` 21, `battleCharacters.ts` 20, `battleAtlas.ts` 6),
  répartis en 17, 14, 12, 12, 12, 12, 12 et 11. `BattleCanvas.tsx` n'apparaît plus : ses
  21 plages tombent toutes dans son bloc `// Stryker disable all`, sans mutant exécutable ; une
  plage sans mutant exécutable ne mute rien et n'entre pas dans le plan.
- **Contrôle avec Stryker** (« dry run » local sur toutes les plages d'origine, plan de Stryker
  relevé avant le premier mutant) : 191 mutants, dont 89 ignorés et 102 exécutés, comme le compte
  du plan. « Dry run » : 3 974 tests en 10 min 21 s (net 451 s).
- **Mutants statiques** : 37 des 102 (`fullAnimation.ts` 19, `battleCharacters.ts` 18), estimés
  par Stryker à 308 s chacun (toute la suite), contre 68 s en moyenne pour les autres. Ils ne se
  lisent pas dans le source : ces modules sont exécutés à la collecte de certains tests, et seule
  la couverture du « dry run » le révèle. Le plan ne peut donc pas les peser à part. Le poids en
  mutants traite chaque mutant comme s'il pouvait l'être : même si tous les mutants d'une part
  étaient statiques, une part de 17 mutants prendrait environ 48 minutes (5 tours de 4 processus à
  308 s × 1,4, plus 12 minutes de « dry run »). `ignoreStatic` reste désactivé : il changerait ce
  qui est mesuré.
- **Durées estimées** par part, avec le `netTime` de Stryker × 1,4 (facteur calé sur le run local
  du dev : 32 mutants en environ 48 minutes) sur 4 processus, plus 12 minutes de « dry run » :
  19, 41, 34, 17, 23, 28, 18 et 19 minutes. La plus longue (`ui-2`, une seule plage de
  `battleCharacters.ts`, 14 mutants statiques) reste sous 45 minutes.
- **Limites** : une plage d'un écran modifié n'est jamais coupée. Une part peut donc dépasser
  l'objectif d'environ 12 mutants (`ui-1` : une seule plage de `enemyPose.ts`, 17 mutants). Le pire
  cas, si tous les mutants d'une part étaient statiques, est d'environ 48 minutes : au-delà du
  seuil de recalibrage de 45 minutes, mais sous le délai de 60. La mesure en CI sur #144
  tranchera.

## Avenant du 29 octobre 2026 — délai par mutant propre aux écrans

- **Décideur** : Architect
- **Contexte produit** : issue #147 ; constat sur la PR #144 (run
  [40932624384](https://github.com/BPotet/ascent/actions/runs/40932624384), tête `96c28cac`) et
  rapport QA

### Contexte

Après le correctif de l'issue #145, la mutation des écrans de la PR #144 a tourné jusqu'au bout :
8 shards de 14 à 37 minutes, « dry run » de 5 à 8 minutes. Mais sur 92 mutants exécutés, **82
finissent en timeout** (10 tués, 0 survivant) : le score affiché est de 100 %. Les shards affichent
souvent « Ran 0.00 tests per mutant ». Le QA a montré que deux de ces « timeouts » sont de vrais
survivants (`enemyPose.ts:175`).

Stryker donne à chaque mutant le délai `timeoutFactor × net + timeoutMS + overhead` : 1,5 fois le
temps des tests couvrants, plus `timeoutMS` (10 s), plus le surcoût mesuré une fois, pendant le
« dry run ». Un run coupé par ce délai est un `Timeout`, compté comme détecté, et ne rapporte aucun
test. Mesures en local sur la même tête (4 cœurs, 16 Go, comme un runner GitHub) :

| Mesure | Délai de Stryker | Run réel | Résultat |
|---|---|---|---|
| `enemyPose.ts:175`, 3 mutants, réglages actuels | 289 s | coupé | 3 timeouts, score 100 % |
| Même ligne, `timeoutMS` à 1 h | 3 889 s | 394 s | **3 survivants**, 48 tests par mutant, score 0 % |
| `enemyPose.ts:170-180`, un seul processus, `timeoutMS` à 1 h | 3 873 s | 387 s, puis 245 et 254 s | premier run froid, suivants chauds |
| `battleCharacters.ts:211-252`, 14 mutants statiques, réglages actuels | 696 s | 4 min 30 à 9 min 30 | 6 tués, 7 erreurs, 1 timeout par limite de passages |
| Jest sans Stryker, 256 fichiers, aucun test exécuté | — | 174 s | coût fixe d'un run |
| Jest sans Stryker, les 5 fichiers des tests couvrants de la ligne 175 | — | 7 s | — |

Trois constats :

1. **Un run de mutant d'écran coûte presque autant que le délai, même dans le meilleur cas.** Sans
   `findRelatedTests` (décision initiale, à cause des routes d'expo-router), Jest prépare à chaque
   mutant les 256 fichiers de test des trois projets, puis n'exécute que les tests couvrants.
   Ce coût fixe (174 s) est à peu près le surcoût du « dry run » (180 s). Un run dans un processus
   chaud tient donc juste : 245 à 254 s pour un délai de 273 s.
2. **Le premier run d'un processus neuf est bien plus lent** (387 s) : les tests couvrants des
   écrans sont de lourds rendus de combat, et ils tournent dans un processus froid. Les processus de
   mutation démarrent tous froids.
3. **Chaque timeout redémarre le processus** : le mutant suivant tombe sur un processus froid,
   dépasse à son tour, et ainsi de suite. En CI, presque tous les mutants d'écran finissent en
   timeout, par vagues régulières de 4 (150 à 170 s pour `ui-4`, environ 470 s pour les mutants
   statiques de `ui-2`, soit les délais calculés).

Le domaine (projet `unit` seul, sans React Native) et le `core` (tests couvrants légers, 17 à 39 s
par mutant mesurés dans l'avenant #134) ne montrent pas cette cascade.

### Décision

1. **Les écrans ont leur propre délai par mutant : `timeoutMS` passe de 10 000 à 600 000 (10
   minutes) dans `stryker.ui.config.mjs`.** `stryker.config.mjs` et `stryker.domain.config.mjs`
   gardent 10 000. Délais attendus en CI : environ 13 minutes pour un mutant d'écran ordinaire,
   environ 18 pour un mutant statique, au moins deux fois le run réel estimé, premier run froid
   compris. Une fois ce premier run fini, le processus reste chaud : la cascade ne démarre plus.
2. **La règle de Stryker ne change pas : un timeout compte comme détecté.** C'est le comportement
   standard, et une vraie boucle infinie doit rester détectée. Ce qui change, c'est qu'un run normal
   n'est plus coupé. Les boucles infinies sont le plus souvent arrêtées avant le délai par la
   limite de passages de Stryker (100 fois les passages du « dry run »), dont le `statusReason`
   (« Hit limit reached ») les distingue.
3. **Le résumé de la mutation distingue les deux sortes de timeout** (`scripts/mutation/score.mjs`) :
   par **délai** (sans `statusReason`) et par **limite de passages**. Il avertit, sans bloquer, si
   les timeouts par délai dépassent 10 % des mutants exécutés d'une classe : c'est le signe qu'un
   délai est à recalibrer. Le score ne change pas.
4. **Rien d'autre ne change** : les seuils (85 % pour le domaine, 70 % pour le code nouveau,
   écrans compris quand ils sont mutés), les tests exécutés (les trois projets Jest, sans
   `findRelatedTests`), la portée de la mesure, les délais des jobs (60 minutes en PR, 120 hors PR)
   et `dryRunTimeoutMinutes` (20).

Mise en œuvre : `stryker.ui.config.mjs` et `scripts/mutation/score.mjs`, testés par
`npm run test:scripts` (`config.test.mjs` : le délai de chaque config ; `score.test.mjs` : le
partage des timeouts et l'avertissement).

### Alternatives rejetées

- **Compter un timeout comme non détecté, ou l'exclure du score** : contraire au comportement
  standard de Stryker. Une vraie boucle infinie passerait pour un survivant.
- **Relever `timeoutMS` pour tout le code** : le domaine et le `core` n'ont pas ce défaut. Leurs
  timeouts sont surtout des boucles infinies (`Battle.ts`), qui coûteraient chacune 10 minutes au
  lieu de 10 secondes.
- **Relever seulement `timeoutFactor`** : il ne multiplie que le temps des tests couvrants, pas le
  coût fixe ni le surcoût d'un processus froid. Il faudrait un facteur démesuré pour les mutants
  statiques.
- **Baisser `concurrency`** : en local, 3 runs froids en parallèle durent 394 s, un run seul 387 s.
  La concurrence n'est pas la cause, et les shards seraient plus longs.
- **Ne charger que les fichiers de test liés au mutant** (`findRelatedTests`, avec un
  `dependencyExtractor` Jest qui rattacherait aux routes les 13 fichiers de test qui les chargent
  dynamiquement) : un run passerait d'environ 233 s à environ 66 s. Mais les tests exécutés
  changent, et il faudrait prouver que chaque test couvrant reste chargé. C'est une optimisation
  possible, dans sa propre issue, pas un correctif.
- **`ignoreStatic`** : il ignore des mutants, ce qui fausse la mesure (déjà rejeté).

### Conséquences

- Le score des écrans redevient probant : un mutant survivant y apparaît comme survivant. Une PR
  dont les écrans ont trop de survivants voit le check de mutation passer au rouge.
- Un run de mutant d'écran va jusqu'au bout : le premier run de chaque processus est plus long
  qu'un timeout d'aujourd'hui, les suivants à peu près aussi longs. Si un shard `ui-*` dépasse
  45 minutes, on recalibre `PARTS.changed.ui`, ou on coupe une plage de lignes nouvelles d'écran de
  plus de `CHUNK_MUTANTS.ui` mutants entre deux instructions de premier niveau ou deux membres d'une
  classe, comme un fichier d'écran ajouté (avenant #145). Ce sont des réglages, pas des seuils, et
  le recalibrage se trace ici.
- Une boucle infinie lente, non arrêtée par la limite de passages, coûte jusqu'au délai complet
  (10 minutes et plus) à un processus.
- `timeoutMS` des écrans est un réglage à recalibrer d'après les mesures en CI, comme `PARTS`.
- Le `core` paie le même coût fixe par mutant. Au prochain run `full`, si le résumé montre plus de
  10 % de timeouts par délai dans le `core`, une issue suivra.

### Mesures du correctif

**Mesure locale, pas la barrière de CI** (30 octobre 2026, branche du correctif, PR #148) : plan
`changed` de #144 déjà dans `develop` (base `733458d0`, tête `6f03c09d`), 102 mutants, mutés en
deux plages avec `stryker.ui.config.mjs` corrigé (`timeoutMS` 600 000), 4 cœurs, 16 Go,
`concurrency` 4 (4 processus).

| Plage | Mutants | « Dry run » | Durée | Tués | Timeouts par délai | Timeouts par limite de passages | Survivants | Erreurs | Tests par mutant |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|
| `enemyPose.ts` | 55 | 10 min 47 (overhead 179 s) | 67 min 38 | 48 | 0 | 0 | 7 | 0 | 65,25 |
| `battleCharacters.ts`, `fullAnimation.ts`, `battleAtlas.ts` | 47 | 9 min 58 (overhead 165 s) | 89 min 29 | 29 | 0 | 1 | 2 | 15 | 1 788,83 |

- Sur les 102 mutants : **0 timeout par délai**, 1 timeout par limite de passages
  (`battleCharacters.ts:251`, `Hit limit reached (5674/5600)`), contre 82 timeouts sur 92 en CI
  avant le correctif.
- Score réel des écrans de #144 : **89,66 %** (78 détectés sur 87 valides), au-dessus de 70 %.
- **9 survivants**, listés dans l'issue #149 (tests à ajouter). Sur cette tête, les mutants de
  `enemyPose.ts:175` sont tués par les tests ajoutés par le QA.
- **15 erreurs d'exécution**, toutes dans la seconde plage : elles sortent du score, comme le veut
  Stryker.

**Mesure CI : à faire** (issue #147, « Vérification », points 2 et 3). Sur une PR de
vérification qui reprend la tête `96c28cac` de #144, avant les tests ajoutés par le QA, les
mutants de `enemyPose.ts:175` doivent apparaître `Survived`. Pour chaque shard `ui-*` : durée, et
partage entre tués, timeouts par délai, timeouts par limite de passages, survivants et erreurs ;
« Ran N tests per mutant ».
