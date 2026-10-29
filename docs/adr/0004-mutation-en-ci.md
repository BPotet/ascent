# ADR 0004 — Mutation en CI : lignes nouvelles, jobs parallèles

- **Statut** : accepté
- **Date** : 22 octobre 2026
- **Décideur** : Architect
- **Contexte produit** : PR #29 (story #23)
- **Avenant** : 22 octobre 2026, mutation des écrans à la demande (issue #54, voir en fin de document)
- **Révisé** : 22 octobre 2026, le groupe `core` est réparti en parts parallèles (voir en fin de document)
- **Avenant** : 29 octobre 2026, le domaine est réparti en parts, un gros fichier coupé en plages de lignes (issue #131, voir en fin de document)

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
