# language: fr
Fonctionnalité: Confirmer ses habitudes du jour d'un tap

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Cuisiner », créée le lundi 12 octobre 2026

  Scénario: Confirmer une habitude d'un tap
    Étant donné que « Cuisiner » est « à faire » dans la Vue Journée
    Quand le joueur touche « Cuisiner »
    Alors « Cuisiner » passe à l'état « fait »
    Et le suivi « fait » de « Cuisiner » pour le mercredi 14 octobre est enregistré

  Scénario: Un second tap revient à « à faire »
    Étant donné que « Cuisiner » est « fait » dans la Vue Journée
    Quand le joueur touche « Cuisiner »
    Alors « Cuisiner » repasse à l'état « à faire »
    Et aucun suivi « fait » de « Cuisiner » n'existe pour le mercredi 14 octobre

  Scénario: Au plus un suivi par habitude et par jour
    Quand le joueur touche trois fois de suite « Cuisiner »
    Alors « Cuisiner » est à l'état « fait »
    Et il existe un seul suivi de « Cuisiner » pour le mercredi 14 octobre

  Scénario: Les suivis sont indépendants entre habitudes
    Étant donné que le joueur a aussi l'habitude « Budget du jour »
    Quand il touche « Cuisiner »
    Alors « Budget du jour » reste à l'état « à faire »

  Scénario: Les suivis sont conservés après redémarrage
    Étant donné que « Cuisiner » est « fait » dans la Vue Journée
    Quand le joueur ferme complètement l'application puis la rouvre
    Alors « Cuisiner » est toujours à l'état « fait »

  Scénario: Clôture du jour à minuit, application ouverte
    Étant donné que la Vue Journée est affichée le mercredi 14 octobre à 23 h 59
    Et que « Cuisiner » est « à faire »
    Quand le téléphone passe au jeudi 15 octobre 2026 à 00 h 00
    Alors la Vue Journée affiche le jeudi 15 octobre
    Et « Cuisiner » est « à faire » pour le jeudi 15 octobre
    Et « Cuisiner » est « pas fait » le mercredi 14 octobre

  Scénario: Un jour « fait » reste « fait » après la clôture
    Étant donné que « Cuisiner » est « fait » le mercredi 14 octobre
    Quand le téléphone passe au jeudi 15 octobre 2026
    Alors « Cuisiner » est toujours « fait » le mercredi 14 octobre
    Et « Cuisiner » est « à faire » dans la Vue Journée du jeudi 15 octobre

  Scénario: Application fermée à minuit
    Étant donné que le joueur a fermé l'application le mercredi 14 octobre sans toucher « Cuisiner »
    Quand il rouvre l'application le jeudi 15 octobre 2026
    Alors la Vue Journée affiche le jeudi 15 octobre avec « Cuisiner » « à faire »
    Et « Cuisiner » est « pas fait » le mercredi 14 octobre

  Scénario: Retour au premier plan un autre jour
    Étant donné que l'application est passée en arrière-plan le mercredi 14 octobre
    Quand le joueur la ramène au premier plan le jeudi 15 octobre 2026
    Alors la Vue Journée affiche le jeudi 15 octobre

  Scénario: Tap au moment du changement de jour
    Étant donné que la Vue Journée affiche encore le mercredi 14 octobre
    Et que le téléphone vient de passer au jeudi 15 octobre 2026 à 00 h 00
    Quand le joueur touche « Cuisiner »
    Alors le suivi « fait » de « Cuisiner » est enregistré pour le mercredi 14 octobre
    Et la Vue Journée affiche ensuite le jeudi 15 octobre avec « Cuisiner » « à faire »

  Scénario: Changement de fuseau vers l'ouest, la veille redevient aujourd'hui
    Étant donné que nous sommes le jeudi 15 octobre 2026 à 00 h 30
    Et que « Cuisiner » n'a pas de suivi le mercredi 14 octobre
    Quand le téléphone change de fuseau et passe au mercredi 14 octobre 2026 à 23 h 30
    Alors la Vue Journée affiche le mercredi 14 octobre
    Et « Cuisiner » est « à faire »

  Scénario: Horloge reculée, les suivis devenus futurs sont conservés
    Étant donné que « Cuisiner » est « fait » le mercredi 14 octobre
    Quand l'horloge du téléphone recule au mardi 13 octobre 2026
    Alors la Vue Journée affiche le mardi 13 octobre
    Quand l'horloge revient au mercredi 14 octobre 2026
    Alors « Cuisiner » est toujours « fait » le mercredi 14 octobre

  Scénario: Horloge reculée avant la création d'une habitude
    Étant donné que le joueur a créé « Méditer » le mercredi 14 octobre 2026
    Quand l'horloge du téléphone recule au mardi 13 octobre 2026
    Alors « Méditer » n'apparaît pas dans la Vue Journée
    Et « Cuisiner » apparaît dans la Vue Journée

  Scénario: Erreur d'enregistrement d'un suivi
    Étant donné que « Cuisiner » est « à faire »
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur touche « Cuisiner »
    Alors « Cuisiner » revient à l'état « à faire »
    Et un message indique que le suivi n'a pas pu être enregistré
