---
name: review-story
description: Étape 7 du workflow Ascent. Lance une revue complète d'une PR de story (critères d'acceptation, architecture, glossaire, rapports de tests) avant l'auto-merge. À utiliser sur une PR ouverte, seule ou depuis /dev-story.
---

# /review-story <n° PR>

Depuis `/dev-story` ou `/fix-bug`, cette revue tourne **en même temps** que l'agent **qa** : n'attends pas son rapport.

1. Récupère la PR, sa tête (SHA), l'issue liée (`Closes #n`) et l'état de la CI.
2. Lance l'agent **reviewer** (lecture seule : il ne pousse aucun commit). Si la PR ou la story porte le label `prototype`, dis-lui d'appliquer la revue allégée du mode prototype (voir « Mode prototype » dans `docs/workflow.md`).
3. Publie son verdict en review sur la PR, avec le SHA relu :
   - **Approuvé** : la PR est prête pour l'auto-merge dès que le verdict du QA est vert sur la même tête et la CI verte.
   - **Changements demandés** : commentaires précis. Lancée depuis `/dev-story` ou `/fix-bug`, l'orchestrateur tient le compteur de tours sur l'issue ; lancée seule, mets-le à jour.
