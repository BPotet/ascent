# language: fr
Fonctionnalité: Expérience gagnée en tenant ses habitudes

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026

  Scénario: L'expérience existante est calculée à partir des suivis déjà enregistrés
    Étant donné que, avant cette version, « Cuisiner » est « fait » 7 jours entre le 5 et le 14 octobre
    Quand le joueur ouvre pour la première fois la version qui introduit l'expérience
    Alors le personnage a 70 Xp

  Scénario: L'en-tête affiche l'expérience totale sur chaque vue
    Étant donné que le personnage a 30 Xp
    Quand le joueur affiche la Vue Journée puis la Vue Semaine
    Alors l'en-tête affiche « 30 XP » sur les deux vues

  Scénario: Confirmer une habitude rapporte 10 Xp
    Étant donné que le personnage a 30 Xp
    Et que « Cuisiner » est « à faire » dans la Vue Journée
    Quand le joueur touche « Cuisiner »
    Alors le personnage a 40 Xp
    Et le feedback « +10 XP » s'affiche puis rejoint le compteur
    Et l'en-tête affiche « 40 XP »

  Scénario: Revenir à « à faire » retire 10 Xp
    Étant donné que le personnage a 40 Xp
    Et que « Cuisiner » est « fait » dans la Vue Journée
    Quand le joueur touche « Cuisiner »
    Alors le personnage a 30 Xp
    Et le feedback discret « −10 XP » s'affiche

  Scénario: Taps répétés, l'expérience suit exactement l'état
    Étant donné que le personnage a 30 Xp
    Et que « Cuisiner » est « à faire »
    Quand le joueur touche trois fois de suite « Cuisiner »
    Alors « Cuisiner » est « fait »
    Et le personnage a 40 Xp

  Scénario: Une correction vers « fait » rapporte 10 Xp
    Étant donné que le personnage a 30 Xp
    Et que « Cuisiner » est « pas fait » le mardi 13 octobre
    Quand le joueur corrige le mardi 13 octobre de « Cuisiner » en « fait »
    Alors le personnage a 40 Xp

  Scénario: Une correction vers « pas fait » retire 10 Xp
    Étant donné que le personnage a 40 Xp
    Et que « Cuisiner » est « fait » le lundi 12 octobre
    Quand le joueur corrige le lundi 12 octobre de « Cuisiner » en « pas fait »
    Alors le personnage a 30 Xp

  Scénario: La clôture du jour ne retire pas d'expérience
    Étant donné que le personnage a 30 Xp
    Et que « Cuisiner » est « à faire » le mercredi 14 octobre
    Quand le téléphone passe au jeudi 15 octobre 2026
    Alors « Cuisiner » est « pas fait » le mercredi 14 octobre
    Et le personnage a 30 Xp

  Scénario: Plusieurs habitudes rapportent chacune 10 Xp
    Étant donné que le joueur a 10 habitudes « à faire » et que le personnage a 0 Xp
    Quand il les confirme toutes dans la Vue Journée
    Alors le personnage a 100 Xp

  Scénario: Une case « à venir » ou « hors habitude » ne rapporte rien
    Étant donné que le joueur a aussi l'habitude « Budget du jour », créée le mardi 13 octobre 2026
    Et que le personnage a 30 Xp
    Quand il touche la case du jeudi 15 octobre de « Cuisiner »
    Et qu'il touche la case du lundi 12 octobre de « Budget du jour »
    Alors le personnage a 30 Xp
    Et aucun feedback d'expérience ne s'affiche

  Scénario: L'expérience ne descend jamais sous 0
    Étant donné que le personnage a 0 Xp
    Et que « Cuisiner » est « fait » dans la Vue Journée
    Quand le joueur touche « Cuisiner »
    Alors le personnage a 0 Xp
    Et l'en-tête affiche « 0 XP »

  Scénario: Un changement de fuseau ne change pas l'expérience
    Étant donné que le personnage a 40 Xp
    Quand le téléphone change de fuseau horaire et que la date du jour change
    Alors le personnage a 40 Xp

  Scénario: L'expérience est conservée après redémarrage
    Étant donné que le personnage a 40 Xp
    Quand le joueur ferme complètement l'application puis la rouvre
    Alors l'en-tête affiche « 40 XP »

  Scénario: Échec d'enregistrement, l'expérience est inchangée
    Étant donné que le personnage a 30 Xp
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur touche « Cuisiner » « à faire »
    Alors « Cuisiner » revient à l'état « à faire »
    Et le personnage a 30 Xp

  # Scénario d'interface (animations) : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Animations réduites
    Étant donné que le téléphone demande de réduire les animations
    Et que le personnage a 30 Xp
    Quand le joueur confirme « Cuisiner »
    Alors l'en-tête affiche « 40 XP » sans animation de déplacement
