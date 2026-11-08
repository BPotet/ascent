# language: fr
Fonctionnalité: Réglages du combat
  Story #211 (épique #210) : des préparations ennemies plus régulières (×0,9 à ×1,1), une fenêtre
  de frappe parfaite de 40 ms, et la garde des Élites du palier 2 recopiée du Codex de l'Atelier
  (`codex/scarecrow` v3, `codex/brambleBurner` v4).

  # Les scénarios `@domain` éprouvent les règles du domaine ; « avant » rejoue le même moteur avec
  # l'ancienne variation de la préparation (×0,8 à ×1,2). Le scénario `@session` passe par une vraie
  # session d'ascension sur un Stockage clé-valeur en mémoire.

  @domain
  Scénario: La préparation varie de ×0,9 à ×1,1
    Étant donné un coup ennemi dont la préparation de base dure 1 000 ms
    Quand sa préparation est tirée au début de la manche
    Alors elle dure entre 900 ms et 1 100 ms

  @domain
  Scénario: Les tirages de la préparation restent les mêmes
    Étant donné une graine du combat
    Quand le combat se joue avant et après le changement
    Alors les intentions, les cibles, les dégâts et l'ordre d'action tirés sont les mêmes
    Et seules les durées de préparation changent

  @domain
  Scénario: Le palier 1 ne change que par ses durées de préparation
    Étant donné les 200 ascensions rejouées du palier 1
    Quand elles sont rejouées après le changement
    Alors les groupes, les Élites, les boss, l'Or, le butin, les intentions, les PV et la garde sont les mêmes qu'avant
    Et la comparaison avant / après ne montre que des durées de préparation changées

  @domain
  Scénario: Une frappe à 40 ms est parfaite
    Étant donné le héros frappe en rythme
    Quand le joueur touche « Frapper » avec un écart de 40 ms
    Alors c'est une frappe parfaite

  @domain
  Scénario: Une frappe à 41 ms n'est plus parfaite
    Étant donné le héros frappe en rythme
    Quand le joueur touche « Frapper » avec un écart de 41 ms, en avance ou en retard
    Alors c'est une bonne frappe (×1,2), sans arrêt sur image ni « Frappe parfaite »

  @domain
  Scénario: Les défenses gardent leur fenêtre parfaite de 60 ms
    Étant donné un coup ennemi
    Quand le joueur pare avec un écart de 60 ms
    Alors c'est une parade parfaite, comme avant

  # #257 (décision du 08/11/2026) : les PV des Élites du palier 2 à 80 % ; les gardes ne changent pas.
  @session
  Scénario: La garde des Élites du palier 2
    Étant donné une porte Élite du palier 2
    Quand le combat commence contre l'Épouvantail
    Alors il a 152 PV et une garde de 70
    Et contre le Brûleur de ronces, 168 PV et une garde de 77
