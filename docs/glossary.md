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
| **Habitude** (`Habit`) | Un comportement du quotidien que le joueur veut construire (ex. « me faire à manger ») ou abandonner. Elle est datée de son **jour de création** (date locale). Elle est **active** un jour donné si son jour de création est antérieur ou égal à ce jour ; avant, le jour est « hors habitude ». Son nom, nettoyé des espaces superflus et des caractères invisibles en début et en fin (un nom fait seulement de caractères invisibles est vide), compte de 1 à 40 caractères et est unique sans tenir compte des majuscules (les accents comptent). Le joueur a au plus 10 habitudes à la fois. | Défini |
| **Suivi** (`CheckIn`) | L'indication par le joueur qu'il a tenu une habitude un jour donné. Le joueur n'enregistre que « fait » : un tap passe à « fait », un second tap revient en arrière. Au plus un suivi par habitude et par jour. Un suivi « pas fait » n'existe que s'il porte la marque « corrigé » (correction d'un jour « fait » à sa clôture). | Défini |
| **Jour** (`Day`) | Une date du calendrier local du téléphone. **Aujourd'hui** est la date locale au moment de l'action. Chaque suivi est rattaché à un jour. | Défini |
| **Case** (`HabitDay`) | Une habitude un jour donné. Elle a un état du suivi, est modifiable ou non, et peut porter la marque « corrigé ». | Défini |
| **État du suivi** (`CheckInStatus`) | L'état d'une case (une habitude, un jour), calculé à partir des suivis, du jour de création et d'aujourd'hui : **Fait** (`Done`, suivi « fait », jour ≤ aujourd'hui), **À faire** (`Pending`, aujourd'hui sans « fait »), **Pas fait** (`Missed`, jour clos sans « fait »), **À venir** (`Upcoming`, jour après aujourd'hui, non modifiable), **Hors habitude** (`NotStarted`, jour avant le jour de création, non modifiable). | Défini |
| **Clôture du jour** (`DayClosing`) | Le passage automatique d'un jour à l'état clos, à minuit heure locale. Les cases « à faire » deviennent « pas fait », sans pénalité. C'est un état calculé : rien ne se passe si l'application est fermée. | Défini |
| **Jour clos** (`ClosedDay`) | Un jour antérieur à aujourd'hui. Il est consultable et reste corrigeable. | Défini |
| **Jour neutre** (`neutral`) | Un jour sans habitude active : aucune expérience, rien à corriger. | Défini |
| **Correction** (`Correction`) | Le changement d'un jour clos de « pas fait » à « fait » ou l'inverse. Sans limite de temps, jamais avant le jour de création de l'habitude, même barème d'expérience qu'un suivi du jour. Une case corrigée porte la marque **« corrigé »**, qui disparaît si elle revient à son état au moment de la clôture. | Défini |
| **Semaine** (`Week`) | Période de 7 jours, du lundi au dimanche, selon la date locale du téléphone. | Défini |
| **Mois** (`Month`) | Un mois du calendrier local ; ses semaines vont du lundi au dimanche. | Défini |
| **Vue Journée** (`DayView`) | L'écran d'accueil : les habitudes actives aujourd'hui, chacune « à faire » ou « fait ». | Défini |
| **Vue Semaine** (`WeekView`) | L'écran qui montre, pour chaque habitude existante, l'état du suivi des 7 jours d'une semaine. | Défini |
| **Vue Mois** (`MonthView`) | L'écran qui montre un mois du calendrier : pour chaque jour, l'état de chaque habitude et le compteur « habitudes faites / habitudes actives ». | Défini |
| **Historique** (`History`) | L'ensemble des semaines et des mois consultables : du mois (ou de la semaine) qui contient le plus ancien jour de création parmi les habitudes existantes, jusqu'au mois (ou à la semaine) en cours. | Défini |
| **Expérience** (`Xp`) | Points du personnage, total unique toutes habitudes confondues. **+10 Xp** quand une case passe à « fait », **−10 Xp** quand elle revient en arrière (aujourd'hui ou par correction). Jamais sous 0. À la suppression d'une habitude, l'expérience de ses jours clos reste acquise (**Xp conservée**) ; seule celle de son suivi d'aujourd'hui est retirée. Affichée « XP ». Elle fera monter le niveau du personnage. | Défini (barème) ; lien avec le niveau à préciser |
| **Xp conservée** (`retainedXp`) | L'expérience acquise sur les jours clos d'habitudes supprimées. Elle reste dans l'expérience du personnage. | Défini |
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
| **Maquette** | La représentation visuelle des écrans d'une épique, avec tous leurs états, validée par le propriétaire avec les stories. Une fois validée, elle fait foi pour l'interface. Stockée dans `docs/mockups/`. |
| **Critère d'acceptation** | Une condition vérifiable qu'une story doit remplir. Il est écrit en Gherkin (`Étant donné / Quand / Alors`). |
| **Scénario Gherkin** | Un critère d'acceptation sous forme exécutable, dans un fichier `.feature`. |
| **Analyse d'impact** | L'analyse GitNexus du code existant, faite avant d'implémenter une story, pour mesurer ce qu'elle va toucher. |
| **Impact fort** | Le résultat d'une analyse d'impact qui oblige à renvoyer la story au PM et à l'Architect avant de continuer (voir `docs/workflow.md`). |
| **Dev backend** | L'agent qui possède la logique et les données : domaine, cas d'usage, ports, persistance. Plus tard : API et serveur. |
| **Dev front** | L'agent qui possède l'interface : composants, écrans, états d'affichage, feedback de jeu. |
| **Dev mobile** | L'agent qui possède la plateforme : navigation, assemblage, fonctions natives du téléphone, builds, tests end-to-end. |
| **Barrière de qualité** (*quality gate*) | Une vérification automatique qui doit passer pour qu'une PR soit mergée. |
| **Conventional Commits** | Le format imposé des messages de commit et des titres de PR : `<type>(<scope>): <description>`. |
| **Auto-merge** | Le merge automatique (squash) d'une PR dans `develop` une fois toutes les barrières de qualité au vert et la review approuvée. |
| **Git Flow** | Le modèle de branches du projet : `main` pour ce qui est publié, `develop` pour l'intégration, et des branches de travail `feature/`, `bugfix/`, `release/`, `hotfix/`. |
| **Release** | La publication d'une nouvelle version : branche `release/x.y.z`, merge dans `main`, tag `vX.Y.Z` et changelog. |
| **Hotfix** | La correction urgente d'un bug en production, faite depuis `main` sur une branche `hotfix/`, puis réintégrée dans `develop`. |
| **Build de preview** | Une version de l'app construite depuis `develop`, installable par le propriétaire pour essayer ce qui arrive. |
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
| **Horloge** (`Clock`) | Le port qui donne **aujourd'hui** (la date du calendrier local du téléphone) et prévient quand aujourd'hui change. Toute règle qui dépend du jour passe par lui, pour pouvoir fixer la date dans les tests. |
| **Dépôt** (`Repository`) | Port de stockage d'un type de données du domaine (habitudes, suivis, personnage). |
| **Unité de travail** (`UnitOfWork`) | Port qui exécute un cas d'usage dans une transaction, un seul à la fois. Il fournit les dépôts ; si le cas d'usage échoue, rien n'est enregistré. |
| **Stockage clé-valeur** (`KeyValueStore`) | Un port de stockage local de valeurs texte simples, identifiées par une clé. Les données restent sur le téléphone. |
| **Base locale** | La base SQLite de l'application, sur le téléphone (`ascent.db`). Seuls les adaptateurs de `persistence` y accèdent. |
| **Migration** (`Migration`) | Une évolution versionnée du schéma de la base locale (1, 2, 3…), appliquée automatiquement au démarrage. Une migration publiée ne se modifie jamais : on en ajoute une nouvelle. |
| **Test de contrat** | Une suite de tests commune à tous les adaptateurs d'un même port (ex. en mémoire et SQLite), qui garantit qu'ils se comportent de la même façon. |
