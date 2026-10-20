# language: fr
Fonctionnalité: Consulter un mois et tout l'historique

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026
    Et qu'il a l'habitude « Budget du jour », créée le mardi 13 octobre 2026
    Et que « Cuisiner » est « fait » le lundi 12 et le mardi 13 octobre
    Et que « Budget du jour » est « fait » le mardi 13 octobre

  Scénario: Ouvrir la Vue Mois sur le mois en cours
    Quand le joueur touche l'onglet « Mois »
    Alors la Vue Mois affiche octobre 2026, du jeudi 1er au samedi 31 octobre
    Et les semaines du mois vont du lundi au dimanche
    Et le mercredi 14 octobre est mis en évidence comme aujourd'hui

  Scénario: Compteur « habitudes faites / habitudes actives » de chaque jour
    Quand le joueur affiche la Vue Mois d'octobre 2026
    Alors les jours affichent :
      | jour                 | compteur |
      | lundi 12 octobre     | 1/1      |
      | mardi 13 octobre     | 2/2      |
      | mercredi 14 octobre  | 0/2      |
    Et les jours du jeudi 1er au dimanche 4 octobre sont neutres
    Et les jours du jeudi 15 au samedi 31 octobre sont « à venir »

  Scénario: Voir l'état de chaque habitude un jour donné
    Quand le joueur ouvre le lundi 12 octobre dans la Vue Mois
    Alors « Cuisiner » est à l'état « fait »
    Et « Budget du jour » est à l'état « hors habitude »

  Scénario: Corriger un jour depuis la Vue Mois
    Étant donné que le personnage a 30 Xp
    Et que le joueur a ouvert le jeudi 8 octobre dans la Vue Mois
    Quand il touche « Cuisiner »
    Alors « Cuisiner » est « fait » le jeudi 8 octobre avec la marque « corrigé »
    Et le compteur du jeudi 8 octobre affiche « 1/1 »
    Et le personnage a 40 Xp

  Scénario: La marque « corrigé » est visible dans la Vue Mois
    Étant donné que le joueur a corrigé le jeudi 8 octobre de « Cuisiner » en « fait »
    Quand il affiche la Vue Mois d'octobre 2026
    Alors le jeudi 8 octobre signale discrètement qu'il a été corrigé

  Scénario: Un jour hors habitude ne se corrige pas depuis la Vue Mois
    Quand le joueur ouvre le lundi 12 octobre dans la Vue Mois
    Et qu'il touche « Budget du jour »
    Alors « Budget du jour » reste à l'état « hors habitude »
    Et aucun suivi n'est enregistré

  Scénario: Un jour à venir ne se modifie pas
    Quand le joueur touche le jeudi 15 octobre dans la Vue Mois
    Alors aucun suivi n'est enregistré

  Scénario: Remonter jusqu'au début de l'historique
    Étant donné que le joueur a aussi l'habitude « Lire », créée le lundi 21 septembre 2026
    Quand il touche « Mois précédent » dans la Vue Mois d'octobre 2026
    Alors la Vue Mois affiche septembre 2026
    Et les jours du mardi 1er au dimanche 20 septembre sont neutres
    Et l'action « Mois précédent » est désactivée

  Scénario: Pas de navigation au-delà du mois en cours
    Quand le joueur affiche la Vue Mois d'octobre 2026
    Alors l'action « Mois suivant » est désactivée

  Scénario: Revenir au mois en cours
    Étant donné que le joueur a aussi l'habitude « Lire », créée le lundi 21 septembre 2026
    Et que la Vue Mois affiche septembre 2026
    Quand il revient au mois en cours
    Alors la Vue Mois affiche octobre 2026

  Scénario: Une habitude supprimée disparaît de l'historique
    Étant donné que le joueur a supprimé l'habitude « Lire », créée le lundi 21 septembre 2026
    Quand il affiche la Vue Mois d'octobre 2026
    Alors l'action « Mois précédent » est désactivée
    Et « Lire » n'apparaît dans aucun jour

  Scénario: Sans habitude, seul le mois en cours est consultable
    Étant donné que le joueur n'a aucune habitude
    Quand il touche l'onglet « Mois »
    Alors la Vue Mois affiche octobre 2026 avec tous les jours passés et aujourd'hui neutres
    Et les actions « Mois précédent » et « Mois suivant » sont désactivées

  Scénario: L'en-tête affiche l'expérience totale du personnage
    Étant donné que le joueur a aussi l'habitude « Lire », créée le lundi 21 septembre 2026
    Et que le personnage a 40 Xp
    Quand le joueur affiche la Vue Mois de septembre 2026
    Alors l'en-tête affiche « 40 XP »

  Scénario: Erreur de chargement d'un mois
    Étant donné que les suivis d'octobre 2026 ne peuvent pas être lus
    Quand le joueur touche l'onglet « Mois »
    Alors la Vue Mois affiche l'état d'erreur avec une action « Réessayer »
    Et aucune donnée n'est effacée
