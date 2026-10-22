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
4. **Test** : lance l'agent **qa**. S'il y a des barrières rouges, renvoie au **fixer** avec le rapport, puis relance **qa**. La mutation des écrans n'est lancée que si le propriétaire la demande (label `mutation:ui`).
5. **Review** : passe en `status:review` et lance l'agent **reviewer** (au plus 3 tours, puis `status:blocked` et résumé au propriétaire).
6. **Merge** :
   - `bugfix/` : quand la CI est verte et la review approuvée, active l'auto-merge (squash) dans `develop`. Elle ferme l'issue.
   - `hotfix/` : termine avec la démarche hotfix de `/release` (merge dans `main`, tag, réintégration dans `develop`).
7. Annonce au propriétaire, en une phrase produit, ce qui est réparé.
