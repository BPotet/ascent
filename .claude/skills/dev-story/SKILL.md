---
name: dev-story
description: Étapes 3 à 8 du workflow Ascent, pour les deux chemins. Mène une story validée (status:ready) jusqu'à l'auto-merge dans develop — notes d'architecture, analyse d'impact GitNexus, implémentation TDD, barrières de qualité, review. À utiliser sur une story en status:ready.
---

# /dev-story <n° story>

Prérequis : la story est en `status:ready`. Sinon, arrête-toi et lance `/backlog`.

**Chemin de la story** (voir « Deux chemins pour une idée » dans les principes de `docs/workflow.md`) : une story du **chemin A** (fonctionnalité) vient de `/split-stories` ; une story du **chemin B** (game design) vient de l'Atelier de l'ascension, écrite par le PM à partir du contenu validé. Dis le chemin à l'**architect**, au **dev**, au **qa** et au **reviewer** dans leur consigne. Aucune story n'a de parcours ni de captures end-to-end propres : le test de fumée de la CI suffit. Sur le chemin B, les règles se vérifient en tests unitaires du domaine, avec l'Équilibrage de l'Atelier comme contrôle ; la consigne du dev cite les valeurs du Codex de la story, l'image et l'animation complète validées dans l'Atelier, et la maquette s'il y a une mécanique nouvelle.

1. **Ready** : lance l'agent **architect** pour ajouter les notes techniques à la story.
2. **Impact** : passe en `status:impact-analysis` et lance l'agent **impact-analyst**.
   - Impact fort : lance **pm** et **architect** pour décider. Si le périmètre validé change, repasse la story en `status:awaiting-approval`, préviens le propriétaire et arrête-toi. Sinon, reprends à l'étape 1.
3. **Implement** : passe en `status:in-progress` et lance l'agent **dev** avec une **consigne ciblée** : les écrans de la maquette annotés pour la story (et non toute la maquette) ou, sur le chemin B, le contenu validé dans l'Atelier, les décisions utiles (règles de jeu, notes techniques, analyse d'impact) et les fichiers concernés. Il lit ce qui est indiqué, et ne lit le reste que si c'est nécessaire.
   Il implémente toute la story en **TDD par couche** (un commit par couche, environ 4 à 6 commits), ouvre la PR en brouillon puis l'en sort quand les barrières sont vertes en local et le code poussé, et rend son rapport **sans attendre la CI GitHub**, ce qui ouvre l'étape 4.
   **Surveille la CI** de la PR : si elle échoue, renvoie au **dev** le check en échec et son log ; après sa correction, relance **qa** et **reviewer** selon la règle de l'étape 4. Si la CI échoue alors que **qa** et **reviewer** tournent déjà, attends leurs verdicts et renvoie tous les retours ensemble (check en échec, log et rapports) au **dev** : ce renvoi compte comme un tour.
   S'il signale un besoin hors du périmètre de la story, traite-le comme un changement de périmètre (escalade PM et Architect).
4. **Test et Review, en parallèle** : dès que la PR est sortie du brouillon, passe en `status:review` et lance **en même temps** l'agent **qa** et l'agent **reviewer** (`/review-story`), dans le même message. Les deux sont en lecture seule ; chacun rend son verdict sur la PR avec le SHA relu. Voir « 6 et 7. Test et Review, en parallèle » dans `docs/workflow.md`.
   - **Changements demandés** (par l'un ou par les deux) : attends les deux verdicts, repasse en `status:in-progress` et renvoie au **dev** les deux rapports ensemble.
   - **Après la correction**, relance les deux. Ne relance que celui qui a demandé la correction si elle est **locale** (tests seuls pour le QA ; `docs/`, glossaire compris, titre ou description de PR seuls pour le Reviewer ; aucun fichier de production de `src/`, pas même un commentaire) sur tout le diff entre le SHA relu par l'autre et la nouvelle tête, et que l'autre était vert sur la tête qu'il a relue : reconduis alors son verdict sur la nouvelle tête par un commentaire sur la PR. Si c'est le verdict du Reviewer qui est reconduit, demande au QA de vérifier aussi que les noms des tests ajoutés suivent le glossaire. En cas de doute, relance les deux.
   - **Tours** : une série QA et Reviewer suivie d'un renvoi au dev compte pour un tour. Tiens le compteur sur l'issue : au plus 3 tours, puis `status:blocked` et résumé au propriétaire.
5. **Merge** : quand, sur la **tête courante** de la PR, le verdict du QA est vert, la review approuvée (rendus sur ce commit ou reconduits) et la CI entièrement verte, active l'auto-merge (squash) de la PR ; si un commit est poussé ensuite, désactive-le jusqu'aux nouveaux verdicts. Son titre, au format Conventional Commits, devient le commit sur `develop`. Elle ferme l'issue.
6. Si c'était la dernière story de l'épique, lance `/release`.
7. Annonce au propriétaire, en une ou deux phrases produit, ce qui est maintenant disponible dans l'app. Ses retours après avoir joué s'orientent ainsi : jeu → Atelier de l'ascension ; app → nouvelle épique (`/define-feature`) ; panne → `/fix-bug`.
