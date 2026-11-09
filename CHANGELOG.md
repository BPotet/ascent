# Changelog

Toutes les évolutions notables d'Ascent. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/). Les versions sont calculées à partir des [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/).

## [0.8.0] - 2026-11-09

L'épique #245 « Élites escortées et nouvelles Élites », terminée : aux paliers 2 et 3, l'Élite arrive escortée, et chaque palier gagne une 3ᵉ Élite avec sa mécanique signature.

### Nouveautés pour le joueur

- **L'Élite escortée** (build de preview) : aux paliers 2 et 3, la porte Élite annonce une Élite escortée, de 1 ennemi au palier 2 et de 2 au palier 3, sans dire lesquels. Au combat, l'Élite couronnée mène à gauche, son escorte d'ennemis ordinaires du palier à sa droite ; il faut tous les battre, et « L'escorte reste » quand l'Élite tombe la première. En contrepartie, les PV et les dégâts des Élites passent à 80 / 80 / 88 % aux paliers 1, 2 et 3 ; les gardes et les boss ne changent pas (#257, #261).
- **Le Fossoyeur et la règle du sac** (build de preview) : aux Catacombes, une 3ᵉ Élite, le Fossoyeur, exhume un Squelette aux manches paires. Sa pelle l'annonce d'avance, une garde brisée avant son tour l'en empêche, et un seul Squelette exhumé tient debout à la fois ; une bulle le présente à la première rencontre. Une porte Élite mène d'abord aux Élites pas encore affrontées dans le palier (#258, #262).
- **La Mère-ronce et ses Épines, le Bedeau et son Sanctuaire** (build de preview) : aux Jardins de cendre, la Mère-ronce pique le héros de 2 PV à chaque frappe tant qu'elle n'est pas étourdie ; au Beffroi, le Sanctuaire du Bedeau divise par deux les dégâts qu'il subit tant que sa garde tient. Briser la garde devient l'objectif de ces deux combats (#259, #263).

### Technique

- Maquettes validées de l'épique #245 (#260).

## [0.7.0] - 2026-11-07

L'épique #232 « L'arbre de pouvoirs du héros », terminée : après le socle arrivé en 0.6.0 (#235, #242), les frappes de pouvoir, le choix des pouvoirs équipés et le Serment qui lie une habitude à un pouvoir. Et l'épique #243 « Rééquilibrage, un palier 3 qui résiste » : les gardes, les Élites, les boss et les soins sont revus pour que le Sommet redevienne un vrai défi.

### Nouveautés pour le joueur

- **Le Serment** (build de preview) : au Camp, dans la fiche d'un pouvoir débloqué qui coûte 2 Élan ou plus, le joueur lie une de ses habitudes à ce pouvoir. Dès le lendemain, si l'habitude a été faite la veille, le pouvoir est attisé pour toute l'ascension : il coûte 1 Élan de moins, ce que montrent le choix du héros, l'Équipement et sa touche de combat, avec une petite flamme. Les Éclats et les prix de l'arbre ne changent pas (#237, #251).
- **Les frappes de pouvoir et le choix des pouvoirs équipés** (build de preview) : les quatre frappes annoncées « Bientôt » se débloquent dans l'arbre et se lancent en combat comme une frappe en rythme. Pour la Sentinelle, **Coup de bouclier** (2 Élan, un coup qui brise fort la garde) et **Fracas** (3 Élan, un coup lourd) ; pour l'Errante, **Rafale** (2 Élan, 4 coups) et **Frappe furtive** (3 Élan, 2 coups, bien plus forts sur un ennemi qui n'a pas encore joué). Avec 4 pouvoirs ou plus, « Changer les pouvoirs » au choix du héros permet d'emporter les 3 de son choix, pouvoir de base compris ; le choix est retenu pour chaque héros (#236, #254).
- **Un palier 3 qui résiste** (build de preview) : les gardes des ennemis ordinaires sont deux fois plus solides, et les bonus de frappe parfaite ne s'ajoutent plus qu'aux dégâts sur les PV, pas à la garde ; les Élites et les boss des paliers 2 et 3 sont plus forts ; le répit entre les combats passe à 5 % aux paliers 2 et 3 ; les soins d'une parade parfaite sont plafonnés à 10 PV par combat ; une porte Élite ne ramène plus la dernière Élite affrontée dans le palier (#244, #253).

## [0.6.0] - 2026-11-07

L'épique #208 « Coffres, clés et bénédictions de fortune », terminée, et le socle de l'épique #232 « L'arbre de pouvoirs du héros » : les pouvoirs se débloquent au Camp et le héros en emporte jusqu'à trois au combat.

### Nouveautés pour le joueur

- **Le coffre du butin** : l'objet trouvé après un combat, ou l'objet garanti d'une Élite, sort d'un coffre de chêne qui tremble, s'ouvre dans une lueur d'or et laisse place à l'objet ; un toucher passe l'ouverture, et le coffre reste immobile, déjà ouvert, quand les animations sont réduites ou à la reprise (#227, #239).
- **Le coffre scellé, les clés et la bénédiction Fortune** : après chaque Élite gagnée, maudite comprise, un coffre scellé attend. « Ouvrir · 1 clé » révèle un objet de plus, jamais déjà porté ; « Laisser » le perd sans coûter de clé, et sans clé il reste fermé. Les clés viennent de la Faveur (1 clé dès la Faveur) et de la nouvelle bénédiction Fortune (+1, +2 ou +3 clés) ; elles traversent les paliers, s'affichent dans l'en-tête de l'ascension, au pied de la tour et dans les Réserves de l'Équipement, et l'entrée dans la tour annonce les clés reçues. La porte Élite annonce son coffre scellé (#226, #241).
- **Le décor du palier derrière le pied de la tour** (build de preview) : le pied de la tour s'ouvre sur le fond du palier 1, ou du palier de l'ascension en cours, sous un voile de nuit qui garde chaque texte lisible (#233, #249).
- **L'arbre de pouvoirs** (build de preview) : au Camp, chaque héroïne a son arbre, avec son pouvoir de base et deux voies de deux rangs ; un pouvoir s'y débloque pour 30 ou 60 Éclats et s'allume d'un anneau doré. Le héros emporte jusqu'à 3 pouvoirs équipés, fixés au départ de l'ascension et montrés au choix du héros et dans l'Équipement ; chacun a sa touche à côté d'« Attaquer », et un appui long montre son effet. Quatre nouveaux pouvoirs : pour la Sentinelle, **Représailles** (la prochaine contre-attaque frappe deux fois plus fort) et **Tenir bon** (rend 20 % des PV et éteint la Brûlure et le Saignement, une fois par combat) ; pour l'Errante, **Entaille** (la prochaine frappe retire 150 % de garde) et **Brume** (le prochain coup subi est réduit de moitié) ; les frappes de pouvoir sont annoncées « Bientôt » (#235, #242).

### Technique

- Maquettes validées des épiques #208 et #232 (#238, #240).

## [0.5.0] - 2026-11-05

L'épique #205 « Les habitudes dans la tour, jauge et faveur », terminée : après le cadran de la jauge et les ennemis maudits arrivés en 0.4.0 (#41, #209), la Faveur donne maintenant des relances et une seconde chance.

### Nouveautés pour le joueur

- **Les relances de la Faveur** : les habitudes tenues la veille donnent 1 relance (Faveur) ou 2 (Faveur pleine) pour toute l'ascension. « Relancer » remplace l'offre de bienfaits après un combat par une nouvelle, sans les bienfaits écartés tant qu'il en reste d'autres ; Cœur de braise garde sa place. Les relances s'affichent au pied de la tour, dans l'ascension en cours et dans l'Équipement, et une relance faite reste faite, même après avoir fermé l'app (#42, #228).
- **La seconde chance de la Faveur pleine** : une fois par ascension, quand un coup ennemi ferait tomber le héros, il se relève avec la moitié de ses PV dans un halo doré, sous le bandeau « Seconde chance » ; la Brûlure et le Saignement s'éteignent, l'Élan et le pouvoir actif restent. Elle s'affiche au pied de la tour, dans l'Équipement et en combat, prête ou utilisée ; une chute après qu'elle a servi le rappelle : « Ta seconde chance a déjà servi. » (#206, #229).

## [0.4.0] - 2026-11-05

Les épiques #89 « Prototype d'une ascension complète, build et jauge », #102 « Le contenu de l'Atelier de l'ascension dans la tour », #136 « Les ennemis, les boss et les héroïnes animés », #153 « Les icônes des bienfaits et des bénédictions », #160 « Icône de l'application », #170 « Les paliers 2 et 3, jusqu'au sommet », #174 « Reconnaître chaque palier et chaque combattant d'un coup d'œil », #193 « Exporter le journal de mes ascensions », #194 « Le camp » et #210 « Paliers distincts », avec les premières stories des épiques #30, #88, #118 et #205.

### Nouveautés pour le joueur

- **L'icône d'Ascent** : la tour sous la nuit sur l'écran d'accueil, en icône à thème, à l'écran de démarrage et en favicon (#166, #167).
- **La Tour** (build de preview seulement) : un onglet Tour ouvre le Pied de la tour pour commencer, reprendre ou abandonner une ascension, étage par étage, avec ses combats, ses portes, ses Élites, le Feu de camp et un boss à deux phases. Quitter l'écran met en pause et sauvegarde ; la reprise repart de l'action en cours après un compte à rebours. Le combat d'essai disparaît : tous les combats passent par l'ascension (#91, #95, #121, #126).
- **Le combat en rythme, en pixel art 2.5D** : frapper à l'impact, briser la garde pour étourdir, dépenser son Élan, lire les intentions des ennemis en icônes. Chaque coup ennemi se lit à son geste, à son reflet et à son son ; un coup imparable porte le sceau et la palette rouges. L'anneau de timing est retiré (#32, #81, #82, #84, #101, #103).
- **Deux héroïnes** : la Sentinelle ou l'Errante, choisie au pied de la tour, et une Frise d'action qui montre qui agit selon l'Initiative. Le Rempart de la Sentinelle riposte au premier impact ; l'Errante lance Pas de l'ombre sans perdre son tour (#90, #96, #92, #100, #128, #154, #173, #179).
- **Les habitudes nourrissent l'ascension** : la Jauge du jour, de Faveur pleine à Malédiction forte, d'après les habitudes d'hier, devient un cadran à cinq crans avec son détail ; des bénédictions de départ par habitude faite hier ; un bienfait parmi trois après chaque combat gagné ; l'Équipement consultable au pied de la tour et pendant l'ascension. Sous la malédiction, un ennemi de chaque combat est maudit (+20 % de PV, de garde et de dégâts), et l'Élite aussi en malédiction forte (#93, #99, #92, #100, #159, #169, #41, #220, #209, #222).
- **Le contenu de l'Atelier de l'ascension** : la Hache rouillée, l'Arbalète, le Marteau devenu Rare, l'Armure de chevalier déchu (Attaque +5 %) et la bénédiction Protection ; le Villageois fou dont la Fourche fait saigner, le Squelette qui se relève une fois et l'Élite Les Jumeaux avec son Onde de choc à esquiver (#105, #113, #129, #130, #152, #162, #107, #112, #106, #114, #108, #115).
- **Les paliers 2 et 3, jusqu'au Sommet** : après les Catacombes, les Jardins de cendre puis le Beffroi, avec des ennemis plus forts, de nouvelles Élites et de nouveaux boss, et des Éclats gardés même après une chute. Des ennemis brûlent le héros, la Reine des phalènes appelle les Phalénides, et chaque palier ne tire plus que ses propres ennemis : le Beffroi accueille le Novice des cloches, la Sonneuse de matines et le Jaquemart (#38, #180, #171, #182, #172, #189, #213, #217, #214, #223).
- **Bienfaits de palier et Second souffle** : six bienfaits de palier entrent dans l'offre aux paliers 2 et 3 ; quand l'offre a moins de 3 bienfaits, la carte Second souffle rend 10 % des PV (#212, #221).
- **Le Camp** : les Éclats s'y dépensent chez le Gardien de la flamme pour débloquer pour de bon l'Épieu de chasse, la Clochette du guet, Cœur de braise et la Flamberge ; Veillée d'hiver remplace Cœur de braise dans les bienfaits de base (#195, #203, #40, #204).
- **Chaque combattant et chaque palier se reconnaissent d'un coup d'œil** : ennemis, boss et héroïnes avec leur animation complète validée dans l'Atelier, images des objets, boutons de la Tour en pixel art, icônes des bienfaits et des bénédictions, un fond de combat par palier, une ombre au sol à la place des socles, le portrait de chaque combattant dans la Frise d'action et la scène assombrie pendant la phase ennemie (#119, #120, #125, #127, #137, #138, #139, #140, #141, #142, #143, #144, #155, #164, #157, #158, #163, #168, #175, #176, #183, #184, #186, #187, #188, #190).
- **Réglages du combat** : des préparations ennemies plus régulières, une frappe parfaite à 40 ms au plus, des gardes plus solides pour les Élites du palier 2, et un appui jusqu'à 150 ms après un impact déjà subi jugé « trop tard » (#211, #218, #207, #215).
- **Journal d'ascension** (build de preview) : « Exporter le journal » partage le récit des 20 dernières ascensions, combat par combat et appui par appui, pour rééquilibrer la tour (#196, #200, #197, #202).

### Technique

- Maquettes validées des épiques de la tour (#70, #94, #111, #124, #151, #156, #165, #178, #181, #185, #198, #199, #216, #219).
- CI : mode prototype (#85), découpage puis retrait des tests de mutation au profit d'un test de fumée end-to-end, et fin du mode prototype (#133, #135, #146, #148, #150, #192) ; parcours end-to-end des habitudes stabilisés (#86, #98).
- Workflow : story socle, Atelier de l'ascension comme source du game design et deux chemins, fonctionnalité et game design (#97, #110, #122).

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

[0.4.0]: https://github.com/BPotet/ascent/releases/tag/v0.4.0
[0.3.0]: https://github.com/BPotet/ascent/releases/tag/v0.3.0
[0.2.0]: https://github.com/BPotet/ascent/releases/tag/v0.2.0
[0.1.0]: https://github.com/BPotet/ascent/releases/tag/v0.1.0
