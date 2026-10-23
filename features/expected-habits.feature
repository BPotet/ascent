# language: fr
Fonctionnalité: Compter seulement les habitudes attendues

  Contexte:
    Étant donné que le joueur a l'habitude « Courir 5 km », objectif 3, créée le lundi 5 octobre 2026
    Et qu'il a l'habitude « Cuisiner », objectif 7, créée le lundi 5 octobre 2026

  Scénario: Sous son objectif, une habitude non quotidienne compte dans la Vue Journée
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 octobre et « à faire » aujourd'hui
    Et que « Cuisiner » est « fait » aujourd'hui
    Alors la Vue Journée affiche « 1/2 faites »

  Scénario: Objectif atteint, une habitude non faite ne compte plus
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre
    Et que « Courir 5 km » et « Cuisiner » sont « à faire » aujourd'hui
    Alors la Vue Journée affiche « 0/1 faites »
    Et « Courir 5 km » est affichée avec le badge « Objectif atteint » et reste tapable
    Quand le joueur touche « Courir 5 km »
    Alors la Vue Journée affiche « 1/2 faites »

  Scénario: « Toutes faites » sans l'habitude dont l'objectif est atteint
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre et « à faire » aujourd'hui
    Quand le joueur touche « Cuisiner »
    Alors la Vue Journée affiche l'état « Toutes faites » avec « 1/1 faites »

  Scénario: Aucune habitude attendue aujourd'hui
    Étant donné que nous sommes le dimanche 18 octobre 2026 selon le téléphone
    Et que le joueur a supprimé « Cuisiner »
    Et que « Courir 5 km » est « fait » le lundi 12, le mercredi 14 et le vendredi 16 octobre et « à faire » aujourd'hui
    Alors la Vue Journée affiche « Objectifs de la semaine atteints » à la place du compteur
    Et l'état « Toutes faites » ne s'affiche pas

  Scénario: Une habitude quotidienne compte toujours
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Et que « Cuisiner » est « fait » du lundi 12 au mercredi 14 octobre et « à faire » aujourd'hui
    Alors « Cuisiner » compte dans « x/y faites » de la Vue Journée

  Scénario: Le Rappel d'hier compte une habitude non quotidienne encore sous son objectif
    Étant donné que nous sommes le mardi 13 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « pas fait » le lundi 12 octobre
    Et que « Cuisiner » est « fait » le lundi 12 octobre
    Alors le Rappel d'hier affiche « Hier : 1/2 faites »

  Scénario: Le Rappel d'hier ignore une habitude dont l'objectif était déjà atteint
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre et « pas fait » le jeudi 15 octobre
    Et que « Cuisiner » est « fait » le jeudi 15 octobre
    Alors le Rappel d'hier ne s'affiche pas

  Scénario: La clôture du jour reste inchangée
    Étant donné que nous sommes le jeudi 15 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre et « à faire » aujourd'hui
    Et que le personnage a 30 Xp
    Quand le téléphone passe au vendredi 16 octobre 2026
    Alors « Courir 5 km » est « pas fait » le jeudi 15 octobre et reste corrigeable
    Et le personnage a 30 Xp

  Scénario: Le compteur du Jour du mois ne compte que les habitudes attendues
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « pas fait » le lundi 12, « fait » le mardi 13, le mercredi 14 et le jeudi 15 octobre
    Et que « Cuisiner » est « fait » le lundi 12 et le jeudi 15 octobre
    Quand le joueur affiche la Vue Mois d'octobre 2026
    Alors le lundi 12 octobre affiche « 1/2 »
    Et le jeudi 15 octobre affiche « 2/2 »

  Scénario: Un jour du mois sans habitude attendue
    Étant donné que nous sommes le lundi 19 octobre 2026 selon le téléphone
    Et que le joueur a supprimé « Cuisiner »
    Et que « Courir 5 km » est « fait » du lundi 12 au mercredi 14 octobre et « pas fait » du jeudi 15 au dimanche 18 octobre
    Quand le joueur affiche la Vue Mois d'octobre 2026
    Alors le jeudi 15 octobre affiche le drapeau « Objectifs atteints » sans compteur
    Et il s'ouvre en Détail du jour avec « Courir 5 km » « pas fait », corrigeable
    Et la ligne sous le titre du Détail du jour affiche « Jour clos · tu peux corriger un oubli · objectifs de la semaine atteints »

  Scénario: Le Détail du jour compte seulement les habitudes attendues
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre et « pas fait » le jeudi 15 octobre
    Et que « Cuisiner » est « pas fait » le jeudi 15 octobre
    Quand le joueur ouvre le Détail du jour du jeudi 15 octobre 2026
    Alors la ligne sous le titre affiche « Jour clos · tu peux corriger un oubli · 0/1 faites »
    Et le Détail du jour affiche « Courir 5 km » et « Cuisiner », toutes deux « pas fait » et corrigeables

  Scénario: Une correction recalcule les habitudes attendues des jours suivants
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre et « pas fait » le jeudi 15 octobre
    Et que « Cuisiner » est « fait » le jeudi 15 octobre
    Quand le joueur corrige le mercredi 14 octobre de « Courir 5 km » en « pas fait »
    Alors le jeudi 15 octobre affiche « 1/2 » dans la Vue Mois
    Et le Rappel d'hier affiche « Hier : 1/2 faites »

  Scénario: Les semaines sans objectif comptent toutes les habitudes actives
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a ouvert pour la première fois la version qui introduit l'objectif hebdomadaire le lundi 5 octobre 2026
    Et que « Budget du jour », créée le jeudi 1er octobre 2026 avant cette version, est « fait » le jeudi 1er octobre et « pas fait » le vendredi 2 octobre
    Quand le joueur affiche la Vue Mois d'octobre 2026
    Alors « Budget du jour » compte comme attendue dans le compteur du vendredi 2 octobre
