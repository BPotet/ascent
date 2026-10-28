---
name: split-stories
description: Étape 2 du workflow Ascent. Fait découper une épique en stories par le PM, le Game Designer et l'UX, crée les sous-issues, puis demande la validation du propriétaire. À utiliser après /define-feature ou sur une épique en status:idea.
---

# /split-stories <n° épique>

1. Passe l'épique en `status:specifying`.
2. Lance l'agent **game-designer** si l'épique touche la progression ou le monde de jeu, et l'agent **ux** si elle a une partie visible. Ils peuvent travailler en parallèle.
3. Lance l'agent **pm** avec leurs apports pour produire les stories (template `.github/ISSUE_TEMPLATE/story.md`, critères en Gherkin), selon les règles de « Découpage en stories » de `docs/workflow.md`. Vérifie le découpage : aucune story ne dépend du code d'une autre story pas encore mergée, sauf de la story socle de l'épique (une au plus), et l'épique compte en général 2 à 3 stories, 4 avec une story socle. Au-delà, propose au propriétaire de couper l'épique en deux épiques.
3 bis. Si l'épique a une partie visible : l'agent **ux** produit les **maquettes** (`docs/mockups/<n°-épique>-<slug>/index.html`). Publie la page en lien privé consultable sur téléphone, et ajoute le lien à l'issue épique.
4. Crée chaque story en **sous-issue** de l'épique, avec les labels `type:story` et `status:awaiting-approval`.
5. Passe l'épique en `status:awaiting-approval`.
6. Présente au propriétaire un **résumé lisible** : le **lien vers les maquettes**, une ligne par story, les règles de jeu clés et les questions ouvertes. Pas de détail technique.
7. **Attends sa validation des stories et des maquettes.**
   - Validé : committe les maquettes sur `docs/<n°-épique>-mockups` et merge dans `develop`, puis passe les stories en `status:ready` et l'épique en `status:in-progress`.
   - Modifications demandées : retour à l'étape 2 ou 3 avec ses retours. Les maquettes sont mises à jour et republiées sur le même lien.
