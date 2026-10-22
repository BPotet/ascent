# language: fr
Fonctionnalité: Objectif hebdomadaire et progression de la semaine

  Scénario: Créer une habitude avec l'objectif par défaut
    Étant donné que nous sommes le lundi 12 octobre 2026 selon le téléphone
    Quand le joueur ouvre « Nouvelle habitude »
    Alors l'objectif 7 est présélectionné avec la phrase « Tous les jours »
    Quand il saisit « Boire de l'eau » et valide avec la touche ↵ du clavier
    Alors « Boire de l'eau » a l'objectif hebdomadaire 7
    Et sa ligne dans la Vue Journée affiche « À faire · 0/7 cette semaine »

  Scénario: Créer une habitude « 3 fois par semaine »
    Étant donné que nous sommes le lundi 12 octobre 2026 selon le téléphone
    Quand le joueur choisit l'objectif 3 dans « Nouvelle habitude »
    Alors le bloc « Objectif » affiche « 3 fois par semaine »
    Quand il crée l'habitude « Courir 5 km »
    Alors la ligne de « Courir 5 km » dans la Vue Journée affiche « À faire · 0/3 cette semaine »
    Et la carte de « Courir 5 km » dans la Vue Semaine affiche « 3 fois par semaine » et la puce « 0/3 »

  Plan du scénario: L'objectif de la semaine de création est réduit aux jours actifs
    Étant donné que nous sommes le <jour> selon le téléphone
    Quand le joueur crée l'habitude « Méditer » avec l'objectif 7
    Alors l'objectif de la semaine de « Méditer » est <objectif de la semaine>
    Et sa ligne dans la Vue Journée affiche « À faire · 0/<objectif de la semaine> cette semaine »

    Exemples:
      | jour                     | objectif de la semaine |
      | jeudi 15 octobre 2026    | 4                      |
      | dimanche 18 octobre 2026 | 1                      |
      | mercredi 14 octobre 2026 | 5                      |

  Scénario: Un objectif inférieur aux jours actifs n'est pas réduit
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Quand le joueur crée l'habitude « Courir 5 km » avec l'objectif 3
    Alors l'objectif de la semaine de « Courir 5 km » est 3

  Scénario: La semaine de création réduite est annoncée avant de créer
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Quand le joueur ouvre « Nouvelle habitude »
    Alors le bloc « Objectif » affiche « Tous les jours · cette semaine : 5, à partir d'aujourd'hui »
    Quand il crée l'habitude « Méditer »
    Alors le message « Habitude créée · objectif 5 cette semaine » s'affiche

  Scénario: Pas d'annonce quand l'objectif n'est pas réduit
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Quand le joueur choisit l'objectif 3 dans « Nouvelle habitude »
    Alors le bloc « Objectif » affiche « 3 fois par semaine » sans mention « cette semaine »
    Quand il crée l'habitude « Courir 5 km »
    Alors le message « Habitude créée » s'affiche, sans objectif de la semaine

  Scénario: La progression de la semaine suit les suivis
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, créée le lundi 5 octobre 2026, est « fait » le lundi 12 octobre
    Quand le joueur touche « Courir 5 km » dans la Vue Journée
    Alors sa ligne affiche « Fait · 2/3 cette semaine »
    Quand il touche de nouveau « Courir 5 km »
    Alors sa ligne affiche « À faire · 1/3 cette semaine »

  Scénario: Atteindre l'objectif de la semaine
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, créée le lundi 5 octobre 2026, est « fait » le lundi 12 et le mercredi 14 octobre
    Quand le joueur touche « Courir 5 km » dans la Vue Journée
    Alors « Courir 5 km » porte le badge « Objectif atteint »
    Et sa ligne affiche « Fait · 3/3 cette semaine »
    Et la carte de la Vue Semaine affiche la puce verte « 3/3 · Objectif atteint »

  Scénario: Dépasser l'objectif de la semaine
    Étant donné que nous sommes le samedi 17 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, est « fait » le lundi 12, le mercredi 14 et le vendredi 16 octobre
    Alors « Courir 5 km » reste tapable dans la Vue Journée
    Quand le joueur touche « Courir 5 km »
    Alors sa ligne affiche « Fait · 4 fois cette semaine »
    Et « Courir 5 km » porte toujours le badge « Objectif atteint »
    Et la carte de la Vue Semaine affiche la puce « 4/3 · Objectif atteint »

  Scénario: Repasser sous l'objectif retire le badge, sans marque d'échec
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, est « fait » le lundi 12, le mercredi 14 et le vendredi 16 octobre
    Quand le joueur touche « Courir 5 km » dans la Vue Journée
    Alors le badge « Objectif atteint » disparaît
    Et sa ligne affiche « À faire · 2/3 cette semaine »

  Scénario: Une nouvelle semaine repart de zéro et la précédente garde son résultat
    Étant donné que l'habitude « Courir 5 km », objectif 3, a été « fait » 3 fois la semaine du 12 octobre 2026
    Quand le téléphone passe au lundi 19 octobre 2026
    Alors sa ligne dans la Vue Journée affiche « À faire · 0/3 cette semaine »
    Et la Vue Semaine du 12 au 18 octobre affiche pour « Courir 5 km » la puce verte « 3/3 · Objectif atteint »

  Scénario: Une semaine passée non atteinte reste neutre
    Étant donné que nous sommes le lundi 19 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, a été « fait » 1 fois la semaine du 12 octobre 2026
    Quand le joueur affiche la Vue Semaine du 12 au 18 octobre
    Alors la carte de « Courir 5 km » affiche la puce grise « 1/3 »
    Et aucune marque rouge ni croix n'indique un échec

  Scénario: Une correction met à jour la progression d'une semaine passée
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, créée le lundi 5 octobre 2026, est « fait » le lundi 5 et le mercredi 7 octobre
    Quand le joueur corrige le vendredi 9 octobre de « Courir 5 km » en « fait »
    Alors la Vue Semaine du 5 au 11 octobre affiche pour « Courir 5 km » la puce verte « 3/3 · Objectif atteint »

  Scénario: Changer l'objectif s'applique à partir de lundi prochain
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, créée le lundi 5 octobre 2026, est « fait » le lundi 12 octobre
    Quand le joueur choisit l'objectif 5 dans « Modifier l'habitude » de « Courir 5 km »
    Alors le message « Nouvel objectif à partir de lundi prochain (19 octobre). Cette semaine reste à 3. » s'affiche
    Quand il enregistre
    Alors sa ligne dans la Vue Journée affiche « À faire · 1/3 cette semaine »
    Quand le téléphone passe au lundi 19 octobre 2026
    Alors sa ligne dans la Vue Journée affiche « À faire · 0/5 cette semaine »
    Et la carte de la Vue Semaine affiche « 5 fois par semaine »

  Scénario: Le jour de création, un changement d'objectif s'applique tout de suite
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a créé aujourd'hui l'habitude « Lire » avec l'objectif 7
    Quand il passe l'objectif de « Lire » à 3 et enregistre
    Alors aucun message « à partir de lundi prochain » ne s'est affiché
    Et la ligne de « Lire » affiche « À faire · 0/3 cette semaine »

  Scénario: Plusieurs changements d'objectif dans la semaine, le dernier l'emporte
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, a été créée le lundi 5 octobre 2026
    Quand le joueur passe l'objectif à 5 et enregistre
    Et qu'il le passe à 4 et enregistre
    Alors sa ligne affiche toujours « À faire · 0/3 cette semaine »
    Quand le téléphone passe au lundi 19 octobre 2026
    Alors sa ligne affiche « À faire · 0/4 cette semaine »

  Scénario: L'objectif hebdomadaire va de 1 à 7
    Quand le joueur ouvre le bloc « Objectif » de « Nouvelle habitude »
    Alors il peut choisir uniquement 1, 2, 3, 4, 5, 6 ou 7
    Et l'objectif 1 se lit « 1 fois par semaine » et l'objectif 7 « Tous les jours »
    Et une habitude enregistrée avec l'objectif 0 ou 8 est refusée

  Scénario: Les habitudes existantes reçoivent l'objectif « Tous les jours »
    Étant donné que, avant cette version, le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026, « fait » le lundi 12 et le mardi 13 octobre
    Et qu'il a l'habitude « Budget du jour », créée le mardi 13 octobre 2026
    Et que le personnage a 70 Xp
    Quand il ouvre pour la première fois, le mercredi 14 octobre 2026, la version qui introduit l'objectif hebdomadaire
    Alors « Cuisiner » et « Budget du jour » ont l'objectif hebdomadaire 7
    Et la ligne de « Cuisiner » affiche « À faire · 2/7 cette semaine »
    Et la ligne de « Budget du jour » affiche « À faire · 0/6 cette semaine »
    Et la Vue Semaine du 5 au 11 octobre n'affiche aucune puce de progression
    Et le personnage a 70 Xp

  Scénario: Carte de nouveauté à la première ouverture après la mise à jour
    Étant donné que, avant cette version, le joueur a les habitudes « Cuisiner » et « Budget du jour »
    Quand il ouvre la Vue Journée pour la première fois après la mise à jour
    Alors la carte « Nouveau : règle la difficulté et l'objectif de chaque habitude » s'affiche avec l'action « Régler »
    Quand il touche « Régler »
    Alors « Modifier l'habitude » s'ouvre sur « Cuisiner », la première habitude de la Vue Journée
    Et la carte ne s'affiche plus, même après un redémarrage

  Scénario: Le jour de la mise à jour, un changement d'objectif s'applique à partir de lundi prochain
    Étant donné que, avant cette version, le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026, « fait » le lundi 12 et le mardi 13 octobre
    Et qu'il ouvre pour la première fois, le mercredi 14 octobre 2026, la version qui introduit l'objectif hebdomadaire
    Quand il touche « Régler » sur la carte de nouveauté
    Et qu'il choisit l'objectif 3 dans « Modifier l'habitude » de « Cuisiner »
    Alors le message « Nouvel objectif à partir de lundi prochain (19 octobre). Cette semaine reste à 7. » s'affiche
    Quand il enregistre
    Alors la ligne de « Cuisiner » dans la Vue Journée affiche « À faire · 2/7 cette semaine »
    Quand le téléphone passe au lundi 19 octobre 2026
    Alors la ligne de « Cuisiner » affiche « À faire · 0/3 cette semaine »

  Scénario: Une habitude créée le jour même de la mise à jour garde l'exception de son jour de création
    Étant donné que, avant cette version, le joueur a créé le mercredi 14 octobre 2026 l'habitude « Budget du jour », sa seule habitude
    Et qu'il ouvre pour la première fois, le même mercredi 14 octobre 2026, la version qui introduit l'objectif hebdomadaire
    Et que la ligne de « Budget du jour » dans la Vue Journée affiche « À faire · 0/5 cette semaine »
    Quand il touche « Régler » sur la carte de nouveauté
    Et qu'il choisit l'objectif 3 dans « Modifier l'habitude » de « Budget du jour »
    Alors aucun message « à partir de lundi prochain » ne s'affiche
    Quand il enregistre
    Alors la ligne de « Budget du jour » dans la Vue Journée affiche « À faire · 0/3 cette semaine »
    Quand le téléphone passe au lundi 19 octobre 2026
    Alors la ligne de « Budget du jour » affiche « À faire · 0/3 cette semaine »

  Scénario: Fermer la carte de nouveauté
    Étant donné que la carte de nouveauté est affichée
    Quand le joueur la ferme
    Alors elle ne s'affiche plus, même après un redémarrage

  Scénario: Pas de carte de nouveauté sans habitude existante
    Étant donné que le joueur installe l'application pour la première fois
    Quand il ouvre la Vue Journée
    Alors aucune carte de nouveauté ne s'affiche

  Scénario: Échec d'enregistrement d'un changement d'objectif
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km » a l'objectif 3
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur passe l'objectif à 5 et enregistre
    Alors un message indique que la modification n'a pas pu être enregistrée
    Et « Courir 5 km » a toujours l'objectif 3

  # Scénario d'interface : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Le lecteur d'écran annonce l'objectif et la progression
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Et que l'habitude « Courir 5 km », objectif 3, est « à faire » avec 2 « fait » cette semaine
    Quand le lecteur d'écran lit sa ligne dans la Vue Journée
    Alors il annonce « Courir 5 km, jeudi 15 octobre, à faire, 2 sur 3 cette semaine »
    Et le bloc « Objectif » est annoncé comme le groupe « Objectif hebdomadaire », l'option 7 étant lue « 7 fois par semaine, tous les jours »
