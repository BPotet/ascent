# Changelog

Toutes les évolutions notables d'Ascent. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/). Les versions sont calculées à partir des [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/).

## [0.3.0] - 2026-10-25

L'épique #71 « Ascent en pixel art ».

### Nouveautés pour le joueur

- **La Journée en pixel art** : la Vue Journée, l'en-tête du personnage, la barre d'onglets et l'écran de démarrage prennent l'identité pixel art de la tour. Le ciel de l'en-tête s'éclaire au fil des habitudes faites, et le personnage lève sa lanterne quand toutes sont faites. Tenir une habitude joue une étincelle, une coche relevée, un « +XP » qui s'envole et des puces qui s'allument en or ; ces retours sont figés quand les animations sont réduites (#72, #75).
- **La Semaine, le Mois et les panneaux en pixel art** : la Vue Semaine, la Vue Mois, le Détail du jour, les panneaux « Nouvelle habitude » et « Modifier l'habitude » et la confirmation de suppression passent dans le même style. Une correction d'un jour passé joue les mêmes retours de jeu que dans la Journée, et un objectif atteint s'affiche en or (#73, #76).
- **Une habitude créée reste en vue** : la Vue Journée la fait apparaître juste au-dessus du bouton « Ajouter une habitude », sans rogner l'aide du premier usage, et la liste ne bouge plus sous le doigt du joueur (#73, #76).
- **Combat d'essai** (build de preview seulement) : un premier combat jouable avec parade et esquive, la Sentinelle contre une Goule et un Spectre (#31, #53).

### Technique

- Maquettes validées de l'épique #71 (#74), et mesures sur téléphone du moteur de combat (#69).
- Identité pixel art documentée dans l'ADR 0007 : sprites dessinés par le code, Skia réservé aux grandes images, pixel d'art arrondi au pixel physique. Une règle d'architecture garde les écrans d'habitude en pixel art (#75, #76).

## [0.2.0] - 2026-10-23

L'épique #22 « Difficulté et objectif hebdomadaire des habitudes ».

### Nouveautés pour le joueur

- **Difficulté des habitudes** : Facile, Moyenne ou Difficile, choisie à la création et modifiable ; une habitude tenue rapporte 5, 10 ou 20 XP selon sa difficulté. Les habitudes existantes passent en Moyenne, sans changer l'XP déjà gagnée (#23, #29).
- **Objectif hebdomadaire** : de 1 à 7 fois par semaine, avec la progression « 2/3 cette semaine » dans la Vue Journée et la Vue Semaine, et le badge « Objectif atteint ». Un changement d'objectif s'applique à partir du lundi suivant (#24, #50).
- **Compteurs justes pour les habitudes non quotidiennes** : une habitude dont l'objectif de la semaine est déjà atteint n'est plus comptée comme à faire dans les compteurs du jour, « Toutes faites » et le rappel d'hier (#25, #57).
- **Prime d'objectif** : atteindre l'objectif de la semaine rapporte une prime proportionnelle à l'objectif et à la difficulté, avec un éclat doré, le message « Objectif de la semaine atteint » et une vibration ; la prime est retirée si l'on repasse sous l'objectif (#26, #61).
- **Objectifs par semaine dans la Vue Mois** : sous la grille, une ligne par semaine « Semaine du 5 octobre · 3/4 objectifs atteints », qui ouvre la Vue Semaine ; le Détail du jour affiche la progression de la semaine de ce jour et joue le feedback quand une correction atteint l'objectif (#27, #60).

### Technique

- Maquettes validées des épiques #22 et #30 (#28, #44) et socle natif des futurs combats en 2D (#47).
- CI plus rapide et plus économe : mutation des seules lignes nouvelles en parallèle, mutation des écrans à la demande, cache de l'émulateur, moins d'artefacts conservés, barrières lourdes sautées quand seule la documentation change, APK et end-to-end sautés sur une PR en brouillon ou quand l'app ne change pas (#21, #43, #45, #52, #55, #64, #65).
- Workflow : un seul dev full stack et un agent de correction de bugs, découpage des stories, TDD par couche, plugin Ponytail (#51, #58, #59, #62, #63).

## [0.1.0] - 2026-10-21

Première version jouable : l'épique #2 « Gérer ses habitudes et les suivre jour par jour ».

### Nouveautés pour le joueur

- **Créer ses habitudes** et les retrouver dans la **Vue Journée**, l'écran d'accueil, même après un redémarrage ; 10 habitudes au plus, nom de 1 à 40 caractères, sans doublon (#3, #13).
- **Confirmer ses habitudes du jour** d'un tap, avec le compteur « faites », un encouragement quand tout est fait et le passage automatique au jour suivant à minuit (#4, #14).
- **Vue Semaine** : l'état de chaque habitude sur les 7 jours, la navigation de semaine en semaine dans l'historique et une barre d'onglets Journée / Semaine (#7, #15).
- **Corriger un jour passé** depuis la Vue Semaine, sans limite de temps, avec la marque « corrigé » et le rappel « Hier : x/y faites · Corriger » (#9, #16).
- **Expérience** : +10 XP par habitude tenue, −10 XP en cas de retour en arrière, jamais sous 0 ; l'XP s'affiche en haut des vues, s'envole de la case et fait vibrer légèrement le téléphone ; l'XP des suivis déjà enregistrés est comptée dès la mise à jour (#5, #17).
- **Renommer ou supprimer une habitude** ; à la suppression, seule l'XP d'aujourd'hui est retirée, celle des jours passés reste acquise (#6, #18).
- **Vue Mois et historique** : un troisième onglet avec, pour chaque jour, le compteur « faites / actives », le détail d'un jour pour corriger un oubli et la navigation dans tout l'historique (#10, #19).

### Technique

- Socle Expo (Android et iOS), base locale SQLite avec migrations, architecture hexagonale vérifiée, barrières de qualité (lint, types, tests unitaires, d'intégration, BDD, mutation, end-to-end Maestro, secrets) et construction de l'APK en CI (#12).
- Maquettes validées de l'épique #2 (#11) et workflow de développement (#1).

[0.3.0]: https://github.com/BPotet/ascent/releases/tag/v0.3.0
[0.2.0]: https://github.com/BPotet/ascent/releases/tag/v0.2.0
[0.1.0]: https://github.com/BPotet/ascent/releases/tag/v0.1.0
