# language: fr
Fonctionnalité: Seconde chance
  Story #206 (épique #205) : la faveur pleine donne une seconde chance (`SecondChance`) au lancement
  de l'ascension. Quand un coup ennemi fait tomber le héros à 0 PV, il se relève une fois avec 50 %
  de ses PV max ; seuls les impacts restants de ce coup sont annulés.

  # Les scénarios `@domain` éprouvent les règles du domaine (source, relèvement, coup en cours,
  # Brûlure et Saignement, Élan, Vigueur, chute, Éclats). Les scénarios `@session` passent par une
  # vraie session d'ascension sur un stockage en mémoire. Le scénario `@ui` passe en plus par le pied
  # de la tour.

  @domain
  Scénario: Seule la faveur pleine donne une seconde chance
    Étant donné une jauge de +2
    Quand le joueur commence une ascension
    Alors le héros a 1 seconde chance pour cette ascension
    Et avec une jauge de +1, 0, −1 ou −2, il n'en a aucune

  @ui
  Scénario: La seconde chance annoncée au pied de la tour
    Étant donné une jauge de +2
    Quand le joueur ouvre le pied de la tour
    Alors les effets de la jauge comptent « 1 seconde chance »

  @domain
  Scénario: Se relever une fois
    Étant donné le héros a une seconde chance et 80 PV max
    Quand il tombe à 0 PV pendant un combat
    Alors il se relève avec 40 PV
    Et le combat continue
    Et il n'a plus de seconde chance pour cette ascension

  @domain
  Scénario: La seconde chance arrête le coup en cours, seulement lui
    Étant donné le héros a une seconde chance
    Et deux ennemis doivent encore agir dans la manche
    Quand il tombe à 0 PV sur le premier impact d'une double frappe du premier
    Alors il se relève et le second impact de cette double frappe est annulé
    Et le second ennemi agit ensuite, comme prévu dans la manche

  @domain
  Scénario: La Brûlure et le Saignement ne la déclenchent jamais
    Étant donné le héros a une seconde chance, 2 PV, 3 charges de Brûlure et un Saignement
    Quand une manche commence
    Alors il reste à 1 PV au moins
    Et il a toujours sa seconde chance

  @domain
  Scénario: Se relever éteint la Brûlure et arrête le Saignement
    Étant donné le héros a une seconde chance, 4 charges de Brûlure et un Saignement de 2 manches
    Quand un coup le fait tomber à 0 PV
    Alors il se relève sans charge de Brûlure et sans Saignement

  @domain
  Scénario: Se relever garde l'Élan et le pouvoir actif
    Étant donné le héros a 3 Élan et un pouvoir actif
    Quand il tombe à 0 PV et se relève grâce à sa seconde chance
    Alors il a toujours 3 Élan et son pouvoir reste actif

  @domain
  Scénario: Avec une bénédiction Vigueur
    Étant donné la Sentinelle a 88 PV max (Vigueur Rare) et une seconde chance
    Quand elle tombe à 0 PV
    Alors elle se relève avec 44 PV

  @domain
  Scénario: Chute sans seconde chance
    Étant donné le héros a déjà utilisé sa seconde chance
    Quand il tombe à 0 PV
    Alors c'est la chute, comme avant

  @session
  Scénario: La seconde chance survit à une reprise
    Étant donné une ascension lancée hier avec une jauge de +2, sans avoir utilisé la seconde chance
    Et la jauge d'aujourd'hui vaut −2
    Quand le joueur reprend l'ascension
    Alors le héros a toujours sa seconde chance

  @session
  Scénario: Une seconde chance utilisée le reste après une fermeture
    Étant donné le héros s'est relevé grâce à sa seconde chance
    Quand le joueur ferme l'application pendant le combat et le reprend
    Alors le héros n'a plus de seconde chance

  @domain
  Scénario: Les Éclats ne changent pas
    Étant donné le héros a utilisé sa seconde chance, puis bat le boss du palier 1
    Alors il gagne 8 Éclats, comme sans seconde chance
