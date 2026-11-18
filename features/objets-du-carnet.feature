# language: fr
Fonctionnalité: Les Objets du carnet
  Story #284 (épique #278) : l'onglet « Objets » du carnet de découvertes, où chaque objet du jeu
  passe de « ??? » à découvert la première fois qu'il est montré comme objet trouvé, avec « Nouveau
  au carnet » à ce moment-là (ADR 0031).

  # Les scénarios `@domain` éprouvent les règles du domaine (l'objet découvert par une transition de
  # l'ascension, le carnet) ; les scénarios `@session` passent par une vraie session d'ascension et une
  # vraie session du carnet sur un Stockage clé-valeur en mémoire (« fermeture forcée » : de nouvelles
  # sessions sur le même stockage) ; les scénarios `@ui` passent aussi par les vrais écrans (le carnet,
  # l'ascension, le Pied de la tour) et une vraie session du camp.

  @ui
  Scénario: L'onglet Objets liste les objets du jeu
    Étant donné le carnet ouvert
    Alors il a deux onglets, « Bestiaire » et « Objets », chacun avec son compteur
    Quand le joueur touche « Objets »
    Alors les 11 objets du jeu sont listés par emplacement (Armes, Armures, Accessoires), dans l'ordre de rareté
    Et l'équipement de base des héros n'y figure pas

  @session
  Scénario: Un objet montré puis équipé est découvert
    Étant donné l'Amulette de Hâte inconnue
    Quand elle est montrée sur « Objet trouvé » et que le joueur l'équipe
    Alors elle est découverte

  @session
  Scénario: Un objet montré puis laissé est découvert
    Étant donné l'Amulette de Hâte inconnue
    Quand elle est montrée sur « Objet trouvé » et que le joueur la laisse
    Alors elle est découverte

  @ui
  Scénario: « Nouveau au carnet » sur un objet jamais vu
    Étant donné l'Amulette de Hâte inconnue
    Quand elle est montrée sur « Objet trouvé »
    Alors « Nouveau au carnet » s'affiche au-dessus de la ligne de l'objet
    Et le lecteur d'écran le lit avant le nom de l'objet

  @ui
  Scénario: « Nouveau au carnet » ne se dit qu'une fois par objet
    Étant donné l'Amulette de Hâte déjà découverte
    Quand elle est de nouveau montrée sur « Objet trouvé », dans cette ascension ou une autre
    Alors « Nouveau au carnet » ne s'affiche pas

  @session
  Scénario: Les objets d'une Élite et d'un Coffre scellé ouvert sont découverts
    Étant donné une Élite gagnée
    Quand son objet garanti est montré
    Alors il est découvert
    Quand le joueur ouvre le Coffre scellé avec une Clé et qu'il révèle un Marteau
    Alors le Marteau est découvert

  @session
  Scénario: Un Coffre scellé laissé ou fermé ne découvre rien
    Étant donné un Coffre scellé après une Élite
    Quand le joueur le laisse, ou qu'il reste fermé faute de Clé
    Alors aucun objet n'est découvert

  @domain
  Scénario: Le boss et le Feu de camp ne découvrent rien
    Étant donné une victoire sur un boss, ou un Feu de camp
    Alors aucun objet n'est découvert

  @domain
  Scénario: L'annonce de la porte Élite ne découvre rien
    Étant donné une porte Élite qui annonce un objet Rare garanti
    Alors aucun objet n'est découvert avant qu'il soit montré

  @ui
  Scénario: Un objet à débloquer pas encore acheté le dit
    Étant donné la Flamberge inconnue et pas achetée au Camp
    Alors son entrée est « ??? » et dit « Se débloque au camp »

  @ui
  Scénario: Acheter un déblocage ne découvre pas l'objet
    Étant donné la Flamberge achetée au Camp et jamais trouvée
    Alors son entrée est « ??? » et dit « Pas encore trouvé »

  @session
  Scénario: Un objet trouvé en attente à la reprise est découvert
    Étant donné une ascension en cours à la mise à jour, avec un objet trouvé en attente et des objets portés
    Quand l'ascension reprend
    Alors l'objet trouvé en attente et les objets portés sont découverts, sans doublon

  @ui
  Scénario: Les compteurs des Objets
    Étant donné 4 objets découverts sur 11
    Alors l'onglet « Objets » compte « 4/11 »
    Et les compteurs donnent le total, puis par rareté (Commun, Rare, Épique) et par emplacement
    Et les objets à débloquer comptent au total, achetés ou non

  @ui
  Scénario: Un objet découvert porte « nouveau » et compte à « Le carnet »
    Étant donné l'Amulette de Hâte découverte depuis la dernière sortie du carnet
    Alors la touche « Le carnet » compte cette entrée avec celles du Bestiaire
    Et dans l'onglet « Objets », l'Amulette porte « nouveau » jusqu'à la sortie du carnet

  @ui
  Scénario: La fiche d'un objet découvert
    Étant donné l'Amulette de Hâte découverte
    Quand le joueur touche sa ligne
    Alors une feuille s'ouvre avec son image, son nom, sa rareté, son effet et sa description
    Et « Fermer » ou un glissement vers le bas la ferme
    Et chacun des 11 objets du jeu a sa description sur sa fiche

  @ui
  Scénario: Une ligne « ??? » ne s'ouvre pas
    Étant donné un objet inconnu
    Quand le joueur touche sa ligne
    Alors aucune feuille ne s'ouvre

  @ui
  Scénario: Première utilisation de l'onglet Objets
    Étant donné aucun objet découvert
    Alors tous les objets sont « ??? » avec leur emplacement, sous un bandeau d'une phrase
    Et les objets à débloquer pas encore achetés disent déjà « Se débloque au camp »

  @ui
  Scénario: Un objet ajouté par une mise à jour arrive en « ??? », sans « nouveau »
    Étant donné une mise à jour qui ajoute un objet au jeu
    Quand le joueur ouvre l'onglet « Objets »
    Alors cet objet est « ??? », sans marque « nouveau », et le total grandit de 1
