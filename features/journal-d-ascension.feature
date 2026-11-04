# language: fr
Fonctionnalité: Exporter le journal du parcours de mes ascensions
  Story #196 (épique #193) : le Journal d'ascension, sa conservation, son format versionné, l'export
  et les deux points d'accès, dans le build de preview seulement.

  # Les scénarios `@session` passent par une vraie session d'ascension, le vrai enregistreur du
  # journal et le vrai stockage des journaux, sur un Stockage clé-valeur en mémoire (« fermée de force
  # puis rouverte » : une nouvelle session sur le même stockage), avec un Menu de partage simulé qui
  # garde le fichier. Les scénarios `@ui` passent en plus par l'écran de fin ou le Pied de la tour.

  Contexte:
    Étant donné l'app installée depuis le build de preview

  @ui
  Scénario: Exporter depuis l'écran de fin après une chute
    Étant donné une ascension avec la Sentinelle, sous une Jauge « Faveur »
    Et le héros tombé au combat d'étage de l'étage 4 du palier 2
    Quand je touche « Exporter le journal » sur l'écran de fin de l'ascension
    Alors le menu de partage d'Android s'ouvre avec un fichier JSON
    Et le fichier porte la version du format et la version de l'app
    Et le journal de cette ascension indique la fin « chute », l'étage 4, le palier 2 et le combat d'étage de la chute

  @session
  Scénario: Le journal raconte le parcours d'une ascension
    Étant donné une ascension terminée au Sommet
    Quand j'exporte le journal
    Alors son journal contient la date, la graine de l'ascension, le héros, l'état de la Jauge et l'équipement de base
    Et les bénédictions de départ proposées et choisies, par leur famille et leur rareté
    Et pour chaque étage : son numéro, son palier, les sorties proposées, la sortie prise, les PV et l'Élan du héros à l'entrée et à la sortie
    Et l'Or gagné, les bienfaits proposés et choisis, les objets trouvés et s'ils ont été équipés ou laissés, les Éclats gagnés
    Et chaque passage de palier
    Et la fin « Sommet »

  @session
  Scénario: Les bénédictions de départ ne révèlent aucune habitude
    Étant donné une ascension commencée avec une bénédiction de départ « Vigueur » Rare, venue de l'habitude « Me faire à manger »
    Quand j'exporte le journal
    Alors le fichier contient la famille « Vigueur » et la rareté « Rare »
    Et le fichier ne contient ni le nom d'une habitude, ni un suivi, ni l'expérience du personnage

  @ui
  Scénario: Exporter depuis le Pied de la tour, ascension en cours
    Étant donné une ascension en cours, en pause à l'étage 3 du palier 1
    Quand je touche « Exporter le journal » en bas du Pied de la tour
    Alors le fichier contient le journal de cette ascension jusqu'à sa dernière sauvegarde, marqué « en cours », sans fin
    Et après l'export, « Reprendre l'ascension » reprend l'ascension là où elle en était
    Et le journal continue à s'écrire à la reprise

  @session
  Scénario: Exporter après un abandon
    Étant donné une ascension abandonnée à l'étage 2 du palier 1, après confirmation
    Quand je touche « Exporter le journal » sur l'écran de fin de l'ascension
    Alors le journal de cette ascension indique la fin « abandon », l'étage 2 et le palier 1

  @session
  Scénario: Au-delà de 20 ascensions, les plus anciennes sont effacées
    Étant donné 20 ascensions déjà gardées dans le journal
    Quand je commence une 21ᵉ ascension
    Alors la plus ancienne des 20 est effacée
    Et l'export contient exactement 20 ascensions, dont celle qui vient de commencer

  @ui
  Scénario: Journal vide
    Étant donné que je n'ai jamais commencé d'ascension
    Quand j'arrive au Pied de la tour
    Alors le bouton « Exporter le journal » est grisé et indisponible
    Et la ligne « Aucune ascension dans le journal pour l'instant. » s'affiche sous le bouton
    Et le menu de partage ne peut pas s'ouvrir

  @session
  Scénario: App fermée de force pendant un combat
    Étant donné une ascension en cours, sauvegardée pendant un combat à l'étage 3
    Quand l'app est fermée de force, puis rouverte
    Et que je reprends l'ascension et la termine
    Alors son journal garde tout le parcours jusqu'à la dernière sauvegarde, puis le continue sans trou ni doublon d'étage
    Et l'export ne contient qu'un seul journal pour cette ascension

  @ui
  Scénario: Partage annulé
    Étant donné le menu de partage ouvert par « Exporter le journal »
    Quand je ferme le menu de partage sans choisir d'application
    Alors je reviens sur l'écran d'où je suis parti, sans message d'erreur
    Et le journal est inchangé et peut être exporté de nouveau

  @ui
  Scénario: Un journal d'une version de format inconnue est ignoré
    Étant donné un journal d'ascension gardé avec une version du format que l'app ne connaît pas, ou abîmé
    Quand je commence ou reprends une ascension
    Alors l'ascension se joue normalement
    Et à l'export, ce journal est laissé de côté et le fichier signale le nombre de journaux ignorés
    Et la ligne dorée « 1 ascension illisible laissée de côté. » s'affiche sous le bouton

  @ui
  Scénario: Pas d'export dans le build de production
    Étant donné l'app installée depuis le build de production
    Quand j'arrive sur l'écran de fin de l'ascension ou au Pied de la tour
    Alors aucun bouton « Exporter le journal » n'apparaît
