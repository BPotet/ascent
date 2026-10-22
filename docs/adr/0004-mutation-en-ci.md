# ADR 0004 — Mutation en CI : lignes nouvelles, jobs parallèles

- **Statut** : accepté, révisé le 22 octobre 2026 (écrans à la demande, voir « Révisé »)
- **Date** : 22 octobre 2026
- **Décideur** : Architect
- **Contexte produit** : PR #29 (story #23)

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
   ou à la demande, tout le code en 13 parts. *(Révisé : les écrans ne sont mutés qu'à la demande
   du propriétaire, et les routes passent dans `core`. Voir « Révisé » ci-dessous.)*
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
mute tout le code de la même façon (mode `full`), et `npm run mutation:domain` tout le domaine.
*(Révisé : sans les écrans, sauf demande du propriétaire.)*

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

## Révisé — 22 octobre 2026 : la mutation des écrans à la demande

**Décideur** : le propriétaire. « Les tests de mutation pour les écrans sont à lancer uniquement
quand moi je le décide. »

**Contexte.** La mutation des écrans (`src/adapters/ui`, shards `ui-*`) prenait des heures en local
et la plus grosse part de la CI, pour des composants dont l'apparence est déjà contrôlée par la
conformité aux maquettes et le comportement par les tests d'intégration.

**Décision.**

1. **Par défaut, les écrans (`src/adapters/ui`) ne sont pas mutés** : ni shard `ui`, ni lignes
   d'écran comptées dans le seuil du code nouveau. C'est le cas en local (`npm run mutation:changed`,
   `npm run mutation`, `npm run verify:full`) et en CI, sur une PR comme sur une branche de release
   ou de hotfix. Les routes et l'assemblage (`src/app/`) passent dans le groupe `core` et restent
   mutés ; le domaine et le reste du code hors domaine ne changent pas.
2. **Le propriétaire déclenche la mutation des écrans quand il le décide** :
   - sur une PR, en posant le label **`mutation:ui`** (depuis l'interface GitHub, téléphone
     compris) : la CI est relancée et mute aussi les lignes nouvelles des écrans. Tant que le label
     reste, chaque nouveau push les mute ; le retirer relance la CI sans elles ;
   - par un lancement manuel du workflow **CI** (onglet Actions, « Run workflow »), en cochant
     **« Muter aussi les écrans »** : tout le code de la branche choisie, écrans compris ;
   - en local, sur sa demande seulement : `npm run mutation:ui` (code nouveau, écrans compris) ou
     `npm run mutation -- --ui` (tout le code). Le drapeau est `--ui`, ou `MUTATION_UI=true`.
3. **Aucun agent ne lance la mutation des écrans sans demande du propriétaire**, et son absence
   n'est pas une barrière rouge.
4. **Aucun seuil ne change.** Quand les écrans sont mutés, leurs mutants comptent dans le code
   nouveau hors domaine, au seuil de 70 %, sur le total des shards comme avant.

**Mise en œuvre.** `buildPlan({ includeUi })` et `screenFiles()` (`scripts/mutation/plan.mjs`),
`parseOptions()` (`scripts/mutation/run.mjs`), testés par `npm run test:scripts`. Le plan annonce
les fichiers d'écran laissés de côté ; le résumé du job `mutation` le rappelle. Dans
`.github/workflows/ci.yml`, `MUTATION_UI` vaut `true` si la PR porte le label `mutation:ui` ou si
la case du lancement manuel est cochée.

**Conséquences.**

- La CI se déclenche aussi sur `labeled` et `unlabeled` : **poser ou retirer n'importe quel label
  sur une PR relance toute la CI**. Un run partiel (seulement la mutation) aurait laissé, sur le
  même commit, des checks « skipped », que GitHub compte comme réussis : une barrière rouge aurait
  pu passer au vert par un simple label. Le processus ne pose pas de label sur les PR, seulement
  sur les issues : le surcoût reste celui que le propriétaire décide.
- Un défaut de test dans un écran n'est plus détecté par la mutation tant que le propriétaire ne
  la demande pas ; les tests d'intégration, la couverture (SonarQube Cloud) et la conformité aux
  maquettes restent bloquants.
- `PARTS.changed.ui` et `PARTS.full.ui` restent les réglages des parts quand les écrans sont mutés.
- Le check `Mutation tests (StrykerJS)` garde son nom ; avec le label, il inclut les écrans.
