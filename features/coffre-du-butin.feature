# language: fr
Fonctionnalité: Le coffre du butin
  Story #227 (épique #208, coffres et clés) : l'objet trouvé, celui de la Chance d'objet après un
  combat ordinaire ou l'objet garanti de l'Élite, apparaît dans un Coffre qui s'ouvre tout seul
  (600 ms, passable d'un toucher). Habillage seulement : aucune règle de jeu ne change (CH1).

  # Les scénarios `@ui` montent le vrai écran de l'ascension (`AscentScreen`) sur une vraie session,
  # le combat gagné dans l'écran ; le scénario `@domain` rejoue les marches figées du palier 1.

  @ui
  Scénario: Le coffre s'ouvre tout seul après un combat ordinaire (CH1)
    Étant donné un combat ordinaire gagné dont la chance d'objet donne la Hache rouillée
    Quand l'écran de l'objet trouvé s'affiche
    Alors un coffre apparaît fermé et s'ouvre tout seul, en 600 ms environ
    Et la Hache rouillée apparaît, comparée à l'objet que porte le héros, avec « Laisser » et « Équiper »

  @ui
  Scénario: L'objet garanti de l'Élite est aussi dans un coffre (CH1)
    Quand le héros bat une Élite
    Alors son objet garanti apparaît dans un coffre qui s'ouvre tout seul
    Et sa rareté se lit comme avant (Rare, ou Épique en losanges, au mot et à la couleur)

  @ui
  Scénario: Un toucher passe l'animation
    Étant donné le coffre est en train de s'ouvrir
    Quand le joueur touche l'écran
    Alors le coffre est ouvert tout de suite et l'objet est affiché
    Et ce toucher n'équipe ni ne laisse l'objet

  @ui
  Scénario: Pas d'objet, pas de coffre (CH1)
    Étant donné un combat ordinaire gagné où la chance d'objet ne donne rien
    Alors aucun coffre n'apparaît et l'offre de bienfaits s'affiche, comme avant
    Et au boss ou au Feu de camp, aucun coffre n'apparaît non plus

  @domain
  Scénario: Les tirages ne changent pas (CH1)
    Étant donné deux ascensions de même graine, aux mêmes choix, l'une en v0.4.0 et l'autre avec le coffre
    Alors les objets trouvés, leurs raretés, l'Or, les portes et les offres de bienfaits sont les mêmes

  @ui
  Scénario: La reprise ne rejoue pas l'ouverture
    Étant donné le joueur voit un objet trouvé dans un coffre ouvert
    Quand il ferme l'application et reprend l'ascension
    Alors il retrouve le même objet, dans le coffre déjà ouvert, sans animation

  @ui
  Scénario: Mouvement réduit
    Étant donné le mouvement réduit est activé
    Quand l'écran de l'objet trouvé s'affiche
    Alors le coffre ne bouge pas : il est montré ouvert, l'objet en fondu

  @ui
  Scénario: Lecteur d'écran
    Quand l'écran de l'objet trouvé s'affiche avec le lecteur d'écran
    Alors il annonce « Coffre ouvert », puis le nom de l'objet, sa rareté et son effet
    Et les boutons « Laisser » et « Équiper » sont lus comme avant
