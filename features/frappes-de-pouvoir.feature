# language: fr
Fonctionnalité: Les frappes de pouvoir et le choix des pouvoirs équipés
  Story #236 (épique #232) : les frappes de pouvoir (`PowerStrike`) de l'arbre de pouvoirs (Coup de
  bouclier, Fracas, Rafale, Frappe furtive), et le choix, au Choix du héros, des 3 pouvoirs équipés
  parmi tous ceux qu'on possède, mémorisé par héros.

  # Les scénarios `@domain` éprouvent les règles du domaine (arbre, combat). Les scénarios `@session`
  # passent par une vraie session du camp et d'ascension sur un stockage en mémoire. Les scénarios
  # `@ui` passent en plus par les écrans (arbre, Choix du héros, combat).

  # --- L'arbre ---

  @ui
  Scénario: Les frappes de pouvoir se débloquent dans l'arbre
    Étant donné le joueur n'a débloqué aucun pouvoir et a 90 Éclats disponibles
    Quand il ouvre l'arbre de pouvoirs de la Sentinelle au camp
    Alors plus aucun pouvoir n'est marqué « Bientôt »
    Et Coup de bouclier (rang 1 de la voie Bouclier, 30 Éclats) peut être débloqué
    Et Fracas (rang 2, 60 Éclats) est verrouillé tant que Coup de bouclier ne l'est pas
    Quand il débloque Coup de bouclier puis Fracas
    Alors il a 0 Éclat disponible et les deux sont débloqués

  @domain
  Scénario: Le rang 2 de l'Errante
    Étant donné le joueur a débloqué Brume mais pas Entaille
    Alors Frappe furtive peut être débloquée (60 Éclats)
    Et Rafale reste verrouillée et indique qu'il faut d'abord débloquer Entaille

  # --- Le choix des pouvoirs équipés au Choix du héros ---

  @ui
  Scénario: Un 4e pouvoir débloqué ne s'équipe pas tout seul
    Étant donné la Sentinelle a pour pouvoirs équipés Rempart, Représailles et Tenir bon
    Quand le joueur débloque Coup de bouclier
    Alors ses pouvoirs équipés restent Rempart, Représailles et Tenir bon
    Et la carte de la Sentinelle du Choix du héros montre le bouton « Changer les pouvoirs »

  @ui
  Scénario: Pas de choix avec 3 pouvoirs débloqués ou moins
    Étant donné l'Errante n'a que Pas de l'ombre, Entaille et Brume de débloqués
    Alors sa carte du Choix du héros ne montre pas « Changer les pouvoirs »

  @ui
  Scénario: Laisser le pouvoir de base de côté
    Étant donné la Sentinelle a débloqué Représailles, Tenir bon, Coup de bouclier et Fracas
    Quand le joueur touche « Changer les pouvoirs » et choisit Coup de bouclier, Fracas et Représailles
    Et continue avec la Sentinelle
    Alors ses pouvoirs équipés pour l'ascension sont Coup de bouclier, Fracas et Représailles, sans le Rempart

  @ui
  Scénario: Exactement 3 pouvoirs équipés
    Étant donné l'Errante a 5 pouvoirs débloqués
    Quand le joueur change ses pouvoirs
    Alors il ne peut pas en choisir un 4e
    Et il ne peut pas valider avec moins de 3 pouvoirs

  @session
  Scénario: Les lignes de la liste des pouvoirs suivent l'ordre de l'arbre
    Étant donné le joueur a choisi, dans cet ordre, Frappe furtive, Entaille et Pas de l'ombre
    Quand c'est la phase du héros
    Alors les lignes de la liste des pouvoirs sont, de haut en bas : Pas de l'ombre, Entaille, Frappe furtive

  @session
  Scénario: Le choix est mémorisé par héros
    Étant donné le joueur a équipé l'Errante de Entaille, Rafale et Frappe furtive lors de sa dernière ascension
    Quand il commence une nouvelle ascension et ouvre le Choix du héros
    Alors l'Errante est présélectionnée avec Entaille, Rafale et Frappe furtive
    Et les pouvoirs mémorisés pour la Sentinelle ne changent pas

  @session
  Scénario: La présélection sans choix mémorisé
    Étant donné une mise à jour où la Sentinelle a 4 pouvoirs débloqués et aucun choix mémorisé
    Quand le joueur ouvre le Choix du héros
    Alors la Sentinelle est présélectionnée avec le Rempart, puis les pouvoirs suivants dans l'ordre de l'arbre

  @session
  Scénario: Le choix ne change plus jusqu'à la fin de l'ascension
    Étant donné une ascension lancée avec l'Errante équipée de Entaille, Rafale et Frappe furtive
    Quand le joueur met l'ascension en pause et la reprend, même un autre jour
    Alors ses pouvoirs équipés sont toujours Entaille, Rafale et Frappe furtive
    Et l'ascension ne propose aucun moyen de les changer

  # L'enregistrement qui échoue est celui du choix des pouvoirs, écrit au lancement (#236, D3).
  @ui
  Scénario: L'enregistrement du choix échoue
    Étant donné l'enregistrement de l'ascension échoue au lancement
    Quand le joueur continue avec ses pouvoirs choisis
    Alors un message le dit et le joueur peut réessayer, sans perdre son choix

  # --- Les frappes de pouvoir en combat ---

  @domain
  Scénario: Coup de bouclier
    Étant donné la Sentinelle, Attaque 10 et Brise-garde 12, a 2 Élan et Coup de bouclier équipé
    Quand elle lance Coup de bouclier sur un ennemi non étourdi et laisse passer l'impact sans appuyer
    Alors après une préparation de 700 ms, sa frappe en rythme d'un coup retire 5 PV et 24 de garde
    Et elle a 0 Élan : une frappe de pouvoir ne rapporte pas le +1 Élan d'une attaque

  # Sous G1 (#244) : les bonus de frappe parfaite n'entrent que dans les PV.
  @domain
  Scénario: Fracas en frappe parfaite
    Étant donné la Sentinelle a 3 Élan et Fracas équipé
    Quand elle lance Fracas et touche « Frapper » à 40 ms de l'impact au plus
    Alors c'est une frappe parfaite : les PV (×200 %) sont multipliés par le multiplicateur de frappe parfaite, et la garde (×100 %) par 150 %, sans les bonus, en un seul calcul
    Et l'arrêt sur image et « Frappe parfaite » s'affichent comme pour « Attaquer »

  @domain
  Scénario: Rafale frappe 4 fois
    Étant donné l'Errante a 2 Élan et Rafale équipée
    Quand elle lance Rafale sur un ennemi
    Alors sa frappe en rythme a 4 coups, à 300 ms d'écart, chacun jugé seul, avec 100 % de son Attaque et de son Brise-garde
    Et si la cible tombe avant le 4e coup, les coups restants sont perdus

  @domain
  Scénario: Frappe furtive sur une cible qui n'a pas encore agi
    Étant donné la cible de l'Errante a encore sa case dans la frise d'action après l'Errante
    Quand l'Errante lance Frappe furtive (3 Élan)
    Alors chacun de ses 2 coups fait 250 % de son Attaque en PV et 100 % de son Brise-garde

  @domain
  Scénario: Frappe furtive sur une cible qui a déjà agi
    Étant donné la cible de l'Errante a déjà agi dans la manche
    Quand l'Errante lance Frappe furtive
    Alors chacun de ses 2 coups fait 100 % de son Attaque en PV et 100 % de son Brise-garde
    Et la condition est jugée une seule fois, au lancer

  @domain
  Scénario: Une frappe de pouvoir sur un ennemi étourdi
    Étant donné l'ennemi ciblé est étourdi
    Quand le héros lance une frappe de pouvoir sur lui
    Alors les PV retirés sont multipliés par 1,5 et aucune garde n'est retirée, comme pour « Attaquer »

  @domain
  Scénario: Une frappe de pouvoir brise la garde
    Étant donné la garde de la cible tombe à 0 sous un Coup de bouclier
    Alors c'est une cassure, comme pour « Attaquer »
    Et si le héros possède Cœur de braise, il gagne 1 Élan et 5 PV

  @domain
  Scénario: Une frappe de pouvoir est l'action du héros
    Étant donné un ennemi étourdi qui a déjà perdu son action
    Quand le héros lance une frappe de pouvoir
    Alors elle compte comme la prochaine action du héros, comme une attaque
    Et l'ennemi fait ensuite son retour en garde

  @domain
  Scénario: Entaille avant Rafale
    Étant donné l'Errante a 3 Élan, Entaille et Rafale équipées
    Quand elle lance Entaille, puis Rafale
    Alors chacun des 4 coups de Rafale retire 150 % du Brise-garde, en un seul calcul
    Et Entaille est consommée par cette frappe

  @ui
  Scénario: Coup de bouclier s'écrit en entier sur sa ligne
    Étant donné la Sentinelle a Coup de bouclier équipé
    Quand le joueur ouvre la liste des pouvoirs en phase du héros
    Alors sa ligne de la liste des pouvoirs s'appelle « Coup de bouclier »
    Et l'arbre, la fiche du pouvoir, la carte du Choix du héros, le panneau des pouvoirs équipés, la feuille de l'Équipement et le lecteur d'écran disent « Coup de bouclier »

  @ui
  Scénario: Une frappe de pouvoir trop chère
    Étant donné l'Errante a 2 Élan et Frappe furtive équipée
    Alors la ligne de Frappe furtive est visible mais indisponible et dit qu'il manque 1 Élan
