# language: fr
Fonctionnalité: Bienfaits de palier et carte Second souffle
  Story #212 (épique #210, paliers distincts) : six bienfaits de palier entrent dans l'offre aux
  paliers 2 et 3 ; la carte de repli Second souffle complète une offre de moins de 3 bienfaits et
  soigne 10 % des PV max, sans aucun tirage.

  # Les scénarios `@domain` éprouvent les règles du domaine, sur de nombreuses graines ; les
  # scénarios `@ui` montrent l'offre du domaine dans le vrai panneau du choix d'un bienfait
  # (`BoonChoicePanel`), et le choix du joueur passe par ce panneau.

  @domain
  Scénario: Au palier 1, l'offre ne change pas
    Étant donné une ascension au palier 1
    Quand le héros gagne un combat ordinaire
    Alors l'offre est tirée parmi les 7 bienfaits de base, comme avant, avec les mêmes tirages

  @domain
  Scénario: Au palier 2, les bienfaits du palier 2 entrent dans l'offre
    Étant donné une ascension au palier 2, sans bienfait possédé
    Quand le héros gagne un combat ordinaire
    Alors l'offre est tirée parmi 10 bienfaits : les 7 bienfaits de base, Ronce rendue, Gelée blanche et Lame de cendre
    Et les poids restent Commun 6, Rare 3, Épique 1

  @domain
  Scénario: Au palier 3, les bienfaits des paliers 2 et 3 entrent dans l'offre
    Étant donné une ascension au palier 3
    Quand le héros gagne un combat ordinaire ou une Élite
    Alors l'offre est tirée parmi 13 bienfaits, dont les 3 du palier 2 et Bronze chauffé, Heure juste et Givre du clocher

  @domain
  Scénario: Un bienfait de palier se garde en changeant de palier
    Étant donné le héros a pris Lame de cendre au palier 2
    Quand il entre au palier 3
    Alors il garde Lame de cendre jusqu'à la fin de l'ascension
    Et Lame de cendre n'est plus jamais proposée

  @domain
  Scénario: L'effet d'un bienfait de palier
    Étant donné la Sentinelle, sans autre bienfait, a pris Gelée blanche et a 50 PV sur 80
    Quand elle pare parfaitement un impact
    Alors elle récupère 2 PV

  @ui
  Scénario: La carte de repli complète une offre de moins de 3 bienfaits
    Étant donné il ne reste qu'un bienfait non possédé au palier
    Quand le héros gagne un combat ordinaire
    Alors l'offre montre ce bienfait et la carte « Second souffle »

  @ui
  Scénario: Plus aucun bienfait : la carte seule
    Étant donné le héros possède tous les bienfaits de son palier
    Et Cœur de braise n'entre pas dans l'offre
    Quand le héros gagne un combat ordinaire
    Alors l'offre montre la carte « Second souffle » seule

  @ui
  Scénario: Cœur de braise, puis la carte de repli
    Étant donné il ne reste aucun bienfait à tirer
    Et Cœur de braise entre dans l'offre après une Élite
    Alors l'offre montre Cœur de braise et la carte « Second souffle »

  @ui
  Scénario: Second souffle soigne 10 % des PV max
    Étant donné le héros a 40 PV sur 88
    Quand le joueur choisit « Second souffle »
    Alors le héros a 48 PV
    Et il ne possède aucun bienfait de plus

  @domain
  Scénario: Au moins 1 PV, jamais au-delà du maximum
    Étant donné le héros a 9 PV max et 3 PV
    Quand le joueur choisit « Second souffle »
    Alors le héros a 4 PV
    Et un héros à 79 PV sur 80 qui la choisit a 80 PV, et un héros à PV pleins reste à PV pleins

  @domain
  Scénario: La carte de repli ne change pas les tirages
    Étant donné une graine de l'ascension
    Quand une offre a moins de 3 bienfaits
    Alors la carte de repli n'utilise aucun tirage
    Et le butin, les bénédictions et les offres suivantes sont tirés comme sans elle
