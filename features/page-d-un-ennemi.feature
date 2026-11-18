# language: fr
Fonctionnalité: La page d'un ennemi
  Story #283 (épique #278) : depuis le Bestiaire, la page d'un ennemi, sa silhouette et son nom quand
  il est seulement rencontré, puis son image, son histoire, ses mécaniques et ses coups, dits en mots
  de joueur, une fois vaincu, avec la page qui se colore la première fois (ADR 0032).

  # Les scénarios `@domain` éprouvent les règles du domaine (la page d'un ennemi, ses mécaniques tirées
  # de sa fiche) et le contenu des pages ; les scénarios `@session` passent par de vraies sessions du
  # carnet sur un Stockage clé-valeur en mémoire (« fermeture de l'app » : une nouvelle session sur le
  # même stockage) ; les scénarios `@ui` passent aussi par les vrais écrans (le carnet, la page).

  @ui
  Scénario: Une entrée vaincue ouvre sa page remplie
    Étant donné le Fossoyeur vaincu
    Quand le joueur touche son entrée dans le Bestiaire
    Alors sa page s'ouvre sur un écran poussé
    Et elle montre, dans l'ordre, son image de combat sur le fond de son palier, son nom, sa catégorie Élite, son palier, son histoire du Codex, ses mécaniques, puis ses coups
    Et chaque coup a son nom, son type de coup et sa description

  @ui
  Scénario: Une entrée rencontrée ouvre sa page cachée
    Étant donné la Mère-ronce rencontrée, pas encore vaincue
    Quand le joueur touche son entrée
    Alors sa page montre sa silhouette, son nom, sa catégorie et son palier
    Et son histoire, ses mécaniques et ses coups restent cachés
    Et la page cachée le dit en une phrase

  @ui
  Scénario: Une entrée « ??? » ne s'ouvre pas
    Étant donné une entrée « ??? »
    Quand le joueur la touche
    Alors aucune page ne s'ouvre

  @ui
  Scénario: Le retour revient au même endroit du Bestiaire
    Étant donné la page de l'Embrasé ouverte depuis le palier 2, défilé jusqu'aux Élites
    Quand le joueur revient en arrière
    Alors le Bestiaire est au palier 2, au même défilement
    Et le focus du lecteur d'écran revient sur l'entrée de l'Embrasé

  @ui
  Scénario: La page se colore la première fois qu'on l'ouvre vaincu
    Étant donné l'Embrasé vaincu dont la page n'a jamais été vue remplie
    Quand le joueur ouvre sa page
    Alors ses couleurs remplacent la silhouette de bas en haut, puis « Page remplie » s'affiche
    Et le lecteur d'écran annonce poliment « Page remplie : Embrasé. »

  @session
  Scénario: « Page remplie » ne joue qu'une fois par ennemi
    Étant donné la page de l'Embrasé déjà vue remplie
    Quand le joueur la rouvre, dans la même visite du carnet, après avoir fermé l'app ou après avoir de nouveau vaincu un Embrasé
    Alors la page s'affiche remplie, sans animation ni « Page remplie »

  @session
  Scénario: Un ennemi vu caché puis vaincu joue « Page remplie » à la première ouverture après sa victoire
    Étant donné la page cachée de la Mère-ronce déjà ouverte
    Quand la Mère-ronce est vaincue dans une ascension suivante, puis que le joueur ouvre sa page
    Alors la page se colore et « Page remplie » s'affiche

  @ui
  Scénario: Mouvement réduit
    Étant donné le mouvement réduit activé
    Quand une page s'ouvre remplie pour la première fois
    Alors elle passe en fondu, sans glisser, avec les mêmes durées

  @ui
  Scénario: Un boss montre ses deux phases
    Étant donné la Reine des phalènes vaincue
    Quand le joueur ouvre sa page
    Alors ses coups vont par phase : la phase 1, puis ce que la phase 2 ajoute avec sa description de phase
    Et son Invocation est dite parmi ses mécaniques
    Et son portrait de phase 2 est montré quand il existe

  @ui
  Scénario: La page cachée d'un boss montre la silhouette de sa phase 1
    Étant donné un boss rencontré en phase 2, pas vaincu
    Quand le joueur ouvre sa page
    Alors la silhouette est celle de sa phase 1

  @ui
  Scénario: Aucun chiffre de jeu sur la page d'un ennemi
    Étant donné la page remplie de n'importe quel ennemi du jeu
    Alors elle ne montre ni PV, ni garde, ni dégâts, ni Initiative, ni poids ou plafond de tirage, ni durée
    Et une mécanique qui donne plus de dégâts le dit sans nombre : « frappe plus fort pour chaque autre Rat de crypte debout »
    Mais les libellés de combat que le joueur voit en combat restent tels quels, même avec un nombre : « Aura +20 % », « Braises 2 »

  @domain
  Scénario: Les mécaniques sont celles de la fiche, et seulement elles
    Étant donné un Squelette vaincu
    Alors sa page dit « Se relève seul » parmi ses mécaniques
    Étant donné un Embrasé vaincu en étant maudit
    Alors sa page ne dit rien de « maudit »

  @domain
  Scénario: Chaque ennemi du jeu a sa page
    Étant donné la version installée
    Alors chacun des 37 ennemis du jeu a une page avec son image, son histoire, ses mécaniques et ses coups
    Et ils se répartissent en 12 entrées au palier 1, 12 au palier 2 et 13 au palier 3, les 6 ennemis de #246 compris
    Et chacun des ennemis de #246 déjà dans le jeu a la sienne
