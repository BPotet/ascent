---
name: define-feature
description: Étape 1 du workflow Ascent, chemin A. Transforme la description d'une fonctionnalité (une partie de l'app, sans contenu de jeu) en issue épique GitHub. À utiliser quand le propriétaire décrit une nouvelle fonctionnalité ; pas pour du game design, qui passe par l'Atelier de l'ascension (chemin B).
---

# /define-feature

0. **Oriente l'idée** (voir « Orienter une idée » dans `docs/workflow.md`). Si elle touche le contenu ou le gameplay (créature, arme, bienfait, mécanique, valeurs), c'est le **chemin B** : arrête-toi ici, le point d'entrée est l'**Atelier de l'ascension** (voir « Atelier de l'ascension »). Si elle touche les deux, sépare-la : le contenu va dans l'Atelier, la partie de l'app continue ici. En cas de doute, demande au propriétaire.
1. Écoute la description du propriétaire. S'il manque l'objectif ou la valeur pour le joueur, pose **au plus 3 questions**.
2. Vérifie `docs/glossary.md` : liste les termes nouveaux ou ambigus.
3. Rédige l'épique avec `.github/ISSUE_TEMPLATE/epic.md`. Garde-la assez petite pour 2 à 3 stories, 4 avec une story socle (voir « Découpage en stories » dans `docs/workflow.md`). Si la feature est plus grosse, propose au propriétaire de la répartir en plusieurs épiques.
4. Crée l'issue avec les labels `type:epic` et `status:idea`.
5. Si des termes sont nouveaux, propose leur ajout au glossaire (ils seront intégrés à la première PR de l'épique).
6. Donne le lien de l'issue au propriétaire et enchaîne sur `/split-stories`.
