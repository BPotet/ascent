---
name: define-feature
description: Étape 1 du workflow Ascent. Transforme la description d'une feature par le propriétaire en issue épique GitHub. À utiliser quand le propriétaire décrit une nouvelle fonctionnalité.
---

# /define-feature

1. Écoute la description du propriétaire. S'il manque l'objectif ou la valeur pour le joueur, pose **au plus 3 questions**.
2. Vérifie `docs/glossary.md` : liste les termes nouveaux ou ambigus.
3. Rédige l'épique avec `.github/ISSUE_TEMPLATE/epic.md`. Garde-la assez petite pour 2 à 3 stories, 4 avec une story socle (voir « Découpage en stories » dans `docs/workflow.md`). Si la feature est plus grosse, propose au propriétaire de la répartir en plusieurs épiques.
4. Crée l'issue avec les labels `type:epic` et `status:idea`.
5. Si des termes sont nouveaux, propose leur ajout au glossaire (ils seront intégrés à la première PR de l'épique).
6. Donne le lien de l'issue au propriétaire et enchaîne sur `/split-stories`.
