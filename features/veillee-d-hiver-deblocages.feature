# language: fr
Fonctionnalité: Veillée d'hiver et contenus à débloquer dans la tour
  Story #195 (épique #194, camp) : Veillée d'hiver prend la place de Cœur de braise dans les
  bienfaits de base ; Cœur de braise, l'Épieu de chasse, la Clochette du guet et la Flamberge
  n'entrent dans la tour que débloqués. Les Déblocages d'une ascension sont figés à son début.

  # Les scénarios `@domain` éprouvent les règles du domaine (« le tirage est sous 20 % » : un état
  # du flux du butin qui donne ce tirage) ; les scénarios `@session` passent par une vraie session
  # d'ascension sur un Stockage clé-valeur en mémoire (« reprise » : une nouvelle session sur le
  # même stockage) ; le scénario `@ui` passe aussi par la feuille d'Équipement.

  Contexte:
    Étant donné les bienfaits de base : Écho parfait, Braise brisante, Peau de givre, Lame juste, Braise ardente, Givre persistant et Veillée d'hiver

  @domain
  Scénario: Veillée d'hiver est proposée à la place de Cœur de braise
    Étant donné une ascension sans aucun Déblocage
    Quand le héros gagne un combat ordinaire et que l'offre de bienfaits s'affiche
    Alors l'offre est tirée parmi les 7 bienfaits de base, au poids de leur rareté (Commun 6, Rare 3, Épique 1)
    Et elle ne contient jamais Cœur de braise

  @domain
  Scénario: L'effet de Veillée d'hiver
    Étant donné un héros qui a choisi Veillée d'hiver
    Quand un combat commence
    Alors le héros a 1 Élan de plus au départ
    Et sa réduction des dégâts gagne 10 points, toujours plafonnée à 40 %

  @domain
  Scénario: Sans Déblocage, la tour est celle d'aujourd'hui
    Étant donné une ascension sans aucun Déblocage, avec une graine donnée
    Quand le héros gravit le palier 1
    Alors les groupes, les Élites, les boss, l'Or, le butin, les intentions et les offres de bienfaits sont ceux d'aujourd'hui
    Et la seule différence est Veillée d'hiver à la place de Cœur de braise dans les offres

  @session
  Scénario: Les Déblocages sont figés au début de l'ascension
    Étant donné une ascension commencée avec les Déblocages Flamberge et Cœur de braise
    Quand le joueur la met en pause et la reprend
    Alors elle garde exactement ces Déblocages jusqu'à sa fin

  @domain
  Scénario: Un objet débloqué entre dans le butin de sa rareté
    Étant donné une ascension avec le Déblocage Épieu de chasse
    Quand un combat ordinaire donne un objet Commun
    Alors il est tiré à égalité parmi les objets Communs et l'Épieu de chasse, jamais un objet déjà porté

  @domain
  Scénario: La Flamberge tombe sur une Élite
    Étant donné une ascension avec le Déblocage Flamberge, que le héros ne porte pas
    Quand le héros bat une Élite et que le tirage de rareté est sous 20 %
    Alors l'objet trouvé est la Flamberge, Épique

  @domain
  Scénario: Sinon, l'Élite garde son objet Rare
    Étant donné une ascension avec le Déblocage Flamberge
    Quand le héros bat une Élite et que le tirage de rareté est à 20 % ou plus
    Alors l'objet trouvé est un objet Rare, comme aujourd'hui

  @domain
  Scénario: Jamais d'objet Épique sur un combat ordinaire
    Étant donné une ascension avec le Déblocage Flamberge
    Quand le héros gagne un combat ordinaire, quelle que soit la jauge
    Alors l'objet trouvé n'est jamais la Flamberge

  @domain
  Scénario: La Flamberge déjà portée ne retombe pas
    Étant donné un héros qui porte la Flamberge
    Quand il bat une Élite et que le tirage de rareté est sous 20 %
    Alors l'objet trouvé est un objet Rare, jamais la Flamberge

  @domain
  Scénario: Cœur de braise proposé après une Élite
    Étant donné une ascension avec le Déblocage Cœur de braise, jamais proposé dans cette ascension
    Quand le héros bat une Élite et que le tirage de Cœur de braise est sous 10 %
    Alors Cœur de braise remplace le 3e bienfait de l'offre

  @domain
  Scénario: Cœur de braise s'ajoute à une offre incomplète
    Étant donné une ascension avec le Déblocage Cœur de braise et un héros qui possède 6 des 7 bienfaits de base
    Quand le héros bat une Élite et que le tirage de Cœur de braise est sous 10 %
    Alors l'offre propose le bienfait de base restant et Cœur de braise

  @domain
  Scénario: Cœur de braise une seule fois par ascension
    Étant donné Cœur de braise a déjà été proposé dans cette ascension et le joueur ne l'a pas pris
    Quand le héros bat une autre Élite
    Alors aucun tirage de Cœur de braise n'est fait et l'offre ne le contient pas

  @domain
  Scénario: Jamais Cœur de braise sans Déblocage, ni après un combat ordinaire
    Étant donné une ascension sans le Déblocage Cœur de braise
    Quand le héros bat une Élite ou gagne un combat ordinaire
    Alors aucun tirage de Cœur de braise n'est fait et l'offre ne le contient jamais

  @ui
  Scénario: Une ascension sauvegardée avec Cœur de braise le garde
    Étant donné une ascension sauvegardée avant la mise à jour, dont le héros possède Écho parfait et Cœur de braise
    Quand le joueur la reprend après la mise à jour
    Alors l'Équipement montre toujours Écho parfait et Cœur de braise
    Et chaque garde brisée donne toujours +1 Élan et rend 5 PV
    Et l'ascension n'a aucun Déblocage

  @session
  Scénario: Une offre en attente qui contenait Cœur de braise
    Étant donné une ascension sauvegardée avant la mise à jour sur l'écran de bienfait, avec l'offre Écho parfait, Givre persistant et Cœur de braise
    Quand le joueur la reprend après la mise à jour
    Alors l'offre est inchangée et le joueur peut prendre Cœur de braise
