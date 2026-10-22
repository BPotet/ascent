---
name: backlog
description: Récupère les issues ouvertes du dépôt GitHub d'Ascent, les classe par statut et propose la prochaine action. À lancer en début de session ou quand le propriétaire demande où on en est.
---

# /backlog

1. Récupère toutes les issues ouvertes du dépôt avec les outils GitHub.
2. Classe-les par label de statut, dans l'ordre du workflow (`docs/workflow.md`).
3. Présente au propriétaire, en français et en termes produit :
   - ce qui **attend sa validation** (`status:awaiting-approval`) ;
   - ce qui est **bloqué** (`status:blocked`), avec le résumé ;
   - ce qui est **en cours** ;
   - ce qui est **prêt** à partir en développement.
4. Propose **une** prochaine action (un bug se traite avec `/fix-bug`). Priorité : un hotfix (bug en production), une barrière rouge sur `develop`, puis les blocages, puis les validations en attente, puis la story prête la plus prioritaire.
