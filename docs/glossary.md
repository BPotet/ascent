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
| **Habitude** (`Habit`) | Un comportement du quotidien que le joueur veut construire (ex. « me faire à manger ») ou abandonner. Elle est datée de son **jour de création** (date locale). Elle est **active** un jour donné si son jour de création est antérieur ou égal à ce jour ; avant, le jour est « hors habitude ». Son nom, nettoyé des espaces superflus et des caractères invisibles en début et en fin (un nom fait seulement de caractères invisibles est vide), compte de 1 à 40 caractères et est unique sans tenir compte des majuscules (les accents comptent). Le joueur a au plus 10 habitudes à la fois. Elle a une **difficulté** et un **objectif hebdomadaire**, choisis à la création et modifiables ensuite (`updateHabit`, avec le nom). **Modifier** une habitude (`updateHabit`) enregistre en une fois son nom et ses réglages : le nom suit les mêmes règles (elle n'est pas un doublon d'elle-même : on peut n'en changer que les majuscules) et ne change ni ses suivis, ni son jour de création, ni l'expérience ; un changement de difficulté s'applique à toute la semaine en cours, un changement d'objectif à partir de la semaine suivante (sauf le jour de création). « Habitude renommée » s'affiche si seul le nom change, « Habitude modifiée » sinon, suivi de la variation de l'expérience s'il y en a (« Habitude modifiée · +20 XP »). **Supprimer** une habitude (`deleteHabit`), après une confirmation qui annonce l'expérience retirée (`previewHabitDeletion`), est définitif : ses suivis et ses changements de réglages sont effacés et elle n'apparaît plus dans aucune vue ; recréée sous le même nom, elle repart d'aujourd'hui. | Défini |
| **Suivi** (`CheckIn`) | L'indication par le joueur qu'il a tenu une habitude un jour donné. Le joueur n'enregistre que « fait » : un tap passe à « fait », un second tap revient en arrière. Au plus un suivi par habitude et par jour. Un suivi « pas fait » n'existe que s'il porte la marque « corrigé » (correction d'un jour « fait » à sa clôture). | Défini |
| **Jour** (`Day`) | Une date du calendrier local du téléphone. **Aujourd'hui** est la date locale au moment de l'action. Chaque suivi est rattaché à un jour. | Défini |
| **Case** (`HabitDay`) | Une habitude un jour donné. Elle a un état du suivi, est modifiable ou non, et peut porter la marque « corrigé ». | Défini |
| **État du suivi** (`CheckInStatus`) | L'état d'une case (une habitude, un jour), calculé à partir des suivis, du jour de création et d'aujourd'hui : **Fait** (`Done`, suivi « fait », jour ≤ aujourd'hui), **À faire** (`Pending`, aujourd'hui sans « fait »), **Pas fait** (`Missed`, jour clos sans « fait »), **À venir** (`Upcoming`, jour après aujourd'hui, non modifiable), **Hors habitude** (`NotStarted`, jour avant le jour de création, non modifiable). | Défini |
| **Clôture du jour** (`DayClosing`) | Le passage automatique d'un jour à l'état clos, à minuit heure locale. Les cases « à faire » deviennent « pas fait », sans pénalité. C'est un état calculé : rien ne se passe si l'application est fermée. | Défini |
| **Jour clos** (`ClosedDay`) | Un jour antérieur à aujourd'hui. Il est consultable et reste corrigeable. | Défini |
| **Jour neutre** (`neutral`) | Un jour sans habitude active : aucune expérience, rien à corriger. Un jour après aujourd'hui n'est pas neutre mais « à venir ». | Défini |
| **Correction** (`Correction`) | Le changement d'un jour clos de « pas fait » à « fait » ou l'inverse. Sans limite de temps, jamais avant le jour de création de l'habitude, au barème de la difficulté de la semaine corrigée. Une case corrigée porte la marque **« corrigé »**, qui disparaît si elle revient à son état au moment de la clôture. | Défini |
| **Difficulté** (`Difficulty`) | Le niveau d'effort d'une habitude : **Facile** (`easy`, 5 Xp par case « fait »), **Moyenne** (`medium`, 10 Xp), **Difficile** (`hard`, 20 Xp). Par défaut Moyenne. Un changement s'applique à toute la semaine en cours et aux suivantes, jamais aux semaines closes. Toujours affichée avec son icône (1, 2 ou 3 sommets) et son libellé. | Défini |
| **Changement de réglages** (`SettingsChange`) | Un changement daté des réglages d'une habitude, enregistré à sa création puis à chaque modification de ses réglages. Il est daté du jour de sa saisie et porte tous les réglages de l'habitude après le changement ; le même jour, l'ordre de saisie les départage. Leur historique détermine les réglages de la semaine ; il est effacé avec l'habitude. Les habitudes créées avant l'introduction de la difficulté reçoivent un changement « Moyenne » daté de leur jour de création. Un réglage introduit plus tard est vide dans les changements antérieurs à sa mise à jour. | Défini |
| **Changement d'introduction** (`introductionChange`, cas d'usage `introduceWeeklyTarget`) | Le changement de réglages que l'application ajoute à chaque habitude existante à la première ouverture d'une version qui introduit un réglage (la **mise à jour**). Daté de ce jour par l'horloge, il recopie la difficulté de la semaine en cours et porte la valeur introduite (objectif hebdomadaire 7). Les semaines closes avant lui n'ont pas ce réglage. Le jour de la mise à jour ne devient pas un jour de création : pour une habitude créée avant ce jour, un changement d'objectif fait ce jour-là s'applique à partir de la semaine suivante. Une habitude créée le jour même de la mise à jour garde l'exception de son jour de création. | Défini |
| **Objectif hebdomadaire** (`WeeklyTarget`) | Le nombre minimum de cases « fait » par semaine pour qu'une habitude soit tenue, de 1 à 7 (7 = « Tous les jours »), 7 par défaut. Un changement s'applique à partir de la semaine suivante, sauf le jour de création. | Défini |
| **Objectif de la semaine** (`weekTarget`) | L'objectif hebdomadaire en vigueur pour une semaine donnée ; en semaine de création, il ne dépasse pas le nombre de jours actifs de la semaine. Une semaine close avant la mise à jour n'en a pas, ni une semaine sans aucun jour actif (entièrement avant le jour de création, après un recul de l'horloge). | Défini |
| **Progression de la semaine** (`weeklyProgress`) | Le nombre de cases « fait » d'une habitude sur une semaine, jours jusqu'à aujourd'hui. Affichée « 2/3 cette semaine ». | Défini |
| **Objectif atteint** (`targetReached`) | Une habitude dont la progression de la semaine est au moins égale à l'objectif de la semaine. Pas de pénalité sinon. | Défini |
| **Réglages de la semaine** (`WeekSettings`) | Les réglages d'une habitude qui valent pour une semaine donnée, déduits de l'historique daté de ses changements de réglages et de son jour de création : la difficulté (celle du dernier changement fait au plus tard le dimanche de la semaine), l'objectif hebdomadaire en vigueur et l'objectif de la semaine. | Défini |
| **Semaine** (`Week`) | Période de 7 jours, du lundi au dimanche, selon la date locale du téléphone. La **semaine en cours** (`currentWeek`) est celle qui contient aujourd'hui. | Défini |
| **Mois** (`Month`) | Un mois du calendrier local ; ses semaines vont du lundi au dimanche. Le **mois en cours** (`currentMonth`) est celui qui contient aujourd'hui. | Défini |
| **Vue Journée** (`DayView`) | L'écran d'accueil : les habitudes actives aujourd'hui, chacune « à faire » ou « fait », avec sa progression de la semaine et, le cas échéant, « Objectif atteint », et le nombre d'habitudes faites. | Défini |
| **Aide au premier usage** (`CheckInHint`) | Le message unique de la Vue Journée qui explique le tap. Il disparaît pour toujours au premier suivi. | Défini |
| **Carte de nouveauté** (`WhatsNewCard`) | La carte d'information unique de la Vue Journée, affichée à la première ouverture d'une version qui apporte une nouveauté à un joueur qui a déjà des habitudes. Fermable ; elle ne revient jamais. | Défini |
| **Rappel d'hier** (`YesterdayReminder`) | Le bandeau discret en haut de la Vue Journée quand hier compte au moins une habitude active « pas fait » : « Hier : 1/2 faites », avec l'action « Corriger » qui ouvre la Vue Semaine sur la semaine d'hier. Le joueur peut le fermer pour la journée ; il revient le lendemain pour la nouvelle veille. | Défini |
| **Vue Semaine** (`WeekView`) | L'écran qui montre, pour chaque habitude existante, l'état du suivi des 7 jours d'une semaine, sa progression de la semaine et, le cas échéant, « Objectif atteint ». | Défini |
| **Barre d'onglets** (`TabBar`) | La barre en bas de l'écran qui passe d'une vue à l'autre : onglets **Journée**, **Semaine** et **Mois**. L'onglet de la vue affichée a un fond et un libellé en gras. | Défini |
| **Révision du suivi** (`TrackingRevision`) | Le compteur, partagé par les vues affichées, qui avance à chaque habitude créée, modifiée (nom ou réglages) ou supprimée, ou suivi enregistré : les autres vues se rechargent pour rester à jour. | Défini |
| **Vue Mois** (`MonthView`) | L'écran qui montre un mois du calendrier : pour chaque jour, l'état de chaque habitude et le compteur « habitudes faites / habitudes actives ». | Défini |
| **Jour du mois** (`MonthDay`) | Un jour de la Vue Mois : l'état de chaque habitude existante ce jour-là, le compteur « habitudes faites / habitudes actives » et la marque « corrigé » si l'une de ses cases la porte. Il est « à venir » après aujourd'hui, neutre sans habitude active, suivi (`tracked`) sinon. | Défini |
| **Détail du jour** (`DayDetail`) | Ce qui s'ouvre quand le joueur touche un jour de la Vue Mois : l'état de chaque habitude ce jour-là, que le joueur corrige d'un tap. Les habitudes créées plus tard y sont « hors habitude ». | Défini |
| **Historique** (`History`) | L'ensemble des semaines et des mois consultables : du mois (ou de la semaine) qui contient le plus ancien jour de création parmi les habitudes existantes, jusqu'au mois (ou à la semaine) en cours. | Défini |
| **Expérience** (`Xp`) | Points du personnage, total unique toutes habitudes confondues. Quand une case passe à « fait », elle rapporte le barème de la difficulté de sa semaine (5, 10 ou 20 Xp) ; elle le reprend quand elle revient en arrière (aujourd'hui ou par correction). Un changement de difficulté réévalue les cases « fait » de la semaine en cours. Jamais sous 0. À la suppression d'une habitude, l'expérience de ses jours clos reste acquise (**Xp conservée**) ; seule celle de son suivi d'aujourd'hui est retirée, au barème de la semaine en cours. Affichée « XP », dans l'en-tête de chaque vue. Elle vaut toujours la somme des suivis « fait » enregistrés, quel que soit leur jour, chacun au barème de la difficulté de sa semaine, plus l'Xp conservée : un changement de fuseau ou un recul de l'horloge ne la change pas. À sa première ouverture, la version qui l'introduit la calcule à partir des suivis déjà enregistrés. Elle fera monter le niveau du personnage. | Défini (barème) ; lien avec le niveau à préciser |
| **Xp conservée** (`retainedXp`) | L'expérience acquise sur les jours clos d'habitudes supprimées (et sur un jour devenu futur après un recul de l'horloge : tout jour sauf aujourd'hui), comptée au barème de la difficulté de leur semaine. Elle reste dans l'expérience du personnage. | Défini |
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
| **Dev** | L'agent full stack qui implémente une story de bout en bout : domaine, cas d'usage, ports, persistance, interface, feedback de jeu, navigation, fonctions natives du téléphone, builds, tests end-to-end. Plus tard : API et serveur. |
| **Fixer** | L'agent qui corrige les bugs : il les reproduit par un test qui échoue, trouve la cause racine et applique la correction minimale, sans ajouter de fonctionnalité. |
| **Barrière de qualité** (*quality gate*) | Une vérification automatique qui doit passer pour qu'une PR soit mergée. |
| **Conventional Commits** | Le format imposé des messages de commit et des titres de PR : `<type>(<scope>): <description>`. |
| **Auto-merge** | Le merge automatique (squash) d'une PR dans `develop` une fois toutes les barrières de qualité au vert et la review approuvée. |
| **Git Flow** | Le modèle de branches du projet : `main` pour ce qui est publié, `develop` pour l'intégration, et des branches de travail `feature/`, `bugfix/`, `release/`, `hotfix/`. |
| **Release** | La publication d'une nouvelle version : branche `release/x.y.z`, merge dans `main`, tag `vX.Y.Z` et changelog. |
| **Hotfix** | La correction urgente d'un bug en production, faite depuis `main` sur une branche `hotfix/`, puis réintégrée dans `develop`. |
| **Build de preview** | Une version de l'app construite par la CI (sur les PR et sur `develop`) avec le canal `preview`, installable par le propriétaire pour essayer ce qui arrive. |
| **Build de production** | La version de l'app publiée depuis `main`. Elle n'a aucune fonction réservée au build de preview. |
| **Canal du build** (`BuildChannel`) | `preview` ou `production`, fixé à la construction de l'APK. Absent ou inconnu, il vaut `production`. |
| **Sonde de toucher** (`TouchProbe`) | Un outil du build de preview, ouvert seulement par le lien `ascent://preview/touch-probe`. Il mesure l'écart entre l'instant d'un toucher et l'horloge JS, et en déduit la méthode de datation des appuis. |
| **Méthode de datation** (`TimingMethod`) | La façon de dater un appui, retenue par la sonde de toucher : (a) dans le geste, sur le fil UI, quand son horloge a la même base que l'horloge JS (écart compris entre −2 ms et 500 ms) ; sinon (b) de même, recalée par un décalage calibré entre les deux horloges ; sinon (c) à la réception par le JS. |
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
| **Horloge** (`Clock`) | Le port qui donne **aujourd'hui** (la date du calendrier local du téléphone) et prévient quand aujourd'hui change (`WatchedClock.onTodayChange` : à minuit heure locale, au retour au premier plan, lors d'un changement de fuseau ou d'heure, jamais sans changement de jour). Toute règle qui dépend du jour passe par lui, pour pouvoir fixer la date dans les tests. |
| **Visibilité de l'application** (`AppVisibility`) | Ce que l'horloge du téléphone sait de l'application : visible à l'écran (premier plan) ou non. Elle relit l'heure au retour au premier plan, et régulièrement tant que l'application est visible. |
| **Dépôt** (`Repository`) | Port de stockage d'un type de données du domaine (habitudes, suivis, personnage, changements de réglages). |
| **Unité de travail** (`UnitOfWork`) | Port qui exécute un cas d'usage dans une transaction, un seul à la fois. Il fournit les dépôts ; si le cas d'usage échoue, rien n'est enregistré. |
| **Retour haptique** (`Haptics`) | Le port de la vibration légère qui accompagne un gain d'expérience. Jamais pour une perte d'expérience. |
| **Stockage clé-valeur** (`KeyValueStore`) | Un port de stockage local de valeurs texte simples, identifiées par une clé. Les données restent sur le téléphone. |
| **Base locale** | La base SQLite de l'application, sur le téléphone (`ascent.db`). Seuls les adaptateurs de `persistence` y accèdent. |
| **Migration** (`Migration`) | Une évolution versionnée du schéma de la base locale (1, 2, 3…), appliquée automatiquement au démarrage. Une migration publiée ne se modifie jamais : on en ajoute une nouvelle. |
| **Test de contrat** | Une suite de tests commune à tous les adaptateurs d'un même port (ex. en mémoire et SQLite), qui garantit qu'ils se comportent de la même façon. |
