# language: fr
Fonctionnalité: Ennemis maudits
  Story #209 (épique #205) : la malédiction de l'ascension rend des ennemis maudits. Un ennemi
  maudit (`CursedEnemy`) gagne 20 % de PV max, de garde max et de dégâts, sans rien rapporter de
  plus.

  # Les scénarios `@domain` éprouvent les règles du domaine (tirage, valeurs, relève, graine,
  # Éclats). Les scénarios `@session` passent par une vraie session d'ascension sur un stockage en
  # mémoire. Les scénarios `@ui` passent en plus par les portes, le combat ou le pied de la tour.

  @domain
  Scénario: Malédiction, un ennemi maudit par combat ordinaire
    Étant donné une ascension lancée avec une jauge de −1
    Quand le héros entre dans un combat ordinaire contre la Goule, le Spectre et le Nécromancien
    Alors exactement un de ces ennemis est maudit, la Goule ou le Spectre, tiré à égalité
    Et ce n'est jamais le Nécromancien, qui est un soutien
    Et il porte l'étiquette « Maudit » (« Maudite » pour la Goule) sous son nom

  @domain
  Scénario: Ce que gagne un ennemi maudit
    Étant donné une ascension au palier 1 lancée avec une jauge de −1
    Quand la Goule (50 PV, garde 30, coup simple de 5, double frappe de 3 + 3, Initiative 4) est maudite
    Alors elle a 60 PV max, une garde max de 36, un coup simple de 6 et une double frappe de 4 + 4
    Et son Initiative reste 4

  @domain
  Scénario: Le bonus se calcule sur la valeur du palier
    Étant donné un ennemi ordinaire maudit à un palier dont le multiplicateur s'applique
    Quand le combat commence
    Alors ses PV max, sa garde max et les dégâts de chaque coup valent la valeur du palier plus 20 % de cette valeur, à l'entier inférieur, et au moins +1

  @domain
  Scénario: Malédiction, l'Élite n'est pas maudite
    Étant donné une ascension lancée avec une jauge de −1
    Quand le héros passe la porte Élite
    Alors le Chevalier déchu n'est pas maudit

  @domain
  Scénario: Malédiction forte, l'Élite aussi
    Étant donné une ascension lancée avec une jauge de −2
    Quand le héros entre dans un combat ordinaire
    Alors exactement un ennemi du groupe est maudit, avec le même bonus qu'à −1
    Quand il passe ensuite la porte Élite
    Alors le Chevalier déchu est maudit
    Et il a 240 PV max, une garde max de 67, des coups de 9, 9 et 14, et son Initiative reste 6

  @domain
  Scénario: Le boss et ses invocations ne sont jamais maudits
    Étant donné une ascension lancée avec une jauge de −2
    Quand le héros affronte le boss
    Alors le boss n'est pas maudit
    Et aucun ennemi de son invocation n'est maudit

  @domain
  Scénario: Jamais plus d'un ennemi maudit par groupe, jamais en réserve
    Étant donné une ascension lancée avec une jauge de −2
    Quand le héros entre dans un combat ordinaire contre un groupe de 5 ennemis, dont 2 en réserve
    Alors un seul des 5 ennemis est maudit
    Et c'est un ennemi de la première ligne, jamais un soutien
    Et aucun ennemi de la réserve n'est maudit, même quand il entre en renfort

  @domain
  Scénario: Un ennemi relevé reste maudit
    Étant donné la Goule maudite (60 PV max) tombe
    Quand le Nécromancien la relève
    Alors elle est toujours maudite
    Et ses PV au relevé se calculent sur ses PV max maudits, 60 PV

  @domain
  Scénario: Aucune récompense de plus
    Étant donné un groupe avec un ennemi maudit
    Quand le héros gagne le combat
    Alors l'ennemi maudit ne rapporte ni Or, ni objet, ni bienfait de plus qu'un ennemi non maudit

  @domain
  Scénario: Un ennemi seul peut être maudit
    Étant donné une ascension lancée avec une jauge de −1
    Quand le héros entre dans un combat ordinaire contre une seule Goule
    Alors la Goule est maudite

  @domain
  Scénario: Sans malédiction, aucun ennemi maudit ni tirage de plus
    Étant donné une ascension lancée avec une jauge de 0, +1 ou +2
    Quand le héros entre dans n'importe quel combat
    Alors aucun ennemi n'est maudit
    Et aucun tirage n'est fait pour l'ennemi maudit : les tirages de l'ascension sont ceux d'aujourd'hui

  @ui
  Scénario: Les portes annoncent l'ennemi maudit
    Étant donné une ascension lancée avec une jauge de −2
    Quand l'écran « Choisis ta sortie » propose une porte Combat de 3 ennemis et une porte Élite
    Alors la porte Combat dit « 3 ennemis » et « dont 1 maudit », sans dire lequel
    Et la porte Élite dit « Élite maudite »
    Et avec une jauge de −1, la porte Combat dit « dont 1 maudit » et la porte Élite dit « Élite », comme aujourd'hui

  @session
  Scénario: Lecture impossible des habitudes
    Étant donné les habitudes ne peuvent pas être lues au lancement
    Quand le héros entre dans un combat ordinaire
    Alors la jauge est Neutre et aucun ennemi n'est maudit

  @domain
  Scénario: La même graine donne le même ennemi maudit
    Étant donné deux ascensions de même graine, lancées avec la même jauge de −1, aux mêmes choix
    Quand le héros entre dans le même combat ordinaire
    Alors le même ennemi est maudit dans les deux

  @session
  Scénario: L'ascension garde sa malédiction à la reprise
    Étant donné une ascension lancée hier avec une jauge de −2, toujours en cours
    Et la jauge d'aujourd'hui vaut +2
    Quand le joueur reprend l'ascension et passe la porte Élite
    Alors le Chevalier déchu est maudit

  @ui
  Scénario: Le lecteur d'écran annonce l'ennemi maudit
    Étant donné la Goule est maudite dans un combat
    Quand le lecteur d'écran lit la Goule
    Alors il dit « Goule maudite », avant ses PV
    Et l'ennemi maudit se reconnaît sans la couleur seule (étiquette et marque dans la frise d'action)

  @ui
  Scénario: La jauge annonce les ennemis maudits
    Étant donné une jauge de −1
    Quand le joueur ouvre le pied de la tour
    Alors les effets de la jauge comptent « 1 ennemi maudit par combat »
    Et avec une jauge de −2, ils comptent aussi l'Élite maudite

  @domain
  Scénario: Les Éclats ne changent pas
    Étant donné un ennemi maudit a été vaincu pendant l'ascension
    Quand le héros bat le boss du palier 1
    Alors il gagne 8 Éclats, comme sans ennemi maudit
