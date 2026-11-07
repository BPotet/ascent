# language: fr
Fonctionnalité: Trois paliers jusqu'au sommet, et les premiers Éclats
  Story #38 (chemin B, Atelier de l'ascension du 31/10 au 01/11/2026) : les Jardins de cendre et le
  Beffroi jusqu'au Sommet, le multiplicateur de palier, le Passage de palier, les Éclats et le
  Total d'Éclats, et les 10 entrées recopiées de l'Atelier.

  # Les scénarios `@domain` éprouvent les règles du domaine ; les scénarios `@session` passent par
  # une vraie session d'ascension sur un Stockage clé-valeur en mémoire (« fermée puis rouverte » :
  # une nouvelle session sur le même stockage) ; les scénarios `@ui` passent par l'écran ou par les
  # fonctions de la scène (le canevas Skia est simulé sous Jest).

  Contexte:
    Étant donné que les fiches, images et animations complètes des 10 entrées de cette story sont recopiées de l'export de l'Atelier du 01/11/2026
    Et que l'Initiative d'un ennemi n'est jamais multipliée par le palier

  # --- Passage de palier ---

  @ui
  Scénario: Vaincre le boss du palier 1 ne termine plus l'ascension
    Étant donné un héros qui affronte le boss du palier 1
    Quand le boss tombe
    Alors le joueur gagne 8 Éclats, crédités et sauvegardés avant l'écran du boss vaincu
    Et le héros reçoit son Répit
    Et le Passage de palier rend au héros 30 % de ses PV max
    Et l'écran de transition annonce « Palier 2 » et « Les Jardins de cendre »
    Et l'ascension continue à l'étage 1 du palier 2, sur un combat imposé

  @domain
  Scénario: Le soin du Passage de palier
    Étant donné la Sentinelle à 40 PV sur 80 après son Répit, le boss du palier 1 vaincu
    Quand le Passage de palier a lieu
    Alors elle a 64 PV (40 + 24)

  @domain
  Scénario: Limite — le soin ne dépasse jamais le maximum
    Étant donné la Sentinelle à 75 PV sur 80 après son Répit
    Quand le Passage de palier a lieu
    Alors elle a 80 PV

  @domain
  Scénario: Le héros garde tout d'un palier à l'autre
    Étant donné un héros avec une arme, une armure, un accessoire, 3 bienfaits, 2 bénédictions et de la fatigue
    Quand il passe au palier 2
    Alors il garde ses PV, ses objets, ses bienfaits, ses bénédictions et sa fatigue
    Et son Élan repart à sa valeur de départ au combat suivant, comme à chaque combat

  @session
  Scénario: L'écran de transition est sauvegardé
    Étant donné l'écran de transition vers le palier 3 affiché
    Quand l'application est fermée puis rouverte
    Alors l'ascension reprend sur l'écran de transition vers le palier 3

  # --- Multiplicateur de palier ---

  @domain
  Plan du Scénario: Les ennemis ordinaires sont multipliés, valeur par valeur, à l'entier inférieur
    Étant donné un combat ordinaire au palier <palier>
    Quand le groupe compte un <ennemi>
    Alors il a <pv> PV et <garde> de garde
    Et son coup <coup> fait <dégâts>
    Et son Initiative est celle de sa fiche

    Exemples:
      | palier | ennemi            | pv  | garde | coup                 | dégâts |
      | 2      | Goule             | 67  | 37    | Griffes de fossoyeur | 6      |
      | 2      | Goule             | 67  | 37    | Pelletées            | 4 + 4  |
      | 2      | Pèlerin enronce   | 81  | 50    | Prière d'épines      | 9      |
      | 3      | Spectre           | 61  | 30    | Étreinte glacée      | 15     |
      | 3      | Veilleur d'airain | 113 | 72    | Glas                 | 15     |

  @domain
  Scénario: Le Saignement n'est pas multiplié
    Étant donné un Villageois fou au palier 2
    Quand sa Fourche touche le héros
    Alors elle fait 6 dégâts
    Et le héros saigne de 2 PV pendant 3 manches

  @domain
  Scénario: Ce qui découle des PV et de la garde suit les valeurs du palier
    Étant donné une Ronce de cendre au palier 2 (40 PV), une Glaneuse de cendre (garde 35) et une Goule (67 PV)
    Quand la Ronce tombe pour la première fois
    Alors elle se relève seule avec 12 PV, et peut se relever une seconde fois
    Et quand la Glaneuse garde, son intention montre « +10 »
    Et quand la Glaneuse relève la Goule tombée, la Goule revient avec 33 PV

  @domain
  Scénario: Limite — une Ronce qui s'est relevée seule n'est jamais relevée en plus
    Étant donné une Ronce de cendre qui s'est relevée seule, puis est retombée pour de bon
    Quand la Glaneuse de cendre choisit son intention
    Alors elle ne relève pas la Ronce

  @session
  Scénario: Les Élites et les boss ont leur propre multiplicateur (#244)
    Étant donné l'Épouvantail au palier 2
    Alors il a 228 PV et 70 de garde, et sa Moisson fait 19

  @domain
  Scénario: Limite — le palier 1 ne change pas
    Étant donné un combat ordinaire au palier 1
    Alors chaque ennemi a les valeurs de sa fiche, comme aujourd'hui

  # --- Groupes, Élites et boss ---

  @domain
  Scénario: La taille des groupes aux paliers 2 et 3
    Étant donné une porte Combat au palier 2
    Alors le groupe compte 2, 3 ou 4 ennemis, selon les poids de l'étage
    Et au palier 3, il compte 3 ou 4 ennemis
    Et aucun groupe ne compte 1 ou 5 ennemis aux paliers 2 et 3

  @domain
  Scénario: Les ennemis tirés au palier 2
    Étant donné un groupe tiré au palier 2
    Alors chaque ennemi est un Pèlerin enronce, une Ronce de cendre, une Glaneuse de cendre, un Embrasé (#171) ou une Phalénide (#172), ni Goule ni Villageois fou (#213)
    Et jamais un Spectre, un Nécromancien, un Squelette ou un Veilleur d'airain

  @domain
  Scénario: Les ennemis tirés au palier 3
    Étant donné un groupe tiré au palier 3
    Alors chaque ennemi est un Veilleur d'airain, une Gargouille, un Fondeur de cloches (#171), un Novice des cloches, une Sonneuse de matines ou un Jaquemart (#214), ni Squelette, ni Spectre, ni Nécromancien (#214)
    Et jamais une Goule, un Villageois fou ni un ennemi des Jardins de cendre, Phalénide comprise (#214)

  @domain
  Scénario: Limite — un soutien n'est jamais seul et chaque plafond est respecté
    Étant donné un groupe tiré au palier 2 ou 3
    Alors il compte au plus 1 Pèlerin enronce, 1 Ronce, 1 Glaneuse, 1 Veilleur d'airain, 1 Sonneuse de matines et 1 Jaquemart (#214)
    Et une Glaneuse ou une Sonneuse de matines (#214) est toujours accompagnée

  @domain
  Scénario: Les Élites du palier 3
    Étant donné une porte Élite franchie au palier 3
    Alors l'Élite est le Premier Pèlerin ou le Saint de pierre, tirés à égalité avec la graine de l'ascension

  @domain
  Scénario: Les boss du palier 3
    Quand le joueur atteint l'étage 6 du palier 3
    Alors le boss est le Sonneur des heures ou Celle qui exauce, tirés à égalité avec la graine de l'ascension

  @domain
  Scénario: Le changement de phase à la moitié des PV
    Étant donné la Jardinière des cendres (420 PV, Initiative 4)
    Quand ses PV passent à 210 ou moins
    Alors sa garde revient à son maximum
    Et ses coups Ronces et Mise en terre s'ajoutent, tirés à un quart chacun
    Et son Initiative passe à 7 à partir de la manche suivante
    Et elle prend son aspect de phase 2 (des ronces dans les mains)

  @domain
  Scénario: Limite — les boss du palier 1 changent toujours de phase à 150 PV
    Étant donné la Gardienne des ossuaires (300 PV)
    Quand ses PV passent à 150 ou moins
    Alors elle change de phase, comme aujourd'hui

  # --- Or ---

  @domain
  Scénario: L'Or monte avec le palier
    Étant donné un combat ordinaire gagné au palier 3 contre 3 ennemis
    Alors l'Or gagné vaut entre 16 et 22 ((9 + 2 à 6) × 1,5, entier inférieur)
    Et une Élite rapporte 31 Or au palier 2 et 37 au palier 3
    Et un boss rapporte 50 Or au palier 2 et 60 au palier 3

  # --- Éclats et Sommet ---

  @session
  Scénario: Gagner des Éclats sur une Élite
    Étant donné une Élite de n'importe quel palier
    Quand elle tombe
    Alors le joueur gagne 2 Éclats, crédités et sauvegardés avant l'écran du butin

  @ui
  Plan du Scénario: Gagner des Éclats sur un boss
    Quand le joueur bat le boss du palier <palier>
    Alors il gagne <éclats> Éclats, crédités et sauvegardés avant l'écran du boss vaincu
    Et l'écran du boss vaincu les montre en grand

    Exemples:
      | palier | éclats |
      | 1      | 8      |
      | 2      | 12     |

  @ui
  Scénario: Atteindre le Sommet
    Étant donné le boss du palier 3 vaincu
    Alors le joueur gagne 18 Éclats pour le boss et 10 Éclats pour le Sommet, 28 d'un coup
    Et l'écran « Sommet atteint » s'affiche
    Et l'ascension est terminée, réussie

  @ui
  Scénario: Les Éclats restent après une chute
    Étant donné le joueur a gagné 10 Éclats pendant l'ascension (boss du palier 1 et une Élite)
    Quand le héros tombe au palier 2
    Alors le bilan montre les 10 Éclats dans ce qui reste
    Et le total d'Éclats du joueur a augmenté de 10

  @session
  Scénario: Les Éclats survivent à l'abandon et à la fermeture forcée
    Étant donné le joueur vient de gagner 8 Éclats
    Quand il abandonne l'ascension, ou l'application est fermée de force
    Alors les 8 Éclats sont toujours crédités à la réouverture

  @domain
  Scénario: Les Éclats ne dépendent que de la victoire
    Étant donné deux ascensions avec des jauges, des héros et des bénédictions différents
    Quand chacune bat le boss du palier 2
    Alors chacune rapporte 12 Éclats

  @ui
  Scénario: Les Éclats sont visibles au pied de la tour
    Étant donné le joueur a 22 Éclats
    Quand il ouvre le pied de la tour
    Alors il voit « 22 Éclats »

  @ui
  Scénario: Limite — première ouverture, aucun Éclat
    Étant donné un joueur qui n'a jamais gagné d'Éclat
    Quand il ouvre le pied de la tour
    Alors il voit « 0 Éclat »

  # --- Bienfaits épuisés ---

  @domain
  Scénario: Moins de 3 bienfaits restants
    Étant donné un héros qui possède 5 des 7 bienfaits
    Quand il gagne un combat ordinaire
    Alors l'offre propose les 2 bienfaits restants

  # Depuis #212, la carte Second souffle complète l'offre : l'écran du choix s'affiche toujours.
  @domain
  Scénario: Limite — plus aucun bienfait
    Étant donné un héros qui possède les 7 bienfaits
    Quand il gagne un combat ordinaire
    Alors l'offre montre la carte « Second souffle » seule et l'ascension continue

  # --- Images ---

  @ui
  Scénario: Les poses en plus
    Étant donné une Ronce de cendre ou l'Épouvantail qui se relève seul
    Alors il joue ses poses rise0 puis rise1, avec l'annonce « Il se relève » d'aujourd'hui
    Et quand la Glaneuse de cendre garde, elle joue sa pose guard ; quand elle relève un allié, sa pose raiseAlly

  @ui
  Scénario: Limite — les grandes silhouettes
    Étant donné le Veilleur d'airain (48 × 54) ou le Saint de pierre (48 × 58) en combat
    Alors il s'affiche à sa taille, sans mise à l'échelle, calé en bas de sa case, à 2 dp par pixel d'art
