# language: fr
Fonctionnalité: Le Serment et le pouvoir attisé
  Story #237 (épique #232) : le Serment (`Oath`) lie une habitude à un pouvoir débloqué de 2 Élan
  ou plus ; faite hier, à partir du lendemain du Serment, elle attise ce pouvoir (`KindledPower`) :
  1 Élan de moins, au moins 1, pour toute l'ascension.

  # Les scénarios `@session` passent par une vraie session du camp et d'ascension, la jauge et les
  # habitudes sur des ports en mémoire, avec une horloge réglable. Les scénarios `@ui` passent en
  # plus par l'arbre de pouvoirs et la fiche du pouvoir.

  # --- Prêter serment au Camp ---

  @ui
  Scénario: Lier une habitude à un pouvoir
    Étant donné le joueur a débloqué Représailles (2 Élan) et a l'habitude « Courir »
    Quand il ouvre Représailles dans l'arbre de la Sentinelle et lie « Courir » par un Serment
    Alors Représailles porte le Serment « Courir »
    Et la fiche dit que le Serment compte dès demain

  @session
  Scénario: Un pouvoir à 1 Élan ne porte pas de Serment
    Étant donné le joueur a débloqué Entaille (1 Élan)
    Alors ni Entaille ni le Rempart (1 Élan) ne proposent de Serment

  @session
  Scénario: Un pouvoir non débloqué ne porte pas de Serment
    Étant donné le joueur n'a pas débloqué Brume
    Alors Brume ne propose pas de Serment
    Mais Pas de l'ombre (3 Élan), pouvoir de base, en propose un

  @session
  Scénario: Une habitude pour un seul pouvoir
    Étant donné « Courir » est liée par un Serment à Représailles
    Quand le joueur prête un Serment pour Pas de l'ombre
    Alors « Courir » n'est pas proposée, ou se montre déjà liée à Représailles

  @session
  Scénario: Un seul Serment par pouvoir
    Étant donné Représailles porte le Serment « Courir »
    Alors il ne peut pas porter un second Serment en même temps

  @ui
  Scénario: Aucune habitude
    Étant donné le joueur n'a aucune habitude
    Quand il ouvre un pouvoir à 2 Élan ou plus dans l'arbre
    Alors le Serment dit qu'il faut d'abord créer une habitude, sans rien proposer à lier

  @ui
  Scénario: L'enregistrement du Serment échoue
    Étant donné l'enregistrement du Serment échoue
    Quand le joueur lie « Courir » à Représailles
    Alors un message dit que le Serment n'a pas pu être enregistré
    Et Représailles ne porte pas de Serment et le joueur peut réessayer

  # --- Le pouvoir attisé ---

  @session
  Scénario: L'habitude a été faite hier
    Étant donné Représailles porte le Serment « Courir » depuis avant-hier et « Courir » a été faite hier
    Quand le joueur commence une ascension avec la Sentinelle équipée de Représailles
    Alors Représailles est attisé pour toute l'ascension
    Et sa ligne dans la liste des pouvoirs dit « 1 Élan · Instantané », avec la marque du pouvoir attisé
    Et la carte de la Sentinelle du Choix du héros et la feuille de l'Équipement le montrent attisé

  @session
  Scénario: Le Serment compte à partir du lendemain
    Étant donné « Courir » a été faite hier
    Et le joueur lie aujourd'hui « Courir » à Représailles par un Serment
    Quand il commence une ascension aujourd'hui avec la Sentinelle équipée de Représailles
    Alors Représailles n'est pas attisé et coûte 2 Élan

  @session
  Scénario: Le lendemain du Serment
    Étant donné le joueur a lié hier « Courir » à Représailles par un Serment
    Et « Courir » a été faite hier, avant ou après le Serment
    Quand il commence une ascension aujourd'hui avec la Sentinelle équipée de Représailles
    Alors Représailles est attisé pour toute l'ascension

  @session
  Scénario: Changer l'habitude d'un Serment
    Étant donné Représailles porte le Serment « Courir » depuis avant-hier
    Et hier, « Lire » a été faite mais pas « Courir »
    Quand le joueur remplace aujourd'hui « Courir » par « Lire » dans le Serment de Représailles, puis commence une ascension
    Alors Représailles n'est pas attisé dans cette ascension
    Et la fiche dit que le nouveau Serment compte dès demain

  @session
  Scénario: Un pouvoir attisé coûte 1 Élan de moins
    Étant donné Pas de l'ombre est attisé
    Quand l'Errante a 2 Élan pendant la phase du héros
    Alors elle peut lancer Pas de l'ombre et il lui reste 0 Élan

  @session
  Scénario: L'habitude a été ratée hier
    Étant donné Représailles porte le Serment « Courir » et « Courir » n'a pas été faite hier
    Quand le joueur commence une ascension
    Alors Représailles coûte 2 Élan, son prix normal, sans marque

  @session
  Scénario: L'état d'hier est figé au scellement de la jauge
    Étant donné « Courir » n'était pas faite hier au lancement de la 1re ascension du jour
    Quand le joueur coche « Courir » pour hier, puis reprend cette ascension ou en commence une autre le même jour
    Alors Représailles n'est pas attisé, ni dans l'une ni dans l'autre

  @session
  Scénario: Une reprise ne change rien
    Étant donné une ascension lancée avec Représailles attisé
    Quand le joueur la reprend un autre jour, alors que « Courir » n'a pas été faite la veille
    Alors Représailles reste attisé jusqu'à la fin de cette ascension

  @session
  Scénario: Une habitude supprimée
    Étant donné Représailles porte le Serment « Courir »
    Quand le joueur supprime l'habitude « Courir »
    Alors le Serment disparaît, la fiche de Représailles dit « Serment rompu » et Représailles coûte de nouveau 2 Élan
    Et Représailles peut porter un nouveau Serment, qui compte dès le lendemain
    Et une ascension déjà lancée avec Représailles attisé le garde attisé jusqu'à sa fin

  @session
  Scénario: Un pouvoir attisé non équipé
    Étant donné Coup de bouclier porte un Serment tenu hier mais n'est pas équipé pour l'ascension
    Alors rien ne change en combat

  @session
  Scénario: Le Serment ne touche ni les Éclats ni les prix
    Étant donné plusieurs Serments tenus ou ratés
    Alors les Éclats gagnés, les Éclats disponibles et les prix de l'arbre et du Gardien de la flamme sont les mêmes que sans Serment

  @session
  Scénario: Une ascension d'avant la mise à jour
    Étant donné une ascension sauvegardée avant cette story
    Quand le joueur la reprend avec un Serment tenu hier
    Alors aucun pouvoir n'est attisé dans cette ascension

  @session
  Scénario: Le nom de l'habitude reste sur l'appareil
    Étant donné une ascension lancée avec Représailles attisé par « Courir »
    Quand le journal d'ascension est exporté
    Alors il dit que Représailles est attisé, sans le nom « Courir »
