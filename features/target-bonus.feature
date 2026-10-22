# language: fr
Fonctionnalité: Prime d'objectif

  Contexte:
    Étant donné que le joueur a l'habitude « Courir 5 km », créée le lundi 5 octobre 2026 en « Moyenne » avec l'objectif 3

  Scénario: Atteindre l'objectif accorde la prime
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 et le mercredi 14 octobre
    Et que le personnage a 20 Xp
    Quand le joueur touche « Courir 5 km » dans la Vue Journée
    Alors le personnage a 45 Xp
    Et le feedback « +10 XP » s'affiche
    Et le badge « Objectif atteint » apparaît avec un éclat doré
    Et le message « Objectif de la semaine atteint · Courir 5 km 3/3 · +15 XP prime » s'affiche
    Et le téléphone vibre légèrement

  Scénario: Les cases au-delà de l'objectif rapportent leur expérience normale, sans nouvelle prime
    Étant donné que nous sommes le samedi 17 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mercredi 14 et le vendredi 16 octobre
    Et que le personnage a 45 Xp
    Quand le joueur touche « Courir 5 km »
    Alors le personnage a 55 Xp
    Et aucun message de prime ne s'affiche

  Scénario: Une correction qui garde l'objectif atteint garde la prime
    Étant donné que nous sommes le samedi 17 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mercredi 14, le vendredi 16 et le samedi 17 octobre
    Et que le personnage a 55 Xp
    Quand le joueur corrige le mercredi 14 octobre de « Courir 5 km » en « pas fait »
    Alors le personnage a 45 Xp
    Et « Courir 5 km » porte toujours le badge « Objectif atteint »

  Scénario: Repasser sous l'objectif retire la prime en entier
    Étant donné que nous sommes le samedi 17 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le vendredi 16 et le samedi 17 octobre
    Et que le personnage a 45 Xp
    Quand le joueur corrige le lundi 12 octobre de « Courir 5 km » en « pas fait »
    Alors le personnage a 20 Xp
    Et le badge « Objectif atteint » disparaît
    Et les feedbacks discrets « −10 XP » et « −15 XP prime » s'affichent, sans vibration

  Scénario: Faire, défaire, refaire au seuil ne rapporte rien de plus
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 et le mercredi 14 octobre
    Et que le personnage a 20 Xp
    Quand le joueur touche « Courir 5 km »
    Alors le personnage a 45 Xp
    Quand il touche de nouveau « Courir 5 km »
    Alors le personnage a 20 Xp
    Quand il touche encore « Courir 5 km »
    Alors le personnage a 45 Xp

  Scénario: Semaine de création, la prime suit l'objectif de la semaine réduit
    Étant donné que nous sommes le dimanche 18 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Méditer », créée le jeudi 15 octobre 2026 en « Moyenne » avec l'objectif 7
    Et que « Méditer » est « fait » le jeudi 15, le vendredi 16 et le samedi 17 octobre
    Et que le personnage a 30 Xp
    Quand le joueur touche « Méditer »
    Alors le personnage a 60 Xp
    Et le message « Objectif de la semaine atteint · Méditer 4/4 · +20 XP prime » s'affiche

  Scénario: Changer la difficulté réévalue la prime de la semaine en cours
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 et le mardi 13 octobre
    Et que le personnage a 20 Xp
    Quand le joueur passe « Courir 5 km » en « Difficile » et enregistre
    Alors le personnage a 40 Xp
    Quand il touche « Courir 5 km »
    Alors le personnage a 90 Xp
    Et le message « Objectif de la semaine atteint · Courir 5 km 3/3 · +30 XP prime » s'affiche

  Scénario: Baisser la difficulté après l'objectif atteint réduit la prime
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km », passée en « Difficile » le lundi 12 octobre, est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre
    Et que le personnage a 90 Xp
    Quand le joueur passe « Courir 5 km » en « Facile » et enregistre
    Alors le personnage a 24 Xp

  Plan du scénario: La prime vaut l'objectif de la semaine multiplié par la prime unitaire de la difficulté
    Étant donné qu'une habitude en « <difficulté> » a l'objectif de la semaine <objectif>
    Quand sa progression de la semaine atteint <objectif>
    Alors la prime d'objectif vaut <prime> Xp

    Exemples:
      | difficulté | objectif | prime |
      | Facile     | 1        | 3     |
      | Facile     | 7        | 21    |
      | Moyenne    | 3        | 15    |
      | Moyenne    | 7        | 35    |
      | Difficile  | 1        | 10    |
      | Difficile  | 7        | 70    |

  Scénario: Changer l'objectif ne change pas la prime de la semaine en cours
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mercredi 14 et le vendredi 16 octobre
    Et que le personnage a 45 Xp
    Quand le joueur passe l'objectif de « Courir 5 km » à 5 et enregistre
    Alors le personnage a 45 Xp
    Et « Courir 5 km » porte toujours le badge « Objectif atteint »

  Scénario: Une correction dans une semaine close peut accorder sa prime
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 5 et le mercredi 7 octobre
    Et que le personnage a 20 Xp
    Quand le joueur corrige le vendredi 9 octobre de « Courir 5 km » en « fait » dans la Vue Semaine
    Alors le personnage a 45 Xp
    Et le message « Objectif atteint · semaine du 5 octobre » s'affiche

  Scénario: Une correction dans une semaine close peut retirer sa prime
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 5, le mercredi 7 et le vendredi 9 octobre
    Et que le personnage a 45 Xp
    Quand le joueur corrige le vendredi 9 octobre de « Courir 5 km » en « pas fait »
    Alors le personnage a 20 Xp
    Et le message discret « Objectif de la semaine du 5 octobre plus atteint » s'affiche

  Scénario: Une semaine close garde la difficulté de sa semaine pour la prime
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 5 et le mercredi 7 octobre
    Et que le joueur l'a passée en « Difficile » le lundi 12 octobre
    Et que le personnage a 20 Xp
    Quand le joueur corrige le vendredi 9 octobre de « Courir 5 km » en « fait »
    Alors le personnage a 45 Xp

  Scénario: Pas de prime pour les semaines d'avant la mise à jour
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a ouvert pour la première fois la version qui introduit l'objectif hebdomadaire le lundi 5 octobre 2026
    Et que « Cuisiner », créée le lundi 28 septembre 2026 avant cette version, est « fait » du lundi 28 septembre au samedi 3 octobre et « pas fait » le dimanche 4 octobre
    Et que le personnage a 60 Xp
    Quand le joueur corrige le dimanche 4 octobre de « Cuisiner » en « fait »
    Alors le personnage a 70 Xp
    Et aucun message de prime ne s'affiche

  Scénario: Supprimer une habitude annonce et retire la prime qui tombe
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12, le mercredi 14 et le vendredi 16 octobre
    Et que le personnage a 45 Xp
    Quand le joueur choisit « Supprimer l'habitude » pour « Courir 5 km »
    Alors la fenêtre de confirmation annonce « −25 XP »
    Quand il confirme
    Alors le personnage a 20 Xp
    Et ces 20 Xp sont de l'Xp conservée

  Scénario: Une semaine close atteinte reste acquise après la suppression
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 5, le mercredi 7 et le vendredi 9 octobre, et « à faire » aujourd'hui
    Et que le personnage a 45 Xp
    Quand le joueur supprime « Courir 5 km » et confirme
    Alors le personnage a 45 Xp

  Scénario: Ne pas atteindre l'objectif n'a aucune pénalité
    Étant donné que « Courir 5 km » a été « fait » 1 fois la semaine du 5 octobre 2026
    Et que le personnage a 10 Xp
    Quand le téléphone passe au lundi 12 octobre 2026
    Alors le personnage a 10 Xp

  Scénario: Échec d'enregistrement, ni case, ni expérience, ni prime
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 et le mercredi 14 octobre
    Et que le personnage a 20 Xp
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur touche « Courir 5 km »
    Alors « Courir 5 km » revient à l'état « à faire » avec « 2/3 cette semaine »
    Et le badge « Objectif atteint » n'apparaît pas
    Et le personnage a 20 Xp

  # Scénarios d'interface : exécutés par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Animations réduites
    Étant donné que le téléphone demande de réduire les animations
    Et que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 et le mercredi 14 octobre
    Quand le joueur touche « Courir 5 km »
    Alors le badge « Objectif atteint » et le message de prime apparaissent sans éclat ni animation

  @ui
  Scénario: Le lecteur d'écran annonce la prime
    Étant donné que nous sommes le vendredi 16 octobre 2026 selon le téléphone
    Et que « Courir 5 km » est « fait » le lundi 12 et le mercredi 14 octobre
    Quand le joueur touche « Courir 5 km »
    Alors le lecteur d'écran annonce l'objectif atteint et la prime de 15 points d'expérience
