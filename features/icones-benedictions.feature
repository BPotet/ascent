# language: fr
Fonctionnalité: Les icônes des bénédictions de départ
  Le joueur voit l'icône de chaque famille de bénédiction quand il choisit ses bénédictions de
  départ, avec sa rareté en losanges, et retrouve en bas, sous les boutons, celles déjà choisies,
  pour reconnaître d'un regard ce que ses habitudes d'hier lui ont rapporté (#158, maquette validée
  `docs/mockups/153-boon-blessing-icons/`, écrans 3A à 3D).

  # Les écrans sont rendus par `AscentScreen`, sur une ascension sauvegardée, avec la simulation de
  # `SpriteCanvas`, qui donne le nom, l'échelle et la taille en pixels d'art de chaque icône. Les
  # captures end-to-end passent par la planche des icônes (`e2e/flows/blessing-icons.yaml`).

  Scénario: Chaque bouton de bénédiction porte l'icône de sa famille
    Étant donné le joueur a fait hier 3 habitudes et vient de choisir son héros
    Et l'écran « Bénédiction 1 sur 3 » propose Hâte, Vigueur et Tranchant en rareté Rare
    Alors chaque bouton montre l'icône de bénédiction de sa famille à 48 dp, dans un écrin au trait de la couleur Rare
    Et il montre ensuite le nom de la famille, « ◆◆ Rare » sur sa propre ligne et dans la couleur de la rareté, puis l'effet
    Et chaque bouton fait au moins 72 dp de haut

  Scénario: Un seul toucher choisit la bénédiction, comme aujourd'hui
    Étant donné l'écran « Bénédiction 1 sur 3 »
    Quand le joueur touche le bouton Hâte
    Alors la Hâte est choisie sans autre confirmation
    Et l'écran « Bénédiction 2 sur 3 » s'affiche

  Scénario: Les bénédictions déjà choisies restent visibles en pastilles
    Étant donné le joueur a choisi la Hâte en rareté Rare
    Quand l'écran « Bénédiction 2 sur 3 » s'affiche en rareté Commune
    Alors la section « Déjà choisie » montre une pastille d'équipement Hâte, avec son icône, son nom et « ◆◆ Rare »
    Et les trois familles proposées excluent la Hâte

  Scénario: Deux bénédictions déjà choisies, de raretés différentes
    Étant donné le joueur a choisi la Hâte (Rare) puis la Vigueur (Commune)
    Quand l'écran « Bénédiction 3 sur 3 » s'affiche en rareté Épique
    Alors la section « Déjà choisies » montre la Hâte avec « ◆◆ Rare » et la Vigueur avec « ◆ Commune »
    Et chaque écrin a le trait de la couleur de sa rareté
    Et Élan, Tranchant et Protection sont proposés avec « ◆◆◆ Épique »

  Scénario: Une famille garde la même icône à toutes les raretés
    Étant donné la famille Protection est proposée en Commune, puis en Épique dans une autre ascension
    Alors l'icône affichée est la même
    Et seuls le trait de l'écrin, les losanges, le mot et la couleur de la rareté changent

  Scénario: Limite : une seule bénédiction
    Étant donné le joueur n'a fait qu'une habitude hier
    Quand l'écran « Bénédiction 1 sur 1 » s'affiche
    Alors il montre trois boutons à icône et aucune section « Déjà choisie »
    Et une icône 16 × 16 (Élan, Vigueur) et une icône 24 × 24 (Protection) ont la même taille de 48 dp

  Scénario: Limite : aucune bénédiction
    Étant donné la jauge est Neutre ou en Malédiction, ou l'ascension est une reprise
    Quand le joueur commence ou reprend l'ascension
    Alors l'écran de choix d'une bénédiction ne s'affiche pas, comme aujourd'hui

  Scénario: Accessibilité : le texte lu ne change pas
    Étant donné un bouton de bénédiction
    Alors l'icône est cachée au lecteur d'écran
    Et le bouton est lu « Hâte · Rare · Initiative +2 dans chaque combat »
    Et la section « Déjà choisie » est lue d'un trait comme une liste
