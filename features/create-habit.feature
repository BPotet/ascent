# language: fr
Fonctionnalité: Créer une habitude et la voir dans la Vue Journée

  Contexte:
    Étant donné que nous sommes le mercredi 14 octobre 2026 selon le téléphone

  Scénario: Premier lancement, aucune habitude
    Étant donné que le joueur n'a aucune habitude
    Quand il ouvre l'application
    Alors la Vue Journée s'affiche
    Et elle affiche l'état vide qui invite à créer une première habitude
    Et l'action « Ajouter une habitude » est proposée

  Scénario: La Vue Journée est l'écran d'accueil et affiche aujourd'hui
    Étant donné que le joueur a l'habitude « Cuisiner »
    Quand il ouvre l'application
    Alors la Vue Journée s'affiche
    Et l'en-tête indique le mercredi 14 octobre 2026

  Scénario: Créer une première habitude
    Étant donné que le joueur n'a aucune habitude
    Quand il ouvre le panneau « Nouvelle habitude »
    Et il saisit « Cuisiner »
    Et il valide
    Alors le panneau se ferme
    Et « Cuisiner » apparaît dans la Vue Journée à l'état « à faire »
    Et le jour de création de « Cuisiner » est le mercredi 14 octobre 2026

  Scénario: Les habitudes sont listées dans leur ordre de création
    Étant donné que le joueur a créé « Cuisiner » puis « Budget du jour »
    Quand il ouvre l'application
    Alors « Cuisiner » est affichée avant « Budget du jour »

  Scénario: Les habitudes sont conservées après redémarrage
    Étant donné que le joueur a créé l'habitude « Cuisiner »
    Quand il ferme complètement l'application puis la rouvre
    Alors « Cuisiner » est toujours affichée dans la Vue Journée

  Scénario: Le bouton de validation est désactivé tant que le nom est vide
    Étant donné que le panneau « Nouvelle habitude » est ouvert
    Quand le champ du nom est vide ou ne contient que des espaces
    Alors le bouton de validation est désactivé

  Scénario: Les espaces superflus sont retirés du nom
    Étant donné que le panneau « Nouvelle habitude » est ouvert
    Quand le joueur saisit «   Lire   20  minutes  » et valide
    Alors l'habitude créée s'appelle « Lire 20 minutes »

  Scénario: Nom de 40 caractères accepté
    Étant donné que le panneau « Nouvelle habitude » est ouvert
    Quand le joueur saisit un nom de 40 caractères et valide
    Alors l'habitude est créée

  Scénario: Nom de plus de 40 caractères refusé
    Étant donné que le panneau « Nouvelle habitude » est ouvert
    Quand le joueur saisit ou colle un nom de 41 caractères
    Alors aucune habitude dont le nom dépasse 40 caractères ne peut être créée
    Et le joueur est informé de la limite de 40 caractères

  Scénario: Doublon refusé sans tenir compte des majuscules
    Étant donné que le joueur a l'habitude « Cuisiner »
    Et que le panneau « Nouvelle habitude » est ouvert
    Quand le joueur saisit « cuisiner  » et valide
    Alors un message d'erreur indique qu'une habitude porte déjà ce nom
    Et le panneau reste ouvert avec la saisie conservée
    Et le joueur a toujours une seule habitude « Cuisiner »

  Scénario: Les accents distinguent deux noms
    Étant donné que le joueur a l'habitude « Eté sans sucre »
    Quand il crée l'habitude « Été sans sucre »
    Alors le joueur a les deux habitudes

  Scénario: Fermer le panneau sans créer
    Étant donné que le panneau « Nouvelle habitude » est ouvert avec la saisie « Méditer »
    Quand le joueur ferme le panneau sans valider
    Alors aucune habitude n'est créée

  Scénario: Limite de 10 habitudes atteinte
    Étant donné que le joueur a 10 habitudes
    Quand il regarde la Vue Journée
    Alors l'action « Ajouter une habitude » est désactivée
    Et un message explique qu'on peut avoir au plus 10 habitudes à la fois

  Scénario: Erreur de chargement des habitudes
    Étant donné que les habitudes enregistrées sur le téléphone ne peuvent pas être lues
    Quand le joueur ouvre l'application
    Alors la Vue Journée affiche l'état d'erreur avec une action « Réessayer »
    Et aucune donnée n'est effacée

  Scénario: Erreur d'enregistrement d'une nouvelle habitude
    Étant donné que le panneau « Nouvelle habitude » est ouvert avec la saisie « Méditer »
    Et que l'enregistrement sur le téléphone échoue
    Quand le joueur valide
    Alors un message indique que l'habitude n'a pas pu être enregistrée
    Et le panneau reste ouvert avec la saisie conservée
    Et « Méditer » n'apparaît pas dans la Vue Journée
