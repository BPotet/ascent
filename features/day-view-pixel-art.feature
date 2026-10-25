# language: fr
# Story #72 (épique #71) : les scénarios de la story, tels quels. Les scénarios du ciel du jour
# (@use-cases) passent par les cas d'usage ; les autres (@ui), par les écrans.
Fonctionnalité: La Journée en pixel art

  Contexte:
    Étant donné nous sommes le mercredi 21 octobre
    Et le joueur a 5 habitudes actives, dont 2 « fait » aujourd'hui

  # --- Identité pixel art ---

  @ui
  Scénario: L'identité pixel art habille la Vue Journée
    Quand le joueur ouvre l'app
    Alors la Vue Journée s'affiche dans l'identité pixel art : palette d'art, cadres crantés, boutons, cases et icônes en pixels
    Et le titre « Aujourd'hui » et le compteur « 2/5 faites » sont dans la police pixel, à 18 px au moins
    Et les noms d'habitude, les états écrits et les messages sont dans la police de texte
    Et chaque sprite est affiché à une échelle entière du pixel d'art, sans lissage

  @ui
  Scénario: La police pixel ne porte jamais une phrase
    Quand la Vue Journée affiche un texte à lire (nom d'habitude, aide, message d'erreur, libellé d'onglet ou de bouton)
    Alors ce texte est dans la police de texte

  @ui
  Scénario: Le texte suit la taille de texte du téléphone (limite)
    Étant donné la taille du texte du téléphone est réglée à 200 %
    Quand le joueur ouvre la Vue Journée
    Alors tous les textes grossissent, police pixel comprise
    Et un titre en police pixel passe à la ligne au lieu de rétrécir ou d'être coupé
    Et aucun sprite n'est agrandi de façon fractionnaire

  # --- En-tête du personnage et barre d'onglets ---

  @ui
  Scénario: L'en-tête du personnage
    Étant donné le personnage a 340 XP
    Quand le joueur ouvre n'importe quelle vue (Journée, Semaine ou Mois)
    Alors l'en-tête montre le personnage en pixels, devant le ciel du jour et la tour au loin
    Et il affiche « Expérience du personnage » et le total « 340 XP »
    Et il n'affiche ni niveau, ni jauge d'expérience
    Et le lecteur d'écran ignore le personnage, le ciel et la tour, et lit l'expérience

  @use-cases
  Scénario: Le ciel du jour s'éclaire avec les habitudes faites
    Étant donné 2 habitudes faites sur 5 habitudes attendues aujourd'hui
    Quand le joueur marque une troisième habitude « fait »
    Alors le ciel du jour s'éclaire d'un cran
    Quand toutes les habitudes attendues sont faites
    Alors le soleil se lève derrière la tour

  @use-cases
  Scénario: Le ciel du jour sans habitude (limite)
    Étant donné le joueur n'a aucune habitude
    Alors le ciel du jour est un ciel de nuit

  @ui
  Scénario: La barre d'onglets en pixel art
    Quand le joueur regarde la barre d'onglets
    Alors elle montre les onglets Journée, Semaine et Mois, avec leurs icônes 24 dp et leurs libellés en police de texte
    Et l'onglet de la vue affichée a un fond, un trait et un libellé en gras, pas seulement une couleur
    Et chaque onglet fait au moins 48 dp de haut

  # --- Vue Journée dans tous ses états ---

  @ui
  Scénario: Une ligne d'habitude
    Quand le joueur regarde la ligne « Cuisiner », à faire, Moyenne, objectif hebdomadaire 5, 2 « fait » cette semaine
    Alors la ligne montre la case à cadre d'or, le nom, l'état écrit « À faire », l'icône de difficulté à 2 sommets avec « Moyenne », les crans de la semaine et le texte « 2/5 cette semaine »
    Et la ligne fait au moins 48 dp de haut, le bouton « ⋯ » 48 × 48 dp
    Et le lecteur d'écran lit la même annonce qu'avant cette story

  @ui
  Scénario: Chargement
    Quand la Vue Journée charge les habitudes
    Alors l'en-tête s'affiche tout de suite et un squelette au pixel d'art réserve la place des lignes et du compteur

  @ui
  Scénario: Vide, première utilisation
    Étant donné le joueur n'a aucune habitude
    Quand il ouvre la Vue Journée
    Alors le personnage l'attend à ×3 sous un ciel de nuit, avec le seul bouton « Ajouter une habitude »

  @ui
  Scénario: Aide au premier usage
    Étant donné le joueur vient de créer sa première habitude
    Alors l'aide au premier usage s'affiche dans un cadre cranté, en police de texte
    Et elle disparaît pour toujours au premier suivi, comme aujourd'hui

  @ui
  Scénario: Toutes faites
    Étant donné toutes les habitudes attendues aujourd'hui sont « fait »
    Alors « Toutes faites » s'affiche en police pixel

  @ui
  Scénario: Objectifs de la semaine atteints
    Étant donné aucune habitude n'est attendue aujourd'hui
    Alors « Objectifs de la semaine atteints » remplace le compteur, comme aujourd'hui
    Et les lignes restent tapables

  @ui
  Scénario: Rappel d'hier
    Étant donné hier compte une habitude attendue « pas fait »
    Alors le rappel d'hier « Hier : 1/2 faites » s'affiche en haut, en pixel art, avec « Corriger »

  @ui
  Scénario: Erreur de lecture
    Étant donné les habitudes ne peuvent pas être lues
    Quand le joueur ouvre la Vue Journée
    Alors un emblème d'alerte, le message en police de texte et « Réessayer » s'affichent

  # --- Retours de jeu ---

  @ui
  Scénario: Habitude faite et expérience gagnée
    Étant donné « Cuisiner » est « à faire », difficulté Moyenne
    Quand le joueur tape « Cuisiner »
    Alors la case passe au vert avec sa coche, la coche rebondit d'un pixel d'art et une étincelle éclate
    Et une légère vibration se produit
    Et « +10 XP » s'envole au-dessus de la case, la pastille « +10 XP » apparaît près de l'expérience
    Et l'expérience de l'en-tête passe de « 340 XP » à « 350 XP » et le compteur passe à « 3/5 faites »
    Et le lecteur d'écran annonce « plus 10 XP »

  @ui
  Scénario: Objectif atteint
    Étant donné « Courir 5 km » a 2 « fait » cette semaine pour un objectif de la semaine de 3
    Quand le joueur tape « Courir 5 km »
    Alors les crans de la semaine passent à l'or et le badge « Objectif atteint » s'allume
    Et le message « Objectif de la semaine atteint » et la pastille de la prime d'objectif s'affichent
    Et une seconde vibration se produit
    Et le lecteur d'écran annonce « Objectif de la semaine atteint », avec la prime

  @ui
  Scénario: Retour en arrière
    Étant donné « Cuisiner » est « fait »
    Quand le joueur tape de nouveau « Cuisiner »
    Alors « −10 XP » s'affiche en gris, sans étincelle, sans vibration et sans rouge
    Et la case revient au cadre d'or « à faire »

  @ui
  Scénario: Erreur d'enregistrement d'un suivi
    Étant donné l'enregistrement d'un suivi échoue
    Quand le joueur tape « Cuisiner »
    Alors la case, l'expérience et les crans reviennent comme avant
    Et le message « Le suivi n’a pas été enregistré. » propose « Réessayer »
    Et aucune prime ne s'affiche

  # --- Mouvement réduit ---

  @ui
  Scénario: Mouvement réduit
    Étant donné le réglage « mouvement réduit » du téléphone est activé
    Quand le joueur marque une habitude « fait » qui atteint son objectif
    Alors aucun envol, étincelle, rebond, rayon ni particule ne s'affiche
    Et les états finaux s'affichent tout de suite : case verte, pastille « +XP », expérience à jour, badge et message
    Et les vibrations et les annonces au lecteur d'écran restent
    Et le squelette de chargement ne clignote pas

  # --- Démarrage ---

  @ui
  Scénario: Démarrage
    Quand le joueur ouvre l'app
    Alors l'écran de démarrage montre la tour dans la nuit, le titre en police pixel et trois carrés qui s'allument tour à tour
    Et en mouvement réduit les carrés sont fixes

  @ui
  Scénario: Erreur au démarrage
    Étant donné les données ne peuvent pas s'ouvrir au démarrage
    Alors l'écran de démarrage affiche le libellé d'erreur actuel en police de texte et « Réessayer »

  # --- Le suivi ne change pas ---

  @ui
  Scénario: Le fonctionnement du suivi ne change pas
    Quand le joueur marque, défait ou recharge ses habitudes dans la Vue Journée
    Alors l'expérience, la progression de la semaine, l'objectif atteint et les compteurs suivent exactement les règles actuelles
