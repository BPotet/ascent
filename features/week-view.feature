# language: fr
Fonctionnalité: Voir sa semaine et les semaines précédentes

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026
    Et qu'il a l'habitude « Budget du jour », créée le mardi 13 octobre 2026
    Et que « Cuisiner » est « fait » le jeudi 8 et le lundi 12 octobre

  Scénario: Ouvrir la Vue Semaine sur la semaine en cours
    Quand le joueur touche l'onglet « Semaine »
    Alors la Vue Semaine affiche la semaine du lundi 12 au dimanche 18 octobre 2026
    Et « Cuisiner » est affichée avant « Budget du jour », chacune avec 7 cases
    Et le mercredi 14 octobre est mis en évidence comme aujourd'hui

  Scénario: Les cinq états du suivi
    Quand le joueur affiche la Vue Semaine du 12 au 18 octobre
    Alors les cases de « Cuisiner » sont :
      | jour                | état        |
      | lundi 12 octobre    | fait        |
      | mardi 13 octobre    | pas fait    |
      | mercredi 14 octobre | à faire     |
      | jeudi 15 octobre    | à venir     |
    Et les cases de « Budget du jour » sont :
      | jour                | état          |
      | lundi 12 octobre    | hors habitude |
      | mardi 13 octobre    | pas fait      |
      | mercredi 14 octobre | à faire       |
      | dimanche 18 octobre | à venir       |

  Scénario: Confirmer aujourd'hui depuis la Vue Semaine
    Quand le joueur touche la case du mercredi 14 octobre de « Cuisiner »
    Alors la case passe à l'état « fait »
    Et « Cuisiner » est « fait » dans la Vue Journée

  Scénario: Une case « à venir » ou « hors habitude » ne réagit pas
    Quand le joueur touche la case du jeudi 15 octobre de « Cuisiner »
    Et qu'il touche la case du lundi 12 octobre de « Budget du jour »
    Alors ces cases gardent leur état
    Et aucun suivi n'est enregistré

  # « Un jour clos n'est pas modifiable dans cette story » (#7) est remplacé par la correction
  # d'un jour clos de #9 : voir features/correction.feature.

  Scénario: Afficher la semaine précédente
    Quand le joueur touche « Semaine précédente »
    Alors la Vue Semaine affiche la semaine du lundi 5 au dimanche 11 octobre 2026
    Et la case du jeudi 8 octobre de « Cuisiner » est « fait »
    Et la case du vendredi 9 octobre de « Cuisiner » est « pas fait »
    Et les 7 cases de « Budget du jour » sont « hors habitude »

  Scénario: Revenir à la semaine en cours
    Étant donné que la Vue Semaine affiche la semaine du 5 au 11 octobre
    Quand le joueur revient à la semaine en cours
    Alors la Vue Semaine affiche la semaine du 12 au 18 octobre 2026

  Scénario: Pas de navigation au-delà de la semaine en cours
    Quand le joueur affiche la semaine du 12 au 18 octobre
    Alors l'action « Semaine suivante » est désactivée

  Scénario: Pas de navigation avant la plus ancienne habitude
    Quand le joueur affiche la semaine du 5 au 11 octobre
    Alors l'action « Semaine précédente » est désactivée

  Scénario: Sans habitude, seule la semaine en cours est consultable
    Étant donné que le joueur n'a aucune habitude
    Quand il touche l'onglet « Semaine »
    Alors la Vue Semaine affiche l'état vide de la semaine du 12 au 18 octobre
    Et les actions « Semaine précédente » et « Semaine suivante » sont désactivées

  Scénario: Le dimanche soir, la semaine en cours change à minuit
    Étant donné que nous sommes le dimanche 18 octobre 2026 à 23 h 59
    Et que la Vue Semaine affiche la semaine en cours
    Quand le téléphone passe au lundi 19 octobre 2026
    Alors la Vue Semaine affiche la semaine du lundi 19 au dimanche 25 octobre 2026

  Scénario: Horloge reculée, un suivi daté dans le futur reste « fait »
    Étant donné que « Cuisiner » est « fait » le mercredi 14 octobre
    Quand l'horloge du téléphone recule au mardi 13 octobre 2026
    Alors la case du mercredi 14 octobre de « Cuisiner » est affichée « fait »
    Et elle n'est pas modifiable

  Scénario: Erreur de chargement d'une semaine
    Étant donné que les suivis de la semaine du 5 au 11 octobre ne peuvent pas être lus
    Quand le joueur touche « Semaine précédente »
    Alors la Vue Semaine affiche l'état d'erreur avec une action « Réessayer »
    Et le joueur peut revenir à la semaine en cours
