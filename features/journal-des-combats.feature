# language: fr
Fonctionnalité: Le journal raconte mes combats
  Story #197 (épique #193) : dans le Journal d'ascension, chaque combat d'étage, manche par manche,
  avec chaque appui, son écart et son jugement tels que le moteur les a rendus, les effets et les
  durées hors pause. La version du format de l'Export du journal passe à 2.

  # Les scénarios passent par une vraie session d'ascension, le vrai enregistreur du journal et le
  # vrai stockage des journaux, sur un Stockage clé-valeur en mémoire, avec un Menu de partage simulé
  # qui garde le fichier. Le combat d'étage est commencé par la session et joué appui par appui sur
  # l'horloge de combat manuelle : chaque appui est daté par rapport à l'impact qu'il vise. Le
  # scénario `@ui` passe en plus par le Pied de la tour.

  Contexte:
    Étant donné l'app installée depuis le build de preview

  Scénario: Une parade parfaite est notée avec son écart
    Étant donné un combat d'étage contre un ennemi qui annonce l'intention Attaque
    Quand je touche « Parade » 40 ms avant l'impact
    Et que j'exporte le journal
    Alors l'action de cet ennemi porte son intention tirée
    Et l'appui est noté avec l'écart −40 ms et le jugement « parade parfaite »

  Scénario: Les frappes en rythme sont notées avec leur jugement
    Étant donné un combat d'étage
    Quand je fais trois frappes en rythme : « Frapper » 20 ms après l'impact, 120 ms avant l'impact, puis aucun appui
    Et que j'exporte le journal
    Alors les trois frappes sont notées « frappe parfaite » (+20 ms), « bonne frappe » (−120 ms) et « sans bonus » (sans appui)
    Et les dégâts infligés en PV et en garde sont notés pour chacune

  Scénario: Les appuis ratés sont notés trop tôt, trop tard ou dans le vide
    Étant donné un combat d'étage
    Quand je touche « Parade » 200 ms avant un impact
    Et que, plus tard, hors déséquilibre, je touche « Esquive » sans impact à juger
    Alors le journal note un appui raté « trop tôt » avec l'écart −200 ms, et un appui raté « dans le vide » sans écart
    Et le coup subi qui suit est noté avec ses dégâts

  Scénario: Les appuis ignorés sont comptés
    Étant donné le héros en déséquilibre après un appui raté
    Quand je touche « Parade » pendant le déséquilibre
    Alors le journal compte un appui ignoré, avec sa cause « déséquilibre »

  Scénario: Le combat est raconté de bout en bout
    Étant donné un combat d'étage contre un boss du palier 2, qui change de phase et invoque des ennemis
    Quand je le gagne et que j'exporte le journal
    Alors le combat contient les ennemis avec leur palier et leurs PV, garde, Initiative et multiplicateur de palier au début
    Et chaque manche, dans l'ordre d'action, avec les actions du héros et des ennemis
    Et le changement de phase, l'invocation et les renforts
    Et les cassures de garde, les ennemis étourdis, les actions perdues, les contre-attaques, les ripostes du Rempart, le Saignement, la Brûlure, les pouvoirs utilisés, les ennemis vaincus et ceux qui se relèvent seuls
    Et la durée de chaque manche et du combat

  Scénario: Les durées ne comptent pas les pauses
    Étant donné une manche commencée depuis 5 s
    Quand j'ouvre la feuille de l'Équipement pendant 30 s, puis la ferme
    Et que la manche finit 4 s plus tard
    Alors la durée de la manche notée est d'environ 9 s, sans les 30 s de pause

  Scénario: App fermée de force pendant un combat
    Étant donné un combat en cours, sauvegardé après un impact jugé
    Quand l'app est fermée de force, puis rouverte, et que je reprends l'ascension
    Alors le journal garde les appuis et les actions jusqu'à la dernière sauvegarde
    Et l'impact déjà jugé n'est noté qu'une fois
    Et la reprise est notée dans le combat, qui continue dans le même journal
    Et le temps passé app fermée ne compte pas dans les durées

  @ui
  Scénario: Exporter pendant une ascension en cours, en plein combat
    Étant donné une ascension en pause pendant un combat
    Quand je touche « Exporter le journal » en bas du Pied de la tour
    Alors le combat en cours figure dans le fichier jusqu'à la dernière sauvegarde, marqué « en cours »

  Scénario: La version du format augmente sans perdre les anciens journaux
    Étant donné des journaux d'ascension écrits avant cette story, sans détail des combats
    Quand j'installe cette version, joue une ascension et exporte le journal
    Alors le fichier porte la nouvelle version du format
    Et les anciens journaux y figurent encore, avec leur parcours et sans détail des combats, marqués de leur version du format

  Scénario: Le journal ne ralentit pas le combat
    Étant donné un combat d'étage
    Quand je joue des parades et des frappes en rythme
    Alors l'écart noté de chaque appui est celui que le moteur a jugé
    Et le combat, ses sons et ses animations ne marquent aucun arrêt quand le journal s'écrit

  Scénario: Partage annulé
    Étant donné le menu de partage ouvert par « Exporter le journal »
    Quand je le ferme sans choisir d'application
    Alors le journal, combats compris, est inchangé et peut être exporté de nouveau
