---
name: dev-story
description: Étapes 3 à 8 du workflow Ascent. Mène une story validée (status:ready) jusqu'à l'auto-merge dans develop — notes d'architecture, analyse d'impact GitNexus, implémentation TDD, barrières de qualité, review. À utiliser sur une story en status:ready.
---

# /dev-story <n° story>

Prérequis : la story est en `status:ready`. Sinon, arrête-toi et lance `/backlog`.

1. **Ready** : lance l'agent **architect** pour ajouter les notes techniques à la story.
2. **Impact** : passe en `status:impact-analysis` et lance l'agent **impact-analyst**.
   - Impact fort : lance **pm** et **architect** pour décider. Si le périmètre validé change, repasse la story en `status:awaiting-approval`, préviens le propriétaire et arrête-toi. Sinon, reprends à l'étape 1.
3. **Implement** : passe en `status:in-progress` et lance l'agent **dev**. Il implémente toute la story, ouvre la PR en brouillon puis l'en sort quand les barrières sont vertes en local.
   S'il signale un besoin hors du périmètre de la story, traite-le comme un changement de périmètre (escalade PM et Architect).
4. **Test** : lance l'agent **qa**. S'il y a des barrières rouges, renvoie au **dev** avec le rapport, puis relance **qa**.
   La mutation des écrans n'en fait pas partie : elle n'est lancée que si le propriétaire la demande (label `mutation:ui` sur la PR, que seul lui pose ou fait poser). Ne pose aucun autre label sur la PR : tout label relance la CI.
5. **Review** : passe en `status:review` et lance l'agent **reviewer**.
   - Changements demandés : retour à l'étape 3 (au plus 3 tours, puis `status:blocked` et résumé au propriétaire).
6. **Merge** : quand la CI est entièrement verte et la review approuvée, active l'auto-merge (squash) de la PR. Son titre, au format Conventional Commits, devient le commit sur `develop`. Elle ferme l'issue.
7. Si c'était la dernière story de l'épique, lance `/release`.
8. Annonce au propriétaire, en une ou deux phrases produit, ce qui est maintenant disponible dans l'app.
