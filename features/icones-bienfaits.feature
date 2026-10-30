# language: fr
Fonctionnalité: Les icônes des bienfaits dans le choix d'un bienfait et aux sorties
  Le joueur voit l'icône de chaque bienfait quand il le choisit, quand il l'obtient et dans la liste
  de ses bienfaits aux sorties, pour reconnaître d'un coup d'œil ce qu'on lui propose et ce qu'il a
  déjà (#157, maquette validée `docs/mockups/153-boon-blessing-icons/`, écrans 1A à 2D).

  # Les écrans sont rendus avec les vrais composants (`BoonChoicePanel`, `ExitChoice`) et la
  # simulation de `SpriteCanvas`, qui donne le nom, l'échelle et la taille en pixels d'art de chaque
  # icône. « La porte du boss reste visible sans défilement » se vérifie aussi sur la capture
  # end-to-end de la planche des icônes (`e2e/flows/boon-icons.yaml`, capture 2D).

  Scénario: Chaque carte du choix d'un bienfait porte son icône
    Étant donné le joueur vient de gagner un combat qui n'est pas celui du boss
    Et l'écran « Choisis un bienfait » propose Écho parfait, Givre persistant et Cœur de braise
    Alors chaque carte montre à gauche l'icône de bienfait de 48 dp, dans un écrin de 56 dp
    Et le trait de l'écrin a la couleur de la rareté du bienfait
    Et la carte garde, dans cet ordre, « ◆◆ Givre · Rare », le nom et l'effet
    Et « Prendre » reste inactif tant qu'aucune carte n'est choisie

  Scénario: La carte choisie se distingue sans dépendre de la couleur seule
    Étant donné l'écran « Choisis un bienfait »
    Quand le joueur touche la carte Givre persistant
    Alors la carte prend un cadre d'or, une coche et un nom en or
    Et son écrin garde le trait de la rareté Rare
    Et « Prendre » s'active

  Scénario: Le bienfait obtenu montre son icône en grand
    Étant donné le joueur a choisi Givre persistant
    Quand il touche « Prendre »
    Alors l'écran « Bienfait obtenu. » montre l'icône de Givre persistant à 96 dp, dans un écrin doublé au trait de la rareté
    Et la rareté, le nom, l'effet et « Continuer » restent affichés
    Et le lecteur d'écran annonce « Bienfait obtenu : Givre persistant, Givre, Rare » suivi de l'effet

  Scénario: Les bienfaits possédés s'affichent en pastilles aux sorties
    Étant donné le joueur a gagné Écho parfait puis Givre persistant
    Quand l'écran « Choisis ta sortie » s'affiche
    Alors la section « Bienfaits » montre une pastille d'équipement par bienfait, dans l'ordre où ils ont été gagnés
    Et chaque pastille montre l'icône dans un écrin de 52 dp, le nom et la rareté (« ◆ Commun », « ◆◆ Rare »)
    Et les pastilles sont rangées sur 2 colonnes
    Et les bénédictions de départ ne s'y affichent pas
    Et les portes restent à leur place

  Scénario: Limite : aucun bienfait aux sorties
    Étant donné le joueur ne possède aucun bienfait
    Quand l'écran des sorties s'affiche
    Alors la section « Bienfaits » affiche le texte « Aucun bienfait »
    Et aucune pastille vide n'est affichée

  Scénario: Limite : 5 bienfaits à la dernière porte
    Étant donné le joueur possède 5 bienfaits, le maximum
    Quand l'écran « Dernière porte » s'affiche
    Alors les 5 pastilles tiennent sur 2 colonnes et 3 rangs
    Et un nom long passe à la ligne dans sa pastille, sans être coupé
    Et la porte du boss reste visible sans défilement

  Scénario: Limite : une icône 16 × 16 et une icône 24 × 24 ont la même taille
    Étant donné Écho parfait a une icône de 16 × 16 et Givre persistant une icône de 24 × 24
    Alors les deux s'affichent à 48 dp, à ×3 et à ×2
    Et à 96 dp, à ×6 et à ×4
    Et chaque pixel d'art reste entier et carré : jamais rogné, jamais étiré, jamais d'échelle fractionnaire

  Scénario: Limite : les 12 icônes sont celles validées dans l'Atelier
    Étant donné les 12 icônes au statut « validé » dans l'Atelier de l'ascension le 30/10/2026
    Alors les 7 icônes de bienfait et les 5 icônes de bénédiction du jeu sont identiques, pixel pour pixel, à leurs données validées
    Et les 3 raretés d'une même famille de bénédiction partagent la même icône

  Scénario: Accessibilité : l'icône ne porte jamais seule le sens
    Étant donné une carte de bienfait ou une pastille d'équipement
    Alors l'icône est cachée au lecteur d'écran
    Et le texte lu de la carte ne change pas : « Givre persistant, Givre, Rare » suivi de l'effet
    Et la grille des sorties est lue d'un trait : « Bienfaits : Écho parfait, Commun ; Givre persistant, Rare »

  Scénario: Accessibilité : texte agrandi
    Étant donné le joueur a agrandi le texte de son téléphone
    Quand l'écran des sorties montre plusieurs bienfaits
    Alors les noms passent à la ligne dans la pastille
    Et si le texte ne tient plus, la grille passe à 1 colonne et l'écran défile
    Et l'icône reste à 48 dp
