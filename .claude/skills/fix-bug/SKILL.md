---
name: fix-bug
description: Corrige un bug d'Ascent de bout en bout — reproduction par un test, correction de la cause racine, barrières de qualité, review, merge (bugfix dans develop, hotfix dans main). À utiliser sur une issue type:bug, quand le propriétaire signale un bug ou quand une barrière est rouge sur develop.
---

# /fix-bug <n° issue>

1. **Issue** : si le bug n'a pas encore d'issue, crée-la avec le template « Bug » (`type:bug`). Si le propriétaire l'a signalé, reformule-le en étapes pour reproduire, attendu, observé ; ne lui pose une question que si le bon comportement est vraiment inconnu.
2. **Branche** : un bug en production (`priority:hotfix`) part de `main` en `hotfix/<x.y.z>-<slug>` (PATCH du dernier tag) ; sinon de `develop` en `bugfix/<n°>-<slug>`.
3. **Fix** : passe en `status:in-progress` et lance l'agent **fixer**.
   - S'il escalade parce que la correction change ce que le propriétaire a validé : lance **pm** et **architect**, passe en `status:awaiting-approval`, préviens le propriétaire et arrête-toi.
   - S'il escalade pour une migration ou un port partagé : lance **impact-analyst**, puis **architect** pour les notes techniques, et relance **fixer**.
   - Le fixer rend son rapport dès que la PR est ouverte et ses barrières vertes en local, sans attendre la CI GitHub. **Surveille la CI** de la PR : si elle échoue, renvoie au **fixer** le check en échec et son log ; après sa correction, relance **qa** et **reviewer** selon la règle de l'étape 4. Si la CI échoue alors que **qa** et **reviewer** tournent déjà, attends leurs verdicts et renvoie tous les retours ensemble (check en échec, log et rapports) au **fixer** : ce renvoi compte comme un tour.
4. **Test et Review, en parallèle** : quand la PR est ouverte et ses barrières vertes en local, passe en `status:review` et lance **en même temps** l'agent **qa** et l'agent **reviewer** (`/review-story`), comme à l'étape 4 de `/dev-story` : mêmes verdicts en lecture seule avec le SHA relu, même règle de relance après correction (les deux, ou seulement celui qui l'a demandée si elle est locale), mêmes tours. En cas de changements demandés, attends les deux verdicts, repasse en `status:in-progress` et renvoie les deux rapports ensemble au **fixer** (au plus 3 tours, puis `status:blocked` et résumé au propriétaire).
5. **Merge** :
   - `bugfix/` : quand, sur la tête courante de la PR, le verdict du QA est vert, la review approuvée et la CI verte, active l'auto-merge (squash) dans `develop`. Elle ferme l'issue.
   - **Mutation des écrans** : comme dans `/dev-story`, pose le label `mutation:ui` **seulement si le propriétaire le demande** (voir « Mutation des écrans à la demande » dans `docs/workflow.md`). Quand il est posé, attends que le check `Screen mutation tests (StrykerJS)` soit vert avant d'activer l'auto-merge (désactive-le s'il était déjà actif) : ce check n'est pas exigé par la protection de branche. S'il est rouge, renvoie au **fixer**, puis relance **qa** et **reviewer** selon la règle de l'étape 4.
   - `hotfix/` : avec les mêmes verdicts verts sur la tête courante et la CI verte, termine avec la démarche hotfix de `/release` (merge dans `main`, tag, réintégration dans `develop`).
6. Annonce au propriétaire, en une phrase produit, ce qui est réparé.
