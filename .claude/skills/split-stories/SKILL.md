---
name: split-stories
description: Étape 2 du workflow Ascent, chemin A. Fait découper une épique de fonctionnalité en stories par le PM et l'UX, crée les sous-issues, puis demande la validation du propriétaire. À utiliser après /define-feature ou sur une épique en status:idea ; pas pour le game design, qui passe par l'Atelier de l'ascension.
---

# /split-stories <n° épique>

1. Passe l'épique en `status:specifying`.
2. Lance l'agent **ux** si l'épique a une partie visible. Ne lance pas le **game-designer** sur une fonctionnalité pure : seulement si l'épique touche une règle de jeu hors du Codex (expérience, progression du personnage), en parallèle de l'UX. Si l'épique demande du contenu du Codex (créature, arme, bienfait, valeurs), cette partie passe par l'Atelier de l'ascension (chemin B) : retire-la de l'épique et dis-le au propriétaire.
3. Lance l'agent **pm** avec leurs apports pour produire les stories (template `.github/ISSUE_TEMPLATE/story.md`, critères en Gherkin), selon les règles de « Découpage en stories » de `docs/workflow.md`. Vérifie le découpage : aucune story ne dépend du code d'une autre story pas encore mergée, sauf de la story socle de l'épique (une au plus), et l'épique compte en général 2 à 3 stories, 4 avec une story socle. Au-delà, propose au propriétaire de couper l'épique en deux épiques.
3 bis. Si l'épique a une partie visible : l'agent **ux** produit les **maquettes** (`docs/mockups/<n°-épique>-<slug>/index.html`). Publie la page en lien privé consultable sur téléphone, et ajoute le lien à l'issue épique.
4. Crée chaque story en **sous-issue** de l'épique, avec les labels `type:story` et `status:awaiting-approval`.
5. Passe l'épique en `status:awaiting-approval`.
6. Présente au propriétaire un **résumé lisible** : le **lien vers les maquettes**, une ligne par story, les règles de jeu clés et les questions ouvertes. Pas de détail technique.
7. **Attends sa validation des stories et des maquettes.**
   - Validé : committe les maquettes sur `docs/<n°-épique>-mockups` et merge dans `develop`, puis passe les stories en `status:ready` et l'épique en `status:in-progress`.
   - Modifications demandées : retour à l'étape 2 ou 3 avec ses retours. Les maquettes sont mises à jour et republiées sur le même lien.
