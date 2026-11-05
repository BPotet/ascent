# language: fr
Fonctionnalité: Assombrir la scène et la Frise d'action pendant la phase ennemie
  Story #188 (épique #170) : pendant la phase ennemie, un voile d'encre assombrit la scène et la
  Frise d'action pâlit, sauf l'ennemi qui agit (maquettes 170 et 174 v2, décision du 03/11/2026).

  # Les scénarios passent par le vrai écran de l'ascension, sur une vraie session d'ascension, un
  # Stockage clé-valeur en mémoire et l'horloge de combat manuelle. Le combat est sauvegardé puis
  # repris par l'écran. Les canevas Skia du fond et de la scène sont simulés sous Jest.

  Contexte:
    Étant donné un combat de l'ascension, sur le fond de palier de son palier

  Scénario: La scène s'assombrit en phase ennemie
    Étant donné la phase du héros
    Quand la phase ennemie commence et que l'en-tête affiche « Phase ennemie »
    Alors un voile d'encre (#06070C) à 38 % couvre tout le cadre de la scène
    Et le fond de palier de la scène est assombri par ce voile
    Et le voile apparaît au même instant que « Phase ennemie » dans l'en-tête, sans fondu

  Scénario: La Frise d'action s'assombrit en phase ennemie
    Étant donné la phase ennemie, un ennemi qui agit
    Alors le portrait de l'ennemi qui agit reste en grand, à pleine lumière, avec son cadre et sa flèche d'or
    Et les autres cases de la manche, celle du héros comprise, passent à 45 % de luminosité et 60 % de saturation
    Et les cases de l'aperçu de la manche suivante passent à 32 % de luminosité et 50 % de saturation
    Et « suiv. » garde son aspect actuel

  Scénario: Retour en phase du héros
    Étant donné la phase ennemie, la scène voilée et la frise assombrie
    Quand la phase du héros commence et que l'en-tête affiche « Phase du héros »
    Alors le voile de la scène disparaît, au même instant, sans fondu
    Et la Frise d'action reprend son aspect de la phase du héros (aperçu à 62 % de luminosité et 70 % de saturation, comme aujourd'hui)

  Scénario: Rien d'utile n'est caché par le voile
    Étant donné la phase ennemie et un ennemi qui prépare un coup imparable
    Alors les ennemis, leurs plaques (nom, PV, garde), leurs intentions et le héros sont au-dessus du voile, sans assombrissement
    Et la préparation, la palette rouge, le sceau et le reflet de l'ennemi qui agit se voient comme aujourd'hui
    Et les chiffres de dégâts, les mots de scène, les étincelles de parade, l'annonce de phase et la bulle d'aide du combat sont au-dessus du voile
    Et l'indicateur « Phase ennemie », la barre du héros et la zone d'action (Esquive, Parade) ne sont pas voilés
    Et le joueur peut parer ou esquiver dans la fenêtre de parade exactement comme avant

  Scénario: Le voile ne déborde pas quand la scène tremble
    Étant donné la phase ennemie
    Quand un coup touche le héros et que la scène tremble
    Alors aucune bande de fond non voilée n'apparaît au bord de la scène
    Et le voile ne couvre ni l'en-tête, ni la Frise d'action, ni la barre du héros

  Scénario: Mouvement réduit
    Étant donné le mouvement réduit activé dans le réglage système
    Quand la phase change
    Alors le voile et l'assombrissement de la frise apparaissent et disparaissent de la même façon, d'un coup
    Et le voile reste fixe

  Scénario: Le lecteur d'écran est inchangé
    Étant donné le lecteur d'écran actif, en phase ennemie
    Alors le voile n'est ni lu ni focalisable
    Et la Frise d'action est lue avec la même phrase qu'aujourd'hui, sans mention de l'assombrissement
    Et l'annonce de phase au lecteur d'écran est inchangée

  Scénario: Combat repris
    Étant donné un combat de l'ascension mis en pause puis repris
    Quand l'écran de combat s'affiche de nouveau
    Alors le voile et l'assombrissement de la frise suivent la phase affichée dans l'en-tête, sans animation
    Et le fond de palier est le même qu'avant la pause

  Scénario: Fin du combat
    Étant donné la phase ennemie
    Quand le combat se termine (victoire ou défaite)
    Alors l'écran de fin s'affiche comme aujourd'hui, sans voile de phase ennemie

  Scénario: Fond de palier absent
    Étant donné que le fond de palier ne peut pas être dessiné (repli sur la nuit)
    Quand la phase ennemie commence
    Alors le voile assombrit la nuit de la scène de la même façon, sans erreur
