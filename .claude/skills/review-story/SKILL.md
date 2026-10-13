---
name: review-story
description: Étape 7 du workflow Ascent. Lance une revue complète d'une PR de story (critères d'acceptation, architecture, glossaire, rapports de tests) avant l'auto-merge. À utiliser sur une PR ouverte, seule ou depuis /dev-story.
---

# /review-story <n° PR>

1. Récupère la PR, l'issue liée (`Closes #n`), le rapport QA et l'état de la CI.
2. Lance l'agent **reviewer**.
3. Publie son verdict en review sur la PR :
   - **Approuvé** : signale que la PR est prête pour l'auto-merge.
   - **Changements demandés** : commentaires précis, et le compteur de tours sur l'issue.
