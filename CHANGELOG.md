# Changelog

Toutes les évolutions notables d'Ascent. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/). Les versions sont calculées à partir des [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/).

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

[0.1.0]: https://github.com/BPotet/ascent/releases/tag/v0.1.0
