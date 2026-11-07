# language: fr
Fonctionnalité: Le décor du palier derrière le pied de la tour
  Story #233 (épique #208, maquette v3 section 6 : D0 à D3, J1, J2, T1) : le pied de la tour se pose
  sur le fond de palier où l'ascension commence, ou se trouve. Habillage seulement : aucune règle de
  jeu ne change.

  # Les scénarios passent par le vrai écran du pied de la tour, sur une vraie session d'ascension et
  # un Stockage clé-valeur en mémoire. Le canevas Skia du décor est simulé sous Jest : la simulation
  # expose son palier et le bas de l'en-tête qu'elle reçoit.

  Scénario: Le décor du palier de départ avant l'ascension (D1, J1, J2)
    Étant donné aucune ascension n'est en cours
    Quand le joueur ouvre l'onglet Tour
    Alors le pied de la tour s'affiche sur le fond du palier 1, les Catacombes (« le puits des ossements »), le même que ses combats
    Et l'image est remplie en hauteur, centrée, ses côtés rognés, comme à l'écran de combat
    Et les cadres, les libellés et les boutons du pied de la tour sont ceux d'aujourd'hui

  Scénario: Le décor ne dépend pas de la jauge (D3)
    Étant donné aucune ascension n'est en cours
    Quand la jauge du jour vaut +2, 0 ou −2
    Alors le pied de la tour montre le même fond du palier 1, sous le même voile

  Scénario: Le décor du palier en cours pendant une ascension (D2, T1)
    Étant donné une ascension en cours au palier 2
    Quand le joueur ouvre l'onglet Tour
    Alors le pied de la tour s'affiche sur le fond des Jardins de cendre (« sous le jardin suspendu »)
    Et au palier 3, sur celui du Beffroi (« la cloche tombée »)
    Et au palier 1, sur celui des Catacombes

  Scénario: Le décor revient au palier de départ à la fin de l'ascension
    Étant donné une ascension au palier 3
    Quand elle se termine, par une chute, un abandon ou le Sommet
    Alors le pied de la tour s'affiche de nouveau sur le fond du palier 1

  Scénario: Le voile garde chaque texte lisible
    Quand le pied de la tour s'affiche sur un fond de palier, quel qu'il soit
    Alors un voile de la nuit couvre le haut de l'écran, sous la barre d'état, le titre « La tour », les Éclats et la ligne du palier, puis s'allège vers le bas
    Et chaque texte posé sur le décor garde un contraste d'au moins 4,5:1 au pire pixel
    Et la jauge, le cadre de l'ascension en cours, « Commencer l'ascension », « Le camp » et la barre d'onglets gardent leur fond plein et leurs contrastes d'aujourd'hui

  Scénario: Le décor est immobile, même en mouvement réduit
    Étant donné le mouvement réduit est activé, ou non
    Quand le pied de la tour s'affiche
    Alors le décor ne défile pas et ne s'anime pas

  Scénario: Le décor est ignoré par le lecteur d'écran et ne se touche pas
    Quand le pied de la tour s'affiche avec le lecteur d'écran
    Alors il est lu exactement comme aujourd'hui, sans rien sur le décor
    Et toucher le décor, hors des cadres et des boutons, ne fait rien

  Scénario: Aucune règle ne change
    Étant donné un joueur avec la même jauge, les mêmes Éclats et la même graine qu'en v0.4.0
    Quand il commence l'ascension depuis le pied de la tour décoré
    Alors la jauge, les Éclats, le lancement et l'ascension sont ceux qu'il aurait eus sans le décor
