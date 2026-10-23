# language: fr
Fonctionnalité: Difficulté d'une habitude

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone

  Scénario: Créer une habitude avec la difficulté par défaut
    Quand le joueur ouvre « Nouvelle habitude »
    Alors la difficulté « Moyenne » est présélectionnée
    Et le bloc « Difficulté » propose « Facile +5 XP », « Moyenne +10 XP » et « Difficile +20 XP »
    Quand il saisit « Lire 20 pages » et valide avec la touche ↵ du clavier
    Alors l'habitude « Lire 20 pages » est créée avec la difficulté « Moyenne »

  Scénario: Créer une habitude difficile
    Quand le joueur crée l'habitude « Courir 5 km » en choisissant la difficulté « Difficile »
    Alors la ligne de « Courir 5 km » dans la Vue Journée affiche l'icône à 3 sommets et « Difficile »
    Et la carte de « Courir 5 km » dans la Vue Semaine affiche l'icône à 3 sommets et « Difficile »

  Plan du scénario: Une case « fait » rapporte l'expérience de sa difficulté
    Étant donné que le joueur a créé aujourd'hui l'habitude « Courir 5 km » avec la difficulté « <difficulté> »
    Et que le personnage a 30 Xp
    Quand le joueur touche « Courir 5 km » dans la Vue Journée
    Alors le personnage a <après> Xp
    Et le feedback « +<gain> XP » s'affiche puis rejoint le compteur
    Quand il touche de nouveau « Courir 5 km »
    Alors le personnage a 30 Xp
    Et le feedback discret « −<gain> XP » s'affiche, sans vibration

    Exemples:
      | difficulté | gain | après |
      | Facile     | 5    | 35    |
      | Moyenne    | 10   | 40    |
      | Difficile  | 20   | 50    |

  Scénario: Changer la difficulté réévalue toute la semaine en cours
    Étant donné que l'habitude « Courir 5 km », créée le lundi 5 octobre 2026 en « Moyenne », est « fait » le lundi 12 et le mardi 13 octobre
    Et que le personnage a 20 Xp
    Quand le joueur passe « Courir 5 km » en « Difficile » et enregistre
    Alors le personnage a 40 Xp
    Et le message « Habitude modifiée » s'affiche
    Quand il touche « Courir 5 km » dans la Vue Journée
    Alors le personnage a 60 Xp

  Scénario: Les semaines closes gardent leur difficulté
    Étant donné que l'habitude « Courir 5 km », créée le lundi 5 octobre 2026 en « Moyenne », est « fait » le vendredi 9 octobre et « pas fait » le jeudi 8 octobre
    Et que le personnage a 10 Xp
    Quand le joueur passe « Courir 5 km » en « Difficile » et enregistre
    Alors le personnage a 10 Xp
    Quand il corrige le jeudi 8 octobre de « Courir 5 km » en « fait »
    Alors le personnage a 20 Xp
    Et le feedback « +10 XP » s'affiche

  Scénario: Une correction dans la semaine en cours suit la difficulté de la semaine
    Étant donné que l'habitude « Courir 5 km », créée le lundi 5 octobre 2026 en « Moyenne », est « pas fait » le lundi 12 octobre
    Et que le joueur l'a passée en « Difficile » aujourd'hui
    Et que le personnage a 0 Xp
    Quand il corrige le lundi 12 octobre de « Courir 5 km » en « fait »
    Alors le personnage a 20 Xp

  Scénario: Baisser la difficulté retire l'écart sur la semaine en cours
    Étant donné que l'habitude « Courir 5 km », créée le lundi 5 octobre 2026 en « Difficile », est « fait » le lundi 12 et le mardi 13 octobre
    Et que le personnage a 40 Xp
    Quand le joueur passe « Courir 5 km » en « Facile » et enregistre
    Alors le personnage a 10 Xp
    Et aucune vibration n'accompagne la baisse

  Scénario: Plusieurs changements dans la semaine, le dernier l'emporte
    Étant donné que l'habitude « Courir 5 km », créée le lundi 5 octobre 2026 en « Moyenne », est « fait » le lundi 12 octobre
    Et que le personnage a 10 Xp
    Quand le joueur passe « Courir 5 km » en « Difficile » et enregistre
    Et qu'il la repasse en « Facile » et enregistre
    Alors le personnage a 5 Xp
    Et le lundi 19 octobre 2026, une case « fait » de « Courir 5 km » rapporte 5 Xp

  # Scénario d'interface : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Le panneau de modification annonce l'effet d'un changement de difficulté
    Étant donné que l'habitude « Courir 5 km » est en « Moyenne »
    Quand le joueur ouvre « Courir 5 km » pour la modifier
    Alors la difficulté « Moyenne » est présélectionnée
    Et « Enregistrer » est désactivé
    Quand il choisit « Difficile »
    Alors le message « S'applique à toute cette semaine : les suivis de la semaine rapporteront +20 XP. Les semaines passées ne changent pas. » s'affiche
    Et « Enregistrer » est activé

  Scénario: Les habitudes existantes passent en « Moyenne » sans changer l'expérience
    Étant donné que, avant cette version, le joueur a les habitudes « Cuisiner » et « Budget du jour »
    Et que le personnage a 70 Xp
    Quand il ouvre pour la première fois la version qui introduit la difficulté
    Alors « Cuisiner » et « Budget du jour » ont la difficulté « Moyenne »
    Et le personnage a 70 Xp

  Scénario: Supprimer une habitude retire l'expérience de son suivi d'aujourd'hui, au barème de sa difficulté
    Étant donné que l'habitude « Courir 5 km », en « Difficile », est « fait » le mardi 13 et le mercredi 14 octobre
    Et que le personnage a 40 Xp
    Quand le joueur choisit « Supprimer l'habitude » pour « Courir 5 km »
    Alors la fenêtre de confirmation annonce « −20 XP »
    Quand il confirme
    Alors le personnage a 20 Xp

  # Scénario d'interface : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Erreur de doublon, la difficulté choisie est conservée
    Étant donné que le joueur a l'habitude « Cuisiner »
    Quand il saisit « cuisiner » dans « Nouvelle habitude » avec la difficulté « Facile »
    Alors un message d'erreur indique qu'une habitude porte déjà ce nom
    Et la difficulté « Facile » reste sélectionnée

  Scénario: Échec d'enregistrement d'un changement de difficulté
    Étant donné que l'habitude « Courir 5 km », en « Moyenne », est « fait » le lundi 12 octobre
    Et que le personnage a 10 Xp
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur passe « Courir 5 km » en « Difficile » et enregistre
    Alors un message indique que la modification n'a pas pu être enregistrée
    Et « Courir 5 km » est toujours en « Moyenne »
    Et le personnage a 10 Xp

  # Scénario d'interface : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: L'aide au premier usage ne promet plus un montant fixe d'expérience
    Étant donné que le joueur n'a encore enregistré aucun suivi
    Et qu'il a l'habitude « Courir 5 km » avec la difficulté « Difficile »
    Quand il ouvre la Vue Journée
    Alors l'aide au premier usage affiche « Tape ton habitude quand c’est fait : ton personnage gagne de l’XP selon sa difficulté. »
    Quand il touche « Courir 5 km »
    Alors le feedback « +20 XP » s'affiche
    Et l'aide au premier usage disparaît

  # Scénario d'interface : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Le lecteur d'écran annonce la difficulté
    Quand le lecteur d'écran parcourt le bloc « Difficulté » de « Nouvelle habitude » après le choix de « Difficile »
    Alors il annonce le groupe « Difficulté »
    Et il annonce « Difficile, 20 XP par suivi, sélectionné »
