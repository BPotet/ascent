# language: fr
Fonctionnalité: Lire sa jauge au pied de la tour
  Story #41 (épique #205) : le cadran de la jauge au pied de la tour, son détail, et hier compté tel
  qu'à la clôture.

  # Les scénarios sans tag passent par les cas d'usage (`getFateGauge`, `toggleCheckIn`,
  # `updateHabit`, `deleteHabit`, `getYesterdayReminder`, la session d'ascension et l'export du
  # journal), sur un stockage en mémoire. Les scénarios `@ui` passent en plus par le pied de la tour,
  # son détail de la jauge ou le camp.

  @ui
  Scénario: La jauge en faveur pleine
    Étant donné hier, 3 habitudes attendues, toutes « fait », dont une Difficile
    Et aucune ascension en cours
    Quand le joueur ouvre le pied de la tour
    Alors la jauge montre son curseur sur +2 et le mot « Faveur pleine »
    Et elle dit « D'après hier : 3 habitudes sur 3. »
    Et elle liste ses effets du jour : 3 bénédictions de départ, objets plus fréquents, objets Rares plus fréquents

  @ui
  Scénario: La jauge en malédiction ne bloque jamais
    Étant donné hier, 1 habitude « fait » sur 3 attendues
    Quand le joueur ouvre le pied de la tour
    Alors la jauge montre son curseur sur −1 et le mot « Malédiction »
    Et elle liste la fatigue (PV max −10 %) et les objets Rares moins fréquents
    Et une phrase dit que c'est seulement pour aujourd'hui et que l'ascension reste gagnable
    Et « Commencer l'ascension » est disponible

  @ui
  Scénario: Jamais la couleur seule
    Étant donné une jauge de −2
    Quand le lecteur d'écran lit la jauge
    Alors il dit son mot, « Malédiction forte », sa valeur et le compte d'hier

  @ui
  Scénario: Première utilisation, aucune habitude attendue hier
    Étant donné aucune habitude n'était attendue hier (nouveau joueur, habitude créée aujourd'hui, ou objectifs de la semaine atteints sans rien de fait hier)
    Quand le joueur ouvre le pied de la tour
    Alors la jauge est Neutre, dans son état « pas encore de compte »
    Et elle dit qu'elle comptera dès demain, d'après les habitudes d'aujourd'hui

  @ui
  Scénario: Ouvrir le détail de la jauge
    Étant donné une jauge de +1 (3 habitudes sur 4 hier)
    Quand le joueur ouvre le détail de la jauge
    Alors il voit le compte d'hier, les 5 niveaux de la jauge avec leurs seuils, et les effets du niveau du jour
    Et il voit, par leur nom, les habitudes attendues hier, faites ou non
    Et il lit les garde-fous : seul hier compte, seulement aujourd'hui, l'ascension se lance toujours, jamais d'effet sur les Éclats, les déblocages ni le camp
    Quand il ferme le détail
    Alors il revient au pied de la tour, sur la jauge

  @ui
  Scénario: Le détail d'une jauge scellée
    Étant donné le joueur a lancé une ascension aujourd'hui avec une jauge de −1
    Quand il ouvre le détail de la jauge du jour
    Alors il lit que la jauge est scellée pour aujourd'hui
    Et qu'une correction d'hier ne change plus que l'expérience

  @ui
  Scénario: Pendant une ascension, la jauge de l'ascension
    Étant donné une ascension lancée hier avec une jauge de +2, toujours en cours
    Et la jauge d'aujourd'hui vaut −1
    Quand le joueur ouvre le pied de la tour
    Alors il voit la jauge de l'ascension, +2, « Faveur pleine », et son détail
    Et la fatigue ne s'applique pas à cette ascension

  Scénario: Corriger hier avant de jouer change toujours la jauge
    Étant donné hier compte 1 habitude « fait » sur 3 et aucune ascension n'a été lancée aujourd'hui
    Quand le joueur corrige une habitude d'hier en « fait »
    Alors la jauge passe de −1 à 0 au pied de la tour

  Scénario: Corriger avant-hier ne change jamais la jauge
    Étant donné aujourd'hui est vendredi et aucune ascension n'a été lancée aujourd'hui
    Et « Courir » (objectif de 3 fois par semaine) comptait 2 suivis à la clôture de mercredi, puis était attendue jeudi sans être faite
    Quand le joueur corrige mercredi en « fait » pour « Courir »
    Alors le Rappel d'hier ne compte plus « Courir » comme attendue
    Mais la jauge compte toujours « Courir » comme attendue hier, et elle ne change pas
    Et le détail de la jauge dit qu'hier est « compté tel qu'à la clôture »

  Scénario: Le lundi, hier est le dimanche de la semaine précédente
    Étant donné aujourd'hui est lundi et dimanche compte 1 habitude « fait » sur 2
    Quand le joueur corrige l'habitude manquée de dimanche en « fait » avant de jouer
    Alors la jauge passe à +2

  Scénario: Une difficulté changée aujourd'hui ne change pas les bénédictions du jour
    Étant donné « Courir » était Facile à la clôture d'hier et a été faite hier
    Et aujourd'hui est dans la même semaine qu'hier, sans ascension lancée
    Quand le joueur passe « Courir » en Difficile
    Alors « Courir » donne toujours une bénédiction Commune aujourd'hui
    Et la jauge du pied de la tour annonce toujours ses bénédictions avec les mêmes raretés

  Scénario: Une baisse de difficulté aujourd'hui ne compte pas non plus
    Étant donné « Lire » était Difficile à la clôture d'hier et a été faite hier
    Et aujourd'hui est dans la même semaine qu'hier, sans ascension lancée
    Quand le joueur passe « Lire » en Facile
    Alors « Lire » donne toujours une bénédiction Épique aujourd'hui

  Scénario: Les noms des habitudes restent dans la tour
    Étant donné le joueur a ouvert le détail de la jauge, qui nomme ses habitudes d'hier
    Quand l'ascension se termine et que le joueur exporte le journal
    Alors aucun journal d'ascension ne contient le nom d'une habitude

  Scénario: Une habitude supprimée ne compte plus
    Étant donné hier, 3 habitudes attendues, dont 2 « fait »
    Quand le joueur supprime l'habitude manquée, avant de lancer une ascension
    Alors la jauge vaut +2 (2 sur 2)

  @ui
  Scénario: Lecture impossible
    Étant donné les habitudes ne peuvent pas être lues
    Quand le joueur ouvre le pied de la tour
    Alors la jauge est Neutre, sans effet
    Et « Commencer l'ascension » est disponible

  @ui
  Scénario: La jauge ne touche jamais le camp
    Étant donné une jauge de −2 et 62 Éclats disponibles
    Quand le joueur ouvre le camp
    Alors il a toujours 62 Éclats disponibles, aux mêmes prix de déblocage
