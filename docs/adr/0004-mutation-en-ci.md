# ADR 0004 — Mutation en CI : lignes nouvelles, jobs parallèles

- **Statut** : accepté
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
   ou à la demande, tout le code en 13 parts.
4. **Les seuils ne s'appliquent qu'au job final**, sur le total des shards, avec la formule de
   Stryker (`mutation-testing-metrics`) : 85 % pour le domaine, 70 % pour le code nouveau hors
   domaine. Les shards tournent sans seuil bloquant.
5. **Aucun seuil ne change.** Les listes `mutate` de `stryker.config.mjs` et
   `stryker.domain.config.mjs` restent la source de vérité de ce qui est muté.

Mise en œuvre : `scripts/mutation/` (`plan.mjs`, `run.mjs`, `score.mjs`, testés par
`npm run test:scripts`). Les chemins sont échappés (`src/app/(tabs)/…`, une future route `[id]`) et
chaque entrée est vérifiée contre la comparaison de Stryker au moment du plan : un motif qui ne
correspond à rien fait échouer le plan au lieu de fausser la mesure en silence. En local,
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
