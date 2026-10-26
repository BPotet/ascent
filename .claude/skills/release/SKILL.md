---
name: release
description: Publie une nouvelle version d'Ascent selon Git Flow — branche release depuis develop, calcul de la version à partir des Conventional Commits, changelog, suite de tests complète, merge dans main avec tag, réintégration dans develop. À utiliser quand une épique est terminée ou quand le propriétaire demande une version.
---

# /release

1. Vérifie que `develop` est entièrement vert. Sinon, arrête-toi et traite d'abord la barrière rouge.
   Vérifie aussi qu'aucun prototype non repris n'est dans `develop` : cherche les stories fermées avec le label `prototype`. S'il en existe une dont ni la story « version définitive » ni la tâche `type:chore` de retrait n'est mergée, arrête-toi et préviens le propriétaire (voir « Mode prototype » dans `docs/workflow.md`). Un hotfix part de `main` et n'est pas concerné.
2. Calcule la prochaine version depuis le dernier tag `vX.Y.Z`, à partir des commits Conventional Commits de `develop` : `BREAKING CHANGE` ou `!` → MAJOR, `feat` → MINOR, `fix` → PATCH. Sans `feat` ni `fix`, pas de release.
3. Crée `release/<x.y.z>` depuis `develop`.
4. Sur cette branche : numéro de version et changelog généré depuis les commits, avec un commit `chore(release): <x.y.z>`.
5. Ouvre la PR `release/<x.y.z>` → `main` (titre `chore(release): <x.y.z>`). La CI lance la suite complète.
   - Un bug trouvé ici est corrigé **sur la branche de release** (commit `fix`), jamais par une nouvelle fonctionnalité.
6. Quand tout est vert, merge dans `main` avec un **commit de merge**, puis crée le tag `v<x.y.z>` et la GitHub Release avec le changelog.
7. Réintègre `main` dans `develop` et supprime la branche de release.
8. Annonce la version au propriétaire, en termes produit : ce qui est nouveau pour le joueur.

Pour un **hotfix**, même démarche, mais la branche `hotfix/<x.y.z>-<slug>` part de `main`, la version est un PATCH, et la correction est faite avec `/fix-bug` (Fixer, QA, review) avant le merge dans `main` puis dans `develop`.
