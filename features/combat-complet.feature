# language: fr
Fonctionnalité: Combat complet
  Story #32, partie A (règles et interface) : la Sentinelle choisit sa cible, brise la garde des
  ennemis pour les étourdir, frappe en rythme, dépense son Élan dans le Rempart, et lit les
  intentions des ennemis par leur catégorie.

  # Les scénarios sans tag passent par la session de combat (cas d'usage), avec l'horloge de
  # combat manuelle et une graine du combat fixée : leurs instants sont exacts à la milliseconde.
  # Les scénarios `@ui` passent par l'écran du combat d'essai, sur la même session. La scène reste
  # dessinée comme aujourd'hui (#81 la dessine en pixel art) : ses états se vérifient sur ce que
  # l'écran lui passe.

  Contexte:
    Étant donné un combat de la Sentinelle (Attaque 10, Brise-garde 12) contre un groupe de la Goule (50 PV, garde 15), du Spectre (35 PV, garde 10) et du Nécromancien (45 PV, garde 12)
    Et l'ordre d'action du #31 : la Sentinelle, puis les ennemis debout de gauche à droite

  # Frappe en rythme et frappe parfaite (C6)

  @ui
  Scénario: Frappe parfaite (C6)
    Étant donné la Sentinelle attaque la Goule
    Quand le joueur touche « Frapper » 40 ms après l'impact de la frappe (préparation de 700 ms)
    Alors la Goule perd 15 PV et 18 points de garde (×1,5)
    Et l'arrêt sur image de 90 ms et le libellé « Frappe parfaite » accompagnent la frappe
    Et le mot « Critique » n'apparaît jamais

  Scénario: Bonne frappe (C6)
    Quand le joueur touche « Frapper » 120 ms avant l'impact
    Alors la Goule perd 12 PV et 14 points de garde (×1,2, arrondis à l'inférieur)

  Scénario: Sans appui, la frappe ne pénalise jamais (C6)
    Quand le joueur ne touche pas « Frapper »
    Alors la Goule perd 10 PV et 12 points de garde
    Et la Sentinelle n'est pas déséquilibrée

  Scénario: Seul le premier appui compte (C6)
    Quand le joueur touche « Frapper » 300 ms avant l'impact puis pile à l'impact
    Alors la frappe est jugée sur le premier appui, sans bonus

  Scénario: Pas de critique au hasard (C6.3)
    Étant donné deux combats avec des graines différentes
    Quand le joueur frappe la Goule debout avec le même écart de 40 ms
    Alors la Goule perd 15 PV dans les deux combats

  Scénario: La transition de phase part de la fin de la frappe en rythme (C6, C12)
    Étant donné la Sentinelle attaque la Goule
    Quand le joueur touche « Frapper » 150 ms après l'impact
    Alors l'appui est jugé « bon » et n'est pas ignoré
    Et la transition de phase vers la phase ennemie ne commence qu'à la fin de la fenêtre de la frappe (impact + 160 ms) et de son animation

  Scénario: Un pouvoir mène aussi à la transition de phase (C3, C12)
    Étant donné la Sentinelle utilise le pouvoir Rempart
    Quand son effet est résolu, animation comprise
    Alors la transition de phase de 800 ms vers la phase ennemie commence

  # Garde et étourdissement (C5)

  @ui
  Scénario: Cassure de garde : le Spectre est étourdi (C5)
    Étant donné la garde du Spectre est à 8
    Quand la Sentinelle lui inflige 12 points de garde
    Alors la garde du Spectre est à 0 et il est étourdi
    Et « Cassure » s'affiche, avec l'arrêt sur image, la vibration et le son de cassure
    Et le Spectre est à terre, avec les étoiles d'étourdissement, et « Étourdi ×1,5 » s'affiche sous lui

  @ui
  Scénario: Cassure par le héros : action perdue, puis retour en garde (C5.3 à C5.7)
    Étant donné la Sentinelle brise la garde de la Goule pendant sa phase de la manche 3
    Quand vient l'action de la Goule dans la phase ennemie de la manche 3
    Alors la Goule reste à terre et n'agit pas, pendant 250 ms
    Et elle ne passe pas au premier plan, ne fait pas d'avancée et les autres ennemis ne sont pas estompés
    Et le lecteur d'écran annonce « Goule, étourdie, n'agit pas »
    Quand la phase du héros de la manche 4 commence
    Alors la Goule n'affiche aucune intention
    Quand la Sentinelle frappe la Goule sans appui
    Alors la Goule perd 15 PV (10 × 1,5) et aucun point de garde
    Et à la fin de l'action de la Sentinelle, la Goule se relève en 400 ms et sa garde revient à 15
    Et son intention de la manche 4 s'affiche
    Et elle agit normalement dans la phase ennemie de la manche 4

  @ui
  Scénario: La contre-attaque peut briser la garde (C8)
    Étant donné la garde de la Goule est à 10
    Quand le joueur pare parfaitement un coup de la Goule
    Alors la contre-attaque inflige 12 points de garde (100 % du Brise-garde) et la Goule est étourdie
    Et « Cassure » s'affiche, seul mot du résultat pendant la phase ennemie
    Et « Étourdie ×1,5 » s'affiche sous la Goule
    Et le lecteur d'écran annonce « Cassure, Goule étourdie »

  @ui
  Scénario: Cassure par une contre-attaque : le retour en garde remplace l'action perdue (C5.5, C5.6)
    Étant donné la garde de la Goule est à 10
    Et le joueur pare parfaitement son coup pendant la phase ennemie de la manche 3, et la contre-attaque la brise
    Quand la phase du héros de la manche 4 commence
    Alors l'intention de la Goule est un cercle barré
    Quand la Sentinelle utilise Rempart
    Et vient l'action de la Goule dans la phase ennemie de la manche 4
    Alors la Goule se relève en 400 ms, sans avancée ni attaque, et sa garde revient à 15
    Et sa garde n'est jamais restaurée avant ce moment
    Et à la manche 5, la Goule agit normalement

  Scénario: L'action du héros compte même s'il vise un autre ennemi (C5.3)
    Étant donné la Goule est étourdie et a déjà perdu son action
    Quand la Sentinelle attaque le Spectre
    Alors à la fin de cette action, la Goule fait son retour en garde

  @ui
  Scénario: Tous les ennemis étourdis (C5.4, C12)
    Étant donné la Goule, le Spectre et le Nécromancien sont étourdis et n'ont pas encore perdu leur action
    Quand la Sentinelle termine son action
    Alors les trois actions perdues s'enchaînent, 250 ms chacune
    Et il n'y a ni transition de phase de 800 ms, ni annonce « Phase ennemie »
    Et la phase du héros suivante commence avec l'annonce « À toi »

  Scénario: Un ennemi étourdi ne se brise pas deux fois (C5.8)
    Étant donné la Goule est étourdie
    Quand la Sentinelle la frappe
    Alors aucune garde n'est retirée et aucune « Cassure » n'est annoncée

  Scénario: Un ennemi étourdi qui tombe (C5.9)
    Étant donné la Goule est étourdie et a 10 PV
    Quand la Sentinelle la frappe sans appui
    Alors la Goule tombe, et ni étoiles ni retour en garde ne restent

  Scénario: Frappe parfaite sur un ennemi étourdi (C5.2, C6.5)
    Étant donné la Goule est étourdie
    Quand le joueur frappe parfaitement
    Alors la Goule perd 22 PV (10 × 1,5 × 1,5, entier inférieur) et aucun point de garde

  @ui
  Scénario: La garde remonte par l'intention Garde ou au retour en garde (C2, C5)
    Étant donné la garde du Nécromancien est à 4
    Et son intention est Garde, affichée par un bouclier et « +3 », sans mot
    Quand il exécute l'intention Garde
    Alors sa garde remonte de 3 points (30 % de 12)
    Et sans cette intention, sa garde ne remonte jamais d'elle-même
    Et sa garde remonte aussi à son maximum à son retour en garde, après un étourdissement

  # Intentions (C1, C2) — décision du propriétaire du 25/10/2026

  @ui
  Scénario: L'intention Garde affiche son gain (C2.2)
    Étant donné le Nécromancien (garde max 12) a tiré l'intention Garde
    Alors son intention affiche un bouclier et « +3 » (30 % de 12, entier inférieur), sans mot
    Et le lecteur d'écran lit « Nécromancien, intention : garde, plus 3 »

  @ui
  Scénario: Une intention d'attaque n'affiche jamais de nombre (C2.2, C2.3)
    Étant donné la Goule a tiré une double frappe de 3 + 3
    Alors son intention affiche une lame seule, sans « 6 », sans « 3 + 3 » et sans type de coup
    Et le lecteur d'écran lit « Goule, intention : attaque », sans nombre

  @ui
  Scénario: L'intention d'attaque n'affiche que sa catégorie (C2.2, C2.3)
    Étant donné la Goule a tiré un coup simple de 5 dégâts
    Alors son intention affiche une lame seule, sans mot ni nombre, pour tout héros et avec ou sans Rempart
    Et le lecteur d'écran lit « Goule, intention : attaque »
    Quand la Goule commence sa préparation
    Alors le lecteur d'écran annonce « Goule, coup simple »
    Quand le joueur ne touche rien
    Alors la Sentinelle perd 4 PV (5 × 0,9, entier inférieur)

  @ui
  Scénario: Relever un allié tombé (C2)
    Étant donné la Goule est tombée
    Et l'intention du Nécromancien est Relever, affichée par une flèche vers le haut, sans mot ni nombre
    Et le lecteur d'écran lit « Nécromancien, intention : relever un allié »
    Quand la phase ennemie se déroule
    Alors la Goule revient avec 25 PV (50 %), garde pleine, non étourdie
    Et elle n'agit qu'à partir de la manche suivante
    Et jusqu'à la fin de la manche, son intention s'affiche en cercle barré

  Scénario: Un ennemi tombé n'agit pas (C1)
    Étant donné le Spectre est tombé
    Quand la phase ennemie se déroule
    Alors le Spectre n'agit pas

  # Élan, pouvoir et répit (C3, C11)

  Scénario: Élan et pouvoir (C3)
    Étant donné le combat commence
    Alors l'Élan de la Sentinelle vaut 1
    Quand elle attaque
    Alors son Élan vaut 2
    Quand elle utilise le pouvoir Rempart (1 Élan)
    Alors son Élan vaut 1 et le prochain coup qu'elle subit fait 50 % de dégâts en moins

  Scénario: Élan plafonné (C3)
    Étant donné l'Élan de la Sentinelle vaut 5
    Quand elle réussit une parade parfaite
    Alors son Élan reste à 5

  @ui
  Scénario: Pouvoir trop cher (C3)
    Étant donné l'Élan de la Sentinelle vaut 0
    Alors le pouvoir Rempart (1 Élan) est visible mais indisponible, et dit qu'il manque 1 Élan

  Scénario: Répit après la victoire (C11)
    Étant donné la Sentinelle a 50 PV sur 80
    Quand le dernier ennemi tombe
    Alors le combat est gagné et la Sentinelle remonte à 58 PV (+10 % de ses PV max)
