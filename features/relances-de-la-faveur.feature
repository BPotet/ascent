# language: fr
Fonctionnalité: Relances de la faveur
  Story #42 (épique #205) : la faveur donne des relances (`Reroll`) au lancement de l'ascension, 1 à
  +1, 2 à +2. Une relance remplace l'offre de bienfaits affichée par une nouvelle offre, sans
  bienfait de l'offre relancée, sauf s'il en reste trop peu ; Cœur de braise garde sa place.

  # Les scénarios `@domain` éprouvent les règles du domaine (nombre, tirage, Cœur de braise, graine,
  # fin). Les scénarios `@session` passent par une vraie session d'ascension sur un stockage en
  # mémoire. Les scénarios `@ui` passent en plus par le pied de la tour et l'Équipement.

  @domain
  Scénario: Relances selon la jauge
    Étant donné une jauge de +2
    Quand le joueur commence une ascension
    Alors le héros a 2 relances pour cette ascension
    Et avec une jauge de +1, il en a 1
    Et avec une jauge de 0, −1 ou −2, il n'en a aucune

  @ui
  Scénario: Les relances annoncées au pied de la tour
    Étant donné une jauge de +1
    Quand le joueur ouvre le pied de la tour
    Alors les effets de la jauge comptent « 1 relance »

  @domain
  Scénario: Relancer une offre de bienfaits
    Étant donné le héros a 2 relances et vient de gagner un combat
    Et l'offre propose Écho parfait, Peau de givre et Lame juste
    Et il reste au moins 3 autres bienfaits que le héros ne possède pas
    Quand le joueur touche « Relancer »
    Alors une nouvelle offre de 3 bienfaits est tirée, selon les règles de l'offre
    Et elle ne propose ni Écho parfait, ni Peau de givre, ni Lame juste
    Et il reste 1 relance au héros

  @domain
  Scénario: Moins de 3 autres bienfaits, l'offre relancée complète la nouvelle
    Étant donné l'offre propose Écho parfait, Peau de givre et Lame juste
    Et il ne reste que 2 autres bienfaits que le héros ne possède pas, Braise ardente et Veillée d'hiver
    Quand le joueur touche « Relancer »
    Alors la nouvelle offre propose Braise ardente, Veillée d'hiver et un bienfait tiré parmi ceux de l'offre relancée

  @domain
  Scénario: La relance ne refait pas le tirage de Cœur de braise
    Étant donné Cœur de braise est débloqué, jamais proposé, et son tirage des 10 % n'est pas sorti après une Élite
    Quand le joueur relance l'offre de cette Élite
    Alors Cœur de braise n'entre pas dans la nouvelle offre

  @domain
  Scénario: La relance garde Cœur de braise
    Étant donné le héros a des relances et Cœur de braise est sorti après une Élite
    Et l'offre propose Écho parfait, Peau de givre et Cœur de braise
    Et il reste au moins 2 autres bienfaits que le héros ne possède pas
    Quand le joueur touche « Relancer »
    Alors Cœur de braise reste à sa place dans la nouvelle offre
    Et les 2 autres cartes sont 2 nouveaux bienfaits, ni Écho parfait ni Peau de givre
    Et Cœur de braise ne sera plus tiré pour le reste de l'ascension

  @domain
  Scénario: La même graine donne les mêmes relances
    Étant donné deux ascensions de même graine, aux mêmes choix
    Quand le joueur relance la même offre dans chacune
    Alors la nouvelle offre est la même

  @domain
  Scénario: Plus de relance
    Étant donné le héros n'a plus de relance
    Quand une offre de bienfaits s'affiche
    Alors « Relancer » n'est pas proposé
    Et le joueur choisit un bienfait comme avant

  @domain
  Scénario: Relance sans objet
    Étant donné le héros a des relances
    Et chaque bienfait qu'il ne possède pas est déjà dans l'offre affichée
    Quand une offre de bienfaits s'affiche
    Alors « Relancer » n'est pas proposé, et le héros garde ses relances

  @ui
  Scénario: Les relances dans l'Équipement et au pied de la tour
    Étant donné une ascension lancée avec une jauge de +2, où il reste 1 relance sur 2
    Quand le joueur ouvre la feuille de l'Équipement
    Alors la section « Faveur de l'ascension » dit qu'il reste 1 relance sur 2
    Et au pied de la tour, le cadre de l'ascension en cours le dit en une ligne

  @session
  Scénario: Les relances survivent à une reprise
    Étant donné une ascension lancée hier avec une jauge de +2, où il reste 1 relance
    Et la jauge d'aujourd'hui vaut −1
    Quand le joueur reprend l'ascension
    Alors le héros a toujours 1 relance

  @session
  Scénario: Une relance faite reste faite
    Étant donné le joueur a relancé une offre
    Quand il ferme l'application et reprend l'ascension
    Alors il retrouve la nouvelle offre et le même nombre de relances

  @domain
  Scénario: Les relances sont perdues à la fin de l'ascension
    Étant donné le héros a encore 2 relances
    Quand l'ascension se termine, par une chute, un abandon ou le Sommet
    Alors la prochaine ascension n'en reçoit que selon sa propre jauge
