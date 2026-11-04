# language: fr
Fonctionnalité: Le camp et le Gardien de la flamme
  Story #40 (épique #194) : au Camp, le Gardien de la flamme vend pour de bon l'Épieu de chasse, la
  Clochette du guet, Cœur de braise et la Flamberge, contre des Éclats. Les Éclats disponibles sont
  le Total d'Éclats moins les prix payés ; le Total d'Éclats ne baisse jamais (ADR 0017).

  # Les scénarios `@domain` éprouvent les règles du domaine ; les scénarios `@session` passent par
  # une vraie session d'ascension et une vraie session du camp sur un Stockage clé-valeur en mémoire
  # (« fermeture forcée » : de nouvelles sessions sur le même stockage) ; les scénarios `@ui` passent
  # aussi par les vrais écrans (le camp, le pied de la tour, la fin de l'ascension) et, pour quitter
  # le camp, par les vraies routes de l'app.

  @ui
  Scénario: Première visite du camp
    Étant donné le joueur n'a encore rien débloqué et a gagné 22 Éclats
    Quand il ouvre le camp depuis le pied de la tour
    Alors il voit le Gardien de la flamme et « 22 Éclats disponibles »
    Et le catalogue montre, par prix croissant : Épieu de chasse (20), Clochette du guet (40), Cœur de braise (80) et Flamberge (80)

  @ui
  Scénario: Débloquer un objet
    Étant donné le joueur a 50 Éclats disponibles
    Quand il débloque la Clochette du guet
    Alors il a 10 Éclats disponibles
    Et la carte de la Clochette du guet affiche « Déjà dans la tour »

  @domain
  Scénario: Payer exactement le prix
    Étant donné le joueur a 80 Éclats disponibles
    Quand il débloque la Flamberge
    Alors il a 0 Éclat disponible

  @ui
  Scénario: Pas assez d'Éclats
    Étant donné le joueur a 60 Éclats disponibles
    Alors la carte de la Flamberge est affichée mais ne peut pas être achetée
    Et elle indique « Il manque 20 Éclats »

  @ui
  Scénario: Un déblocage ne s'achète qu'une fois
    Étant donné le joueur a déjà débloqué l'Épieu de chasse
    Alors sa carte affiche « Déjà dans la tour », sans pouvoir le racheter

  @ui
  Scénario: Tout le catalogue
    Étant donné le joueur a gagné 220 Éclats en tout
    Quand il débloque les 4 contenus du Gardien de la flamme
    Alors il a 0 Éclat disponible et toutes les cartes affichent « Déjà dans la tour »

  @ui
  Scénario: L'achat échoue
    Étant donné l'enregistrement de l'achat échoue
    Quand le joueur débloque l'Épieu de chasse
    Alors un message dit que l'achat n'a pas pu être enregistré
    Et les Éclats ne sont pas dépensés, l'Épieu de chasse n'est pas débloqué et le joueur peut réessayer

  @session
  Scénario: Un achat pendant une ascension compte dès la suivante
    Étant donné une ascension en cours et 80 Éclats disponibles
    Quand le joueur débloque la Flamberge au camp
    Alors la carte indique « Dès ta prochaine ascension »
    Et l'ascension en cours ne peut jamais donner la Flamberge
    Et l'ascension suivante peut la donner sur une Élite

  @session
  Scénario: Le déblocage entre dans la tour à l'ascension suivante
    Étant donné le joueur a débloqué Cœur de braise et aucune ascension n'est en cours
    Quand il commence une ascension
    Alors cette ascension peut proposer Cœur de braise après une Élite

  @session
  Scénario: Un déblocage n'est jamais perdu
    Étant donné le joueur a débloqué la Clochette du guet
    Quand le héros tombe, que le joueur abandonne, que l'application est fermée de force ou que le jour change
    Alors la Clochette du guet est toujours débloquée et les Éclats disponibles sont inchangés

  @domain
  Scénario: Le prix ne dépend de rien
    Étant donné une jauge en malédiction forte
    Quand le joueur ouvre le camp
    Alors le camp est accessible et les prix sont 20, 40, 80 et 80 Éclats
    Et il peut acheter ce que ses Éclats disponibles permettent

  @session
  Scénario: Les Éclats gagnés après un achat
    Étant donné le joueur a 10 Éclats disponibles après un achat
    Quand il bat le boss du palier 1 (8 Éclats)
    Alors il a 18 Éclats disponibles

  @ui
  Scénario: Le pied de la tour montre les Éclats disponibles
    Étant donné le joueur a gagné 82 Éclats en tout et a débloqué l'Épieu de chasse (20)
    Quand il ouvre le pied de la tour
    Alors il y voit 62 Éclats disponibles, le même nombre qu'au camp, et jamais 82

  @ui
  Scénario: Sans déblocage, le pied de la tour ne change pas
    Étant donné le joueur a gagné 22 Éclats en tout et n'a rien débloqué
    Quand il ouvre le pied de la tour
    Alors il y voit « 22 Éclats », comme aujourd'hui

  @ui
  Scénario: Le bilan de fin garde le Total d'Éclats
    Étant donné le joueur a gagné 82 Éclats en tout et en a dépensé 20 au camp
    Quand son ascension se termine par une chute sans avoir gagné d'Éclat
    Alors le bilan de fin affiche « Total : 82 Éclats »
    Et le pied de la tour affiche ensuite 62 Éclats disponibles

  @ui
  Scénario: Aller au camp depuis la fin d'une ascension
    Étant donné une ascension qui se termine par une chute, un abandon ou le Sommet
    Quand l'écran de fin s'affiche
    Alors il propose « Retour au pied de la tour » et, dessous, le bouton secondaire « Aller au camp »
    Et « Aller au camp » ouvre le camp, où aucune ascension n'est plus en cours

  @ui
  Scénario: Quitter le camp ouvert depuis la fin d'une ascension
    Étant donné le joueur a ouvert le camp avec « Aller au camp »
    Quand il quitte le camp, par ‹ ou par le geste retour
    Alors il arrive au pied de la tour, jamais de nouveau sur l'écran de fin
