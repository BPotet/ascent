# language: fr
Fonctionnalité: Rééquilibrage du palier 3
  Story #244 (épique #243) : des gardes plus solides, des Élites et des boss plus forts aux paliers
  2 et 3, des soins de combat mesurés et des Élites variées, pour que le Sommet redevienne un vrai
  défi.

  # Les scénarios `@domain` éprouvent les règles du domaine (moteur du combat, règle du palier,
  # ascension). Les scénarios `@session` passent par une vraie session d'ascension sur un Stockage
  # clé-valeur en mémoire. Le Coup de bouclier (#236) n'existe pas encore : son scénario est vérifié
  # sur le calcul de la garde retirée (`strikeBlow`).

  # G1 — Brise-garde d'une frappe
  @domain
  Scénario: Les bonus de frappe parfaite n'entrent que dans les PV
    Étant donné la Sentinelle avec Lame juste et Heure juste
    Quand elle fait une frappe parfaite sur un ennemi non étourdi
    Alors elle retire 23 PV et 18 de garde

  @domain
  Scénario: Les pourcentages de Brise-garde s'appliquent à la garde
    Étant donné la Sentinelle avec Lame juste, Heure juste et Braise brisante
    Quand elle fait une frappe parfaite sur un ennemi non étourdi
    Alors elle retire 23 de garde

  @domain
  Scénario: Frappe de pouvoir parfaite avec une part de garde
    Étant donné la Sentinelle avec Lame juste
    Quand elle fait un Coup de bouclier parfait sur un ennemi non étourdi
    Alors elle retire 36 de garde (12 × 150 % × 200 %)

  @domain
  Scénario: Chaque coup de l'Errante est calculé seul
    Étant donné l'Errante avec Lame juste et Entaille
    Quand elle fait une frappe parfaite sur un ennemi non étourdi
    Alors elle retire 11 + 11 de garde

  @domain
  Scénario: Une bonne frappe ne change pas
    Étant donné la Sentinelle avec Lame juste
    Quand elle fait une bonne frappe sur un ennemi non étourdi
    Alors elle retire 14 de garde, comme aujourd'hui

  @domain
  Scénario: Aucune garde retirée sur un ennemi étourdi
    Étant donné un ennemi étourdi
    Quand le héros fait une frappe parfaite sur lui
    Alors il ne perd aucun point de garde

  @domain
  Scénario: Contre-attaques et Riposte du Rempart inchangées
    Étant donné la Sentinelle avec Lame juste
    Quand elle contre-attaque après une parade parfaite, ou que sa Riposte du Rempart frappe
    Alors la garde retirée est la même qu'avant le rééquilibrage
