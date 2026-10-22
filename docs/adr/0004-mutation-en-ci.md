# ADR 0004 — Mutation en CI : lignes nouvelles, jobs parallèles

- **Statut** : accepté
- **Date** : 22 octobre 2026
- **Décideur** : Architect
- **Contexte produit** : PR #29 (story #23)
- **Avenant** : 22 octobre 2026, mutation des écrans à la demande (issue #54, voir en fin de document)

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
     ensuite, chaque push de la PR est muté par `ci.yml` écrans compris, car le plan lit le label ;
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
  (`Screen mutation tests (StrykerJS)`), avec un score calculé sur les écrans seuls ; aux pushs
  suivants, elle est comptée dans le check habituel `Mutation tests (StrykerJS)`.
- Pour un autre label, les jobs du workflow `Screen mutation` portent un autre nom (« Label without
  mutation … ») : aucun check sauté ne masque un échec de la mutation des écrans sur le même commit.
- Cas limite accepté : une PR créée avec le label déjà posé mute ses écrans deux fois (`ci.yml` à
  l'ouverture, et `mutation-ui.yml`, car GitHub émet aussi un événement `labeled` à la création).
  Les deux résultats doivent être verts.
- Les agents `dev`, `qa` et `reviewer` n'exigent plus la mutation des écrans quand elle n'a pas été
  demandée.
