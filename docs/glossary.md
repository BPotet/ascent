# Glossaire Ascent

> **Source de vérité unique du vocabulaire du projet.**
> Ce glossaire est écrit pour être lu par un humain. Les agents l'utilisent comme référence : le code, les issues, les stories, les tests et la documentation emploient **exactement** ces termes.
>
> Règles :
> - Un terme absent d'ici n'existe pas encore. Il faut l'ajouter **avant** de l'utiliser.
> - Un terme marqué *« à préciser »* a un sens provisoire. Il doit être tranché avec le PM et le Game Designer avant d'être implémenté.
> - Toute PR qui introduit ou modifie un concept met ce fichier à jour dans la même PR.
> - Dans le code, le terme anglais indiqué entre parenthèses est le seul nom autorisé.

---

## Produit et jeu

| Terme | Définition | Statut |
|---|---|---|
| **Joueur** (`Player`) | La personne qui utilise Ascent. | Défini |
| **Personnage** (`Character`) | L'avatar du joueur dans le jeu. Il progresse quand le joueur tient ses habitudes. | Défini |
| **Habitude** (`Habit`) | Un comportement du quotidien que le joueur veut construire (ex. « me faire à manger ») ou abandonner. | Défini |
| **Suivi** (`CheckIn`) | L'action par laquelle le joueur indique, pour un jour donné, s'il a tenu une habitude ou non. | Défini, format à préciser (fait / pas fait, ou plus fin) |
| **Jour** (`Day`) | Unité de temps du suivi. Chaque suivi est rattaché à un jour. | Défini |
| **Expérience** (`Xp`) | Points gagnés en tenant ses habitudes. Ils font monter le niveau du personnage. | À préciser (barème) |
| **Niveau** (`Level`) | Le palier de progression du personnage, déterminé par son expérience. | À préciser (courbe) |
| **Compétence** (`Skill`) | Une capacité que le personnage débloque grâce à sa progression. | À préciser (effets) |
| **Déblocage** (`Unlock`) | L'obtention d'une compétence ou d'une récompense quand une condition de progression est remplie. | À préciser |
| **Monstre** (`Monster`) | Un adversaire que le personnage combat dans le monde de jeu. | À préciser |
| **Quête** (`Quest`) | Un objectif narratif composé d'étapes, lié à l'histoire. | À préciser (lien avec les habitudes) |
| **Histoire** (`Story`, côté jeu : `Lore`) | Le récit et l'univers d'Ascent. Dans le code, utiliser `Lore` pour éviter la confusion avec une *story* de développement. | À préciser (univers, ton) |
| **Verrou** (`AppLock`) | La protection d'accès à l'application sur le téléphone. | À préciser (PIN, biométrie) |

## Workflow de développement

| Terme | Définition |
|---|---|
| **Orchestrateur** | La session de chat principale. Elle reçoit les demandes du joueur-propriétaire, gère les issues GitHub et distribue le travail aux agents. |
| **Épique** (`Epic`) | Une fonctionnalité complète, décrite dans une issue GitHub portant le label `type:epic`. |
| **Story** | Une tranche livrable d'une épique, sous-issue avec le label `type:story`. Une story correspond à une PR. |
| **Critère d'acceptation** | Une condition vérifiable qu'une story doit remplir. Il est écrit en Gherkin (`Étant donné / Quand / Alors`). |
| **Scénario Gherkin** | Un critère d'acceptation sous forme exécutable, dans un fichier `.feature`. |
| **Analyse d'impact** | L'analyse GitNexus du code existant, faite avant d'implémenter une story, pour mesurer ce qu'elle va toucher. |
| **Impact fort** | Le résultat d'une analyse d'impact qui oblige à renvoyer la story au PM et à l'Architect avant de continuer (voir `docs/workflow.md`). |
| **Barrière de qualité** (*quality gate*) | Une vérification automatique qui doit passer pour qu'une PR soit mergée. |
| **Auto-merge** | Le merge automatique d'une PR dans `main` une fois toutes les barrières de qualité au vert. |
| **Escalade** | L'arrêt de la boucle automatique, avec un commentaire sur l'issue pour demander une décision humaine. |

## Architecture

| Terme | Définition |
|---|---|
| **Architecture hexagonale** | L'organisation du code en domaine, application et adaptateurs. Les dépendances pointent toujours vers le domaine. |
| **Domaine** (`domain`) | Les règles métier pures (habitudes, progression, compétences). Il ne dépend d'aucune bibliothèque ni du framework. |
| **Application** (`application`) | Les cas d'usage, qui orchestrent le domaine à travers des ports. |
| **Cas d'usage** (*use case*) | Une action du joueur exprimée côté application (ex. « enregistrer un suivi »). |
| **Port** | Une interface définie par le domaine ou l'application pour communiquer avec l'extérieur (stockage, horloge, authentification). |
| **Adaptateur** (`adapter`) | L'implémentation concrète d'un port (base locale, écran, biométrie). |
| **Test d'architecture** | Un test automatique qui vérifie que les dépendances respectent l'architecture hexagonale. |
