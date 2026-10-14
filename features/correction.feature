# language: fr
Fonctionnalité: Corriger un jour passé

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026
    Et qu'il a l'habitude « Budget du jour », créée le mardi 13 octobre 2026

  Scénario: Corriger un jour « pas fait » en « fait »
    Étant donné que « Cuisiner » n'a pas de suivi le mardi 13 octobre
    Et que la Vue Semaine affiche la semaine du 12 au 18 octobre
    Quand le joueur touche la case du mardi 13 octobre de « Cuisiner »
    Alors la case passe à l'état « fait »
    Et elle porte la marque « corrigé »
    Et le suivi « fait » de « Cuisiner » pour le mardi 13 octobre est enregistré

  Scénario: Corriger un jour « fait » en « pas fait »
    Étant donné que « Cuisiner » était « fait » le lundi 12 octobre à sa clôture
    Quand le joueur touche la case du lundi 12 octobre de « Cuisiner »
    Alors la case passe à l'état « pas fait »
    Et elle porte la marque « corrigé »

  Scénario: Revenir à l'état de la clôture efface la marque « corrigé »
    Étant donné que « Cuisiner » était « pas fait » le mardi 13 octobre à sa clôture
    Et que le joueur l'a corrigé en « fait »
    Quand il touche de nouveau la case du mardi 13 octobre de « Cuisiner »
    Alors la case passe à l'état « pas fait »
    Et elle ne porte plus la marque « corrigé »

  Scénario: Corriger un jour d'une semaine précédente, sans limite de temps
    Étant donné que « Cuisiner » n'a pas de suivi le jeudi 8 octobre
    Et que la Vue Semaine affiche la semaine du 5 au 11 octobre
    Quand le joueur touche la case du jeudi 8 octobre de « Cuisiner »
    Alors la case passe à l'état « fait »
    Et elle porte la marque « corrigé »

  Scénario: Corriger le premier jour de l'habitude
    Étant donné que la Vue Semaine affiche la semaine du 12 au 18 octobre
    Quand le joueur touche la case du mardi 13 octobre de « Budget du jour »
    Alors la case passe à l'état « fait »

  Scénario: Impossible de corriger un jour antérieur à la création de l'habitude
    Étant donné que la Vue Semaine affiche la semaine du 12 au 18 octobre
    Quand le joueur touche la case du lundi 12 octobre de « Budget du jour »
    Alors la case reste à l'état « hors habitude »
    Et aucun suivi n'est enregistré

  Scénario: Un jour à venir reste non modifiable
    Quand le joueur touche la case du jeudi 15 octobre de « Cuisiner »
    Alors la case reste à l'état « à venir »
    Et aucun suivi n'est enregistré

  Scénario: Le suivi d'aujourd'hui n'est pas une correction
    Quand le joueur touche la case du mercredi 14 octobre de « Cuisiner »
    Alors la case passe à l'état « fait »
    Et elle ne porte pas la marque « corrigé »

  Scénario: Un tap juste après minuit sur la Vue Journée est une correction
    Étant donné que la Vue Journée affiche encore le mercredi 14 octobre
    Et que le téléphone vient de passer au jeudi 15 octobre 2026 à 00 h 00
    Et que « Cuisiner » est « à faire » sur la Vue Journée
    Quand le joueur touche « Cuisiner »
    Alors « Cuisiner » est « fait » le mercredi 14 octobre avec la marque « corrigé »
    Et la Vue Journée affiche le jeudi 15 octobre avec « Cuisiner » « à faire »

  Scénario: Un jour sauté par un changement de fuseau est corrigeable
    Étant donné que le téléphone passe directement du mercredi 14 au vendredi 16 octobre 2026 après un changement de fuseau horaire
    Quand le joueur touche la case du jeudi 15 octobre de « Cuisiner » sur la Vue Semaine
    Alors la case passe à l'état « fait »
    Et elle porte la marque « corrigé »

  Scénario: Les corrections et leur marque sont conservées après redémarrage
    Étant donné que le joueur a corrigé le mardi 13 octobre de « Cuisiner » en « fait »
    Quand il ferme complètement l'application puis la rouvre
    Alors la case du mardi 13 octobre de « Cuisiner » est « fait » avec la marque « corrigé »

  Scénario: Erreur d'enregistrement d'une correction
    Étant donné que « Cuisiner » n'a pas de suivi le mardi 13 octobre
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur touche la case du mardi 13 octobre de « Cuisiner »
    Alors la case reste à l'état « pas fait » sans marque « corrigé »
    Et un message indique que la correction n'a pas pu être enregistrée
