# language: fr
Fonctionnalité: Renommer et supprimer une habitude

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone
    Et que le joueur a l'habitude « Cuisiner », créée le lundi 5 octobre 2026
    Et qu'il a l'habitude « Budget du jour », créée le lundi 12 octobre 2026

  # Scénario d'interface (panneau) : exécuté par les étapes des écrans, pas par les cas d'usage.
  @ui
  Scénario: Ouvrir le panneau de modification
    Quand le joueur ouvre « Cuisiner » pour la modifier
    Alors le panneau « Modifier l'habitude » s'affiche avec le nom « Cuisiner »
    Et l'action « Supprimer l'habitude » est proposée
    Et l'enregistrement est désactivé tant que le nom n'a pas changé

  Scénario: Renommer une habitude conserve suivis et expérience
    Étant donné que « Cuisiner » est « fait » le lundi 12 octobre
    Et que le personnage a 10 Xp
    Quand le joueur renomme « Cuisiner » en « Cuisiner maison »
    Alors l'habitude s'appelle « Cuisiner maison » dans la Vue Journée et la Vue Semaine
    Et le lundi 12 octobre de « Cuisiner maison » est toujours « fait »
    Et son jour de création est toujours le lundi 5 octobre 2026
    Et le personnage a toujours 10 Xp

  Scénario: Changer seulement les majuscules du nom
    Quand le joueur renomme « Cuisiner » en « CUISINER »
    Alors l'habitude s'appelle « CUISINER »

  Scénario: Renommer vers le nom d'une autre habitude
    Quand le joueur renomme « Cuisiner » en « budget du jour »
    Alors un message d'erreur indique qu'une habitude porte déjà ce nom
    Et l'habitude s'appelle toujours « Cuisiner »

  Scénario: Renommer avec un nom vide ou trop long
    Quand le joueur efface le nom de « Cuisiner »
    Alors l'enregistrement est désactivé
    Quand il saisit ou colle un nom de 41 caractères
    Alors l'habitude ne peut pas être renommée avec plus de 40 caractères

  Scénario: Supprimer une habitude après confirmation
    Quand le joueur choisit « Supprimer l'habitude » pour « Cuisiner »
    Alors une fenêtre demande de confirmer la suppression de « Cuisiner »
    Quand il confirme
    Alors « Cuisiner » disparaît de la Vue Journée et de la Vue Semaine
    Et ses suivis sont effacés

  Scénario: Annuler la suppression
    Quand le joueur choisit « Supprimer l'habitude » pour « Cuisiner »
    Et qu'il annule dans la fenêtre de confirmation
    Alors « Cuisiner » est toujours affichée avec ses suivis
    Et l'expérience du personnage est inchangée

  Scénario: La suppression retire seulement l'expérience du suivi d'aujourd'hui
    Étant donné que « Cuisiner » est « fait » le lundi 12, le mardi 13 et le mercredi 14 octobre
    Et que « Budget du jour » est « fait » le mercredi 14 octobre
    Et que le personnage a 40 Xp
    Quand le joueur supprime « Cuisiner » et confirme
    Alors le personnage a 30 Xp

  Scénario: Sans suivi « fait » aujourd'hui, la suppression ne retire rien
    Étant donné que « Cuisiner » est « fait » le lundi 12 octobre et « à faire » aujourd'hui
    Et que le personnage a 10 Xp
    Quand le joueur supprime « Cuisiner » et confirme
    Alors le personnage a 10 Xp

  Scénario: La suppression ne fait jamais passer l'expérience sous 0
    Étant donné que « Cuisiner » est « fait » le mercredi 14 octobre
    Et que le personnage a 0 Xp
    Quand le joueur supprime « Cuisiner » et confirme
    Alors le personnage a 0 Xp

  Scénario: Une habitude supprimée disparaît des semaines précédentes
    Étant donné que le joueur a supprimé « Cuisiner »
    Quand il affiche la Vue Semaine
    Alors la semaine la plus ancienne consultable est celle du 12 au 18 octobre 2026
    Et « Cuisiner » n'apparaît dans aucune semaine

  Scénario: Recréer une habitude supprimée repart d'aujourd'hui
    Étant donné que le joueur a supprimé « Cuisiner », qui était « fait » le mardi 13 octobre
    Quand il crée une nouvelle habitude « Cuisiner »
    Alors son jour de création est le mercredi 14 octobre 2026
    Et la case du mardi 13 octobre de « Cuisiner » est « hors habitude » et non corrigeable
    Et le personnage n'a pas regagné d'expérience

  Scénario: Supprimer libère une place sous la limite de 10 habitudes
    Étant donné que le joueur a 10 habitudes
    Quand il supprime l'une d'elles et confirme
    Alors l'action « Ajouter une habitude » est de nouveau disponible

  Scénario: Supprimer la dernière habitude
    Étant donné que le joueur n'a plus que l'habitude « Cuisiner »
    Quand il supprime « Cuisiner » et confirme
    Alors la Vue Journée affiche l'état vide

  Scénario: Échec d'enregistrement d'un renommage
    Étant donné que l'enregistrement sur le téléphone échoue
    Quand le joueur renomme « Cuisiner » en « Cuisiner maison »
    Alors un message indique que le nom n'a pas pu être enregistré
    Et l'habitude s'appelle toujours « Cuisiner »

  Scénario: Échec d'enregistrement d'une suppression
    Étant donné que l'enregistrement sur le téléphone échoue
    Quand le joueur supprime « Cuisiner » et confirme
    Alors un message indique que la suppression n'a pas pu être enregistrée
    Et « Cuisiner » est toujours affichée avec ses suivis
    Et l'expérience du personnage est inchangée
