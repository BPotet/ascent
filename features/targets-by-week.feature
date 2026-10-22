# language: fr
Fonctionnalité: Objectifs par semaine dans la Vue Mois

  Contexte:
    Étant donné que nous sommes le mercredi 21 octobre 2026 selon le téléphone
    Et que la version qui introduit l'objectif hebdomadaire a été ouverte pour la première fois le lundi 28 septembre 2026
    Et que le joueur a 4 habitudes avec un objectif hebdomadaire, créées le lundi 28 septembre 2026, dont « Courir 5 km »

  Scénario: Une ligne par semaine du mois
    Étant donné que 2 habitudes sur 4 ont atteint leur objectif la semaine du 28 septembre
    Et que 3 habitudes sur 4 l'ont atteint la semaine du 5 octobre
    Et que 4 habitudes sur 4 l'ont atteint la semaine du 12 octobre
    Et que 1 habitude sur 4 l'a atteint cette semaine
    Quand le joueur affiche la Vue Mois d'octobre 2026
    Alors la section « Objectifs par semaine » s'affiche sous la grille
    Et elle affiche « Semaine du 28 septembre · 2/4 objectifs atteints »
    Et elle affiche « Semaine du 5 octobre · 3/4 objectifs atteints »
    Et elle affiche « Semaine du 12 octobre · 4/4 objectifs atteints » avec le drapeau
    Et elle affiche « Cette semaine · 1/4 objectifs atteints »
    Et aucune ligne n'affiche une semaine à venir

  Scénario: Ouvrir une semaine depuis la Vue Mois
    Quand le joueur touche « Semaine du 5 octobre · 3/4 objectifs atteints »
    Alors la Vue Semaine s'ouvre sur la semaine du 5 au 11 octobre 2026

  Scénario: Une semaine à cheval sur deux mois apparaît dans les deux
    Quand le joueur affiche la Vue Mois d'octobre 2026 puis celle de septembre 2026
    Alors la ligne « Semaine du 28 septembre » apparaît dans les deux mois

  Scénario: Pas de section sans habitude
    Étant donné que le joueur a supprimé toutes ses habitudes
    Quand il affiche la Vue Mois
    Alors la Vue Mois affiche son état vide
    Et la section « Objectifs par semaine » ne s'affiche pas

  Scénario: Les semaines d'avant la mise à jour n'ont pas de ligne
    Étant donné que le joueur a aussi l'habitude « Lire », créée le lundi 21 septembre 2026 avant la mise à jour
    Quand le joueur affiche la Vue Mois de septembre 2026
    Alors la section ne contient pas de ligne pour la semaine du 21 septembre
    Et elle ne contient que « Semaine du 28 septembre »

  Scénario: Le Détail du jour affiche la progression de la semaine de ce jour
    Étant donné que l'habitude « Courir 5 km », objectif 3, est « fait » le lundi 12 et le mercredi 14 octobre
    Quand le joueur touche le mercredi 14 octobre dans la Vue Mois
    Alors le Détail du jour affiche pour « Courir 5 km » « 2/3 semaine du 12 octobre »

  Scénario: Une correction dans le Détail du jour qui atteint l'objectif joue le feedback
    Étant donné que l'habitude « Courir 5 km », en « Moyenne », objectif 3, est « fait » le lundi 12 et le mercredi 14 octobre
    Et que le personnage a 20 Xp
    Quand le joueur corrige le vendredi 16 octobre de « Courir 5 km » en « fait » dans le Détail du jour
    Alors le personnage a 45 Xp
    Et le message « Objectif atteint · semaine du 12 octobre » s'affiche
    Et la ligne « Semaine du 12 octobre » de la section passe à un objectif atteint de plus

  Scénario: Échec de chargement de la Vue Mois
    Étant donné que la lecture des données sur le téléphone échoue
    Quand le joueur affiche la Vue Mois
    Alors l'état d'erreur de la Vue Mois s'affiche, comme avant cette story

  Scénario: Le lecteur d'écran lit les lignes de la section
    Quand le lecteur d'écran lit la ligne de la semaine du 12 octobre
    Alors il annonce « Semaine du 12 octobre, 4 objectifs atteints sur 4, ouvrir la semaine »
