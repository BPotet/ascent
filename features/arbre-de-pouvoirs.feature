# language: fr
Fonctionnalité: L'arbre de pouvoirs au Camp et les pouvoirs équipés en combat
  Story #235 (épique #232) : l'arbre de pouvoirs (`PowerTree`) de chaque héros au Camp, ses pouvoirs
  débloqués avec les Éclats, les pouvoirs équipés (`EquippedPower`) figés au départ de l'ascension,
  et le combat à 1 à 3 touches de pouvoir, avec Représailles, Tenir bon, Entaille et Brume.

  # Les scénarios `@domain` éprouvent les règles du domaine (arbre, prix, combat). Les scénarios
  # `@session` passent par une vraie session du camp et d'ascension sur un stockage en mémoire. Les
  # scénarios `@ui` passent en plus par les écrans (arbre, fiche, Choix du héros, Équipement, combat).

  # --- L'arbre de pouvoirs au Camp ---

  @ui
  Scénario: Première ouverture de l'arbre de la Sentinelle
    Étant donné le joueur n'a débloqué aucun pouvoir et a 50 Éclats disponibles
    Quand il ouvre l'arbre de pouvoirs de la Sentinelle au camp
    Alors il voit « 50 Éclats disponibles »
    Et la racine de l'arbre est le Rempart, marqué « Pouvoir de base », sans prix
    Et la voie Veille montre Représailles (rang 1, 30 Éclats) puis Tenir bon (rang 2, 60 Éclats, verrouillé)
    Et la voie Bouclier montre Coup de bouclier et Fracas, marqués « Bientôt », sans prix ni bouton de déblocage

  @ui
  Scénario: Première ouverture de l'arbre de l'Errante
    Étant donné le joueur n'a débloqué aucun pouvoir
    Quand il ouvre l'arbre de pouvoirs de l'Errante au camp
    Alors la racine de l'arbre est Pas de l'ombre, marqué « Pouvoir de base », sans prix
    Et la voie Lames montre Entaille (rang 1, 30 Éclats) puis Rafale, marquée « Bientôt », sans prix ni bouton de déblocage
    Et la voie Ombre montre Brume (rang 1, 30 Éclats) puis Frappe furtive, marquée « Bientôt », sans prix ni bouton de déblocage

  @ui
  Scénario: Débloquer un pouvoir de rang 1
    Étant donné le joueur a 50 Éclats disponibles
    Quand il débloque Représailles dans l'arbre de la Sentinelle
    Alors il a 20 Éclats disponibles
    Et Représailles est marqué débloqué dans l'arbre
    Et le pied de la tour affiche lui aussi 20 Éclats disponibles

  @session
  Scénario: Payer exactement le prix
    Étant donné le joueur a 30 Éclats disponibles
    Quand il débloque Entaille dans l'arbre de l'Errante
    Alors il a 0 Éclat disponible

  @domain
  Scénario: Le rang 2 est verrouillé tant que le rang 1 de sa voie ne l'est pas
    Étant donné le joueur a 200 Éclats disponibles et n'a pas débloqué Représailles
    Alors Tenir bon est affiché verrouillé, ne peut pas être débloqué
    Et il indique qu'il faut d'abord débloquer Représailles

  @session
  Scénario: Débloquer un rang 2
    Étant donné le joueur a débloqué Représailles et a 60 Éclats disponibles
    Quand il débloque Tenir bon
    Alors il a 0 Éclat disponible et Tenir bon est débloqué

  @ui
  Scénario: Pas assez d'Éclats
    Étant donné le joueur a débloqué Représailles et a 40 Éclats disponibles
    Alors Tenir bon (60 Éclats) est affiché mais ne peut pas être débloqué
    Et il indique « Il manque 20 Éclats »

  @session
  Scénario: Un pouvoir ne se débloque qu'une fois et n'est jamais perdu
    Étant donné le joueur a débloqué Représailles
    Quand le héros tombe, que le joueur abandonne, que l'application est fermée de force ou que le jour change
    Alors Représailles est toujours débloqué, sans pouvoir être racheté, et les Éclats disponibles sont inchangés

  @ui
  Scénario: Une frappe de pouvoir « Bientôt »
    Étant donné le joueur a 200 Éclats disponibles
    Quand il touche Coup de bouclier dans l'arbre de la Sentinelle
    Alors sa fiche s'ouvre, avec son nom complet « Coup de bouclier », et dit qu'il n'est pas encore disponible
    Et elle ne propose pas de le débloquer

  @domain
  Scénario: Le pouvoir de base ne s'achète pas
    Étant donné n'importe quel nombre d'Éclats disponibles
    Alors le Rempart et Pas de l'ombre sont possédés d'office, sans prix, et ne peuvent être ni achetés ni vendus

  @ui
  Scénario: L'achat échoue
    Étant donné l'enregistrement de l'achat échoue
    Quand le joueur débloque Brume
    Alors un message dit que l'achat n'a pas pu être enregistré
    Et les Éclats ne sont pas dépensés, Brume n'est pas débloquée et le joueur peut réessayer

  @session
  Scénario: Le prix ne dépend de rien
    Étant donné une jauge en malédiction forte
    Quand le joueur ouvre l'arbre de pouvoirs au camp
    Alors les prix sont 30 Éclats au rang 1 et 60 Éclats au rang 2
    Et il peut débloquer ce que ses Éclats disponibles permettent

  @session
  Scénario: Les pouvoirs et les déblocages du Gardien partagent les mêmes Éclats
    Étant donné le joueur a 50 Éclats disponibles
    Quand il débloque Représailles (30), puis l'Épieu de chasse (20) chez le Gardien de la flamme
    Alors il a 0 Éclat disponible, au camp comme au pied de la tour

  # --- Les pouvoirs équipés ---

  @ui
  Scénario: Un pouvoir débloqué s'équipe tout seul
    Étant donné le joueur a débloqué Représailles et aucune ascension n'est en cours
    Quand il commence une ascension et choisit la Sentinelle
    Alors la carte de la Sentinelle du Choix du héros montre ses pouvoirs équipés : Rempart, puis Représailles
    Et il n'a rien à choisir

  @ui
  Scénario: Sans pouvoir débloqué, rien ne change
    Étant donné le joueur n'a débloqué aucun pouvoir pour l'Errante
    Quand il commence une ascension avec l'Errante
    Alors son seul pouvoir équipé est Pas de l'ombre
    Et en combat, il a une seule touche de pouvoir à côté d'« Attaquer », comme aujourd'hui

  @session
  Scénario: Un déblocage pendant une ascension compte dès la suivante
    Étant donné une ascension en cours avec la Sentinelle, qui n'a que le Rempart
    Quand le joueur débloque Représailles au camp
    Alors l'arbre indique « Dès ta prochaine ascension »
    Et l'ascension en cours garde le Rempart seul jusqu'à sa fin
    Et l'ascension suivante avec la Sentinelle équipe le Rempart et Représailles

  @session
  Scénario: Les pouvoirs équipés sont fixés au départ de l'ascension
    Étant donné une ascension lancée avec la Sentinelle équipée du Rempart et de Représailles
    Quand le joueur met l'ascension en pause et la reprend, même un autre jour, après avoir débloqué Tenir bon
    Alors elle a toujours le Rempart et Représailles, et pas Tenir bon

  @session
  Scénario: Une ascension d'avant la mise à jour
    Étant donné une ascension sauvegardée avant cette story
    Quand le joueur la reprend après avoir débloqué Représailles
    Alors le héros n'a que son pouvoir de base jusqu'à la fin de cette ascension

  @ui
  Scénario: Les pouvoirs équipés dans l'Équipement
    Étant donné une ascension en cours avec l'Errante équipée de Pas de l'ombre, Entaille et Brume
    Quand le joueur ouvre la feuille de l'Équipement
    Alors il y voit ses 3 pouvoirs équipés, avec leur icône, leur coût en Élan et leur effet

  # --- Le combat à 1 à 3 touches de pouvoir ---

  @ui
  Scénario: Trois touches de pouvoir sur la rangée d'« Attaquer »
    Étant donné l'Errante équipée de Pas de l'ombre, Entaille et Brume, sur un écran de 360 dp de large
    Quand c'est la phase du héros
    Alors une seule rangée montre, dans l'ordre de l'arbre : Pas de l'ombre, Entaille, Brume, puis « Attaquer »
    Et la zone des touches garde sa hauteur de 112 dp
    Et chaque touche de pouvoir dit son coût en Élan, et « Instantané » pour un pouvoir instantané

  @ui
  Scénario: L'effet d'un pouvoir au toucher maintenu
    Étant donné la phase du héros
    Quand le joueur maintient le doigt sur la touche de Représailles
    Alors son effet court s'affiche
    Et Représailles n'est pas lancé, même si le doigt est relâché sur la touche

  @ui
  Scénario: Un pouvoir trop cher
    Étant donné la Sentinelle a 2 Élan et Tenir bon équipé
    Alors la touche de Tenir bon est visible mais indisponible et dit qu'il manque 1 Élan

  @domain
  Scénario: Un seul pouvoir instantané par phase du héros
    Étant donné l'Errante équipée de Pas de l'ombre, Entaille et Brume, avec 5 Élan
    Quand elle lance Entaille
    Alors Pas de l'ombre et Brume sont indisponibles jusqu'à la fin de cette phase du héros
    Et le joueur choisit son action, « Attaquer »

  # Représailles
  @domain
  Scénario: Représailles renforce la prochaine contre-attaque
    Étant donné la Sentinelle avec 2 Élan lance Représailles, un pouvoir instantané
    Quand elle pare parfaitement tous les impacts d'un coup ennemi
    Alors sa contre-attaque retire 200 % des PV et 200 % de la garde d'une contre-attaque ordinaire, en un seul calcul
    Et Représailles est consommé

  @domain
  Scénario: Représailles attend sa contre-attaque
    Étant donné Représailles est actif
    Quand le Rempart s'use et déclenche la Riposte du Rempart, ou qu'une double frappe n'est parée parfaitement qu'à moitié
    Alors Représailles reste actif
    Et sa touche reste indisponible tant qu'il est actif

  @ui
  Scénario: Le Rempart et Représailles en même temps
    Étant donné la Sentinelle a le Rempart actif
    Quand elle lance Représailles dans une phase du héros suivante
    Alors les deux sont actifs ensemble, chacun avec son étiquette sous les PV

  @domain
  Scénario: Une charge est perdue en fin de combat
    Étant donné Représailles ou Brume est encore actif quand le combat est gagné
    Alors il est perdu et n'est pas actif au combat suivant

  # Tenir bon
  @domain
  Scénario: Tenir bon rend des PV
    Étant donné la Sentinelle a 80 PV max, 30 PV, 3 Élan, 2 charges de Brûlure et un Saignement
    Quand elle lance Tenir bon
    Alors elle a 46 PV et 0 Élan
    Et la Brûlure est éteinte et le Saignement arrêté
    Et c'est son action de la phase du héros

  @domain
  Scénario: Tenir bon ne dépasse pas le maximum
    Étant donné la Sentinelle a 80 PV max et 75 PV
    Quand elle lance Tenir bon
    Alors elle a 80 PV

  @domain
  Scénario: Tenir bon une fois par combat
    Étant donné la Sentinelle a déjà lancé Tenir bon dans ce combat, même à PV max
    Alors la touche de Tenir bon reste indisponible jusqu'à la fin du combat, quel que soit son Élan
    Et au combat suivant, elle peut de nouveau le lancer

  # Entaille
  @domain
  Scénario: Entaille renforce le Brise-garde de la prochaine frappe en rythme
    Étant donné l'Errante avec 1 Élan lance Entaille
    Quand elle attaque ensuite
    Alors chacun des coups de sa frappe en rythme retire 150 % de son Brise-garde, en un seul calcul
    Et Entaille est consommée par cette frappe

  @domain
  Scénario: Entaille ne touche pas les contre-attaques
    Étant donné Entaille est active
    Quand une contre-attaque ou une contre-attaque de Pas de l'ombre frappe avant la prochaine frappe en rythme
    Alors cette contre-attaque retire sa garde habituelle et Entaille reste active

  # Brume
  @domain
  Scénario: Brume divise par deux le prochain impact qui fait des dégâts
    Étant donné l'Errante avec 2 Élan lance Brume, un pouvoir instantané
    Quand un impact ennemi de 10 lui fait des dégâts
    Alors cet impact ne lui retire que 5 PV
    Et Brume est consommée, sans riposte

  @domain
  Scénario: Brume ne s'use pas sans dégâts
    Étant donné Brume est active
    Quand l'Errante esquive ou pare parfaitement un impact
    Alors Brume reste active

  @domain
  Scénario: Brume ne réduit ni la Brûlure ni le Saignement
    Étant donné Brume est active et l'Errante a 2 charges de Brûlure
    Quand la manche commence
    Alors l'Errante perd 2 PV et Brume reste active
