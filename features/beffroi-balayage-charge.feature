# language: fr
Fonctionnalité: Le Beffroi, le Balayage et la Charge
  Story #266 (épique #246) : au Beffroi, le Battant de cloche, dont le Balayage fait échouer
  l'esquive et se pare, et le Bélier de bronze, qui annonce une Charge sur 2 manches qu'on annule en
  brisant sa garde (voir **Balayage**, **Charge** et **Charge brisée**).

  # Les scénarios `@domain` éprouvent les règles du domaine (le moteur du combat, les paliers). Les
  # scénarios `@ui` passent par ce que l'écran montre et dit (la vue du combat, ses textes). Les
  # scénarios `@session` passent par une vraie session de combat ou d'ascension sur un stockage en
  # mémoire.

  # --- Le Battant de cloche et le Balayage ---

  @domain
  Scénario: Le Battant de cloche est un ennemi ordinaire du Beffroi
    Étant donné un combat ordinaire au palier 3 avec un Battant de cloche
    Alors ses valeurs du Codex sont 46 PV, garde 30 et Initiative 4
    Et au combat il a 80 PV et une garde de 45 (multiplicateur de palier)
    Et ses coups sont le Grand balayage (Balayage de 10) et le Coup de battant (coup simple de 8), dans un rapport de 2 contre 1
    Et maudit, il a 96 PV, une garde de 54, un Grand balayage de 12 et un Coup de battant de 9

  @domain
  Scénario: La parade se juge sur un Balayage comme sur un coup ordinaire
    Étant donné la Sentinelle (réduction des dégâts 10 %) face au Grand balayage de 10 d'un Battant de cloche
    Quand elle pare dans la fenêtre parfaite
    Alors elle ne subit aucun dégât, gagne 1 Élan et contre-attaque
    Quand elle fait une bonne parade sur un autre Balayage
    Alors elle subit 2 dégâts

  @ui
  Scénario: L'esquive échoue sur un Balayage
    Étant donné la Sentinelle face au Grand balayage de 10 d'un Battant de cloche
    Quand elle esquive dans la fenêtre de parade
    Alors l'esquive échoue : elle subit 9 dégâts
    Et elle est en déséquilibre pendant 450 ms
    Et le mot de scène « Balayé » s'affiche, avec le sous-titre « L'esquive échoue · pare le Balayage »

  @domain
  Scénario: Sans appui, le Balayage est un coup reçu
    Étant donné la Sentinelle face au Grand balayage de 10 d'un Battant de cloche
    Quand elle n'appuie pas
    Alors elle subit 9 dégâts, sans déséquilibre

  @domain
  Scénario: Une esquive hors de la fenêtre reste un appui raté
    Étant donné la Sentinelle face à un Balayage
    Quand elle esquive trop tôt ou trop tard
    Alors c'est un appui raté, jugé comme aujourd'hui

  @domain
  Scénario: L'esquive balayée touche le héros
    Étant donné le héros sous un Rempart actif face au Grand balayage de 10
    Quand il esquive dans la fenêtre
    Alors il subit 4 dégâts, le Rempart est usé et sa Riposte part à la fin du coup
    Étant donné le héros avec 2 charges de Brûlure
    Quand il esquive un Balayage dans la fenêtre
    Alors aucune charge de Brûlure ne s'éteint
    Quand il pare parfaitement un Balayage
    Alors une charge de Brûlure s'éteint

  @domain
  Scénario: L'esquive balayée n'est pas une esquive pour l'Errante
    Étant donné l'Errante avec Pas de l'ombre actif face à un Balayage
    Quand elle esquive dans la fenêtre
    Alors elle ne gagne pas d'Élan et ne contre-attaque pas
    Et Pas de l'ombre reste actif

  @ui
  Scénario: Le Balayage se lit pendant sa préparation
    Étant donné un Battant de cloche qui tire un Grand balayage
    Alors son intention reste une Attaque, sans annoncer le Balayage
    Quand sa préparation commence
    Alors le trait de balayage pulse au-dessus de lui et les chevrons filent au sol vers le héros jusqu'à l'impact
    Et le lecteur d'écran annonce « Battant de cloche, balayage, parade »
    Et 150 ms avant l'impact, son reflet est un trait horizontal cyan
    Et ces repères restent à tous les niveaux d'aides visuelles et en mouvement réduit

  @ui
  Scénario: La touche Esquive reste disponible pendant un Balayage
    Étant donné la préparation d'un Balayage
    Alors la touche Esquive n'est ni grisée ni masquée

  # --- Le Bélier de bronze et la Charge ---

  @domain
  Scénario: Le Bélier de bronze est un ennemi ordinaire du Beffroi
    Étant donné un combat ordinaire au palier 3 avec un Bélier de bronze
    Alors ses valeurs du Codex sont 48 PV, garde 26 et Initiative 3
    Et au combat il a 84 PV et une garde de 39
    Et ses coups sont le Coup de front (coup simple de 10) et le Coup de bélier (coup retardé de 21 avec Charge), dans un rapport de 2 contre 1
    Et maudit, il a 100 PV, une garde de 46, un Coup de front de 12 et un Coup de bélier de 25

  @ui
  Scénario: Le Bélier annonce sa Charge
    Étant donné un Bélier de bronze debout, non étourdi, au début de la manche N
    Quand son tirage de coup donne le Coup de bélier
    Alors son intention est la Charge, avec le premier de ses 2 crans allumé
    Et sa marque de signature passe à « Charge 1/2 »
    Et ses 3 tirages de la manche sont consommés

  @ui
  Scénario: À son action, le Bélier charge sans frapper
    Étant donné un Bélier de bronze dont l'intention est la Charge
    Quand vient son action de la manche N
    Alors il charge pendant 400 ms, sans impact et sans défense possible
    Et le mot de scène « Il charge » s'affiche, avec « Pas de coup cette manche · gros coup à la suivante »
    Et le lecteur d'écran annonce « Le Bélier de bronze charge. Gros coup à la manche suivante »

  @ui
  Scénario: À la manche suivante, le Bélier porte son Coup de bélier
    Étant donné un Bélier de bronze qui charge depuis la manche N
    Quand la manche N+1 commence
    Alors il tire ses 3 valeurs comme d'habitude, mais son coup est le Coup de bélier quel que soit le tirage
    Et sa marque de signature passe à « Charge 2/2 », ses 2 crans allumés
    Et à son action, le Coup de bélier est un coup retardé ordinaire, à parer ou à esquiver
    Et après le coup, ses crans se vident et sa marque revient à « Charge »

  @ui
  Scénario: Une cassure de garde pendant la charge brise la Charge
    Étant donné un Bélier de bronze qui charge
    Quand sa garde tombe à 0 avant le début de la préparation de son Coup de bélier
    Alors la Charge est brisée : le Coup de bélier n'a pas lieu et n'est pas reporté
    Et le Bélier est étourdi et perd son action suivante, comme après toute cassure
    Et sa marque de signature passe à « Charge brisée », grisée, glyphe fêlé
    Et le lecteur d'écran annonce « Cassure, Bélier de bronze étourdi : charge brisée, pas de gros coup »

  @domain
  Scénario: Peu importe ce qui brise la garde
    Étant donné un Bélier de bronze qui charge
    Quand sa garde tombe à 0 sous une frappe, une frappe de pouvoir, une contre-attaque ou la Riposte du Rempart, avant la préparation du Coup de bélier
    Alors la Charge est brisée

  @domain
  Scénario: Une cassure dès la manche N, avant son action, l'empêche de charger
    Étant donné un Bélier de bronze dont l'intention de la manche N est la Charge
    Quand sa garde tombe à 0 avant son action de la manche N
    Alors la Charge est brisée et il ne charge pas
    Et il n'y a pas de Coup de bélier à la manche N+1

  @domain
  Scénario: Trop tard, une fois la préparation commencée
    Étant donné un Bélier de bronze dont la préparation du Coup de bélier a commencé
    Quand une contre-attaque ou la Riposte du Rempart brise sa garde après l'impact
    Alors le Coup de bélier a déjà été porté et rien n'est annulé

  @domain
  Scénario: Une Charge brisée repart de zéro
    Étant donné un Bélier de bronze dont la Charge a été brisée
    Quand il fait son retour en garde
    Alors il tire de nouveau librement son coup
    Et une nouvelle Charge recommence à « Charge 1/2 »

  @domain
  Scénario: Un Bélier étourdi au début de la manche ne charge pas
    Étant donné un Bélier de bronze étourdi au début de la manche
    Alors il n'agit pas de la manche et ne commence aucune Charge
    Et ses 3 tirages sont quand même consommés

  @session
  Scénario: La Charge est sauvegardée avec le combat
    Étant donné un Bélier de bronze qui charge à la fin de la manche N
    Quand le joueur quitte l'application puis reprend le combat
    Alors le Bélier charge toujours et porte son Coup de bélier à la manche N+1

  @domain
  Scénario: Un Bélier qui tombe pendant sa charge ne frappe pas
    Étant donné un Bélier de bronze qui charge
    Quand ses PV tombent à 0
    Alors il tombe et aucun Coup de bélier n'est porté

  # --- Rencontre, tirage, escorte ---

  @session
  Scénario: Première rencontre du Battant de cloche et du Bélier de bronze
    Étant donné un joueur qui n'a jamais rencontré le Battant de cloche
    Quand un combat avec un Battant de cloche commence
    Alors la bulle de première rencontre « Battant de cloche » s'affiche, sans rien bloquer
    Et le premier toucher la ferme
    Et elle ne revient plus dans les combats suivants
    Et il en va de même pour le Bélier de bronze avec sa propre bulle

  @domain
  Scénario: Les nouveaux ennemis entrent dans les groupes du Beffroi
    Étant donné le palier 3
    Alors un groupe d'ennemis est tiré parmi le Veilleur d'airain, la Gargouille, le Fondeur de cloches, le Novice des cloches, la Sonneuse de matines, le Jaquemart, le Bélier de bronze et le Battant de cloche, dans cet ordre
    Et le Bélier de bronze et le Battant de cloche ont chacun un poids de tirage de 2 et au plus 1 par groupe
    Et l'escorte d'une Élite du Beffroi peut les tirer, au multiplicateur de palier
    Et ils ne sont tirés dans aucun autre palier

  @domain
  Scénario: Les autres paliers ne changent pas
    Étant donné une ascension aux Catacombes ou aux Jardins de cendre
    Alors ses groupes d'ennemis, ses escortes et ses marches figées du palier 1 sont identiques à ceux d'avant cette story
