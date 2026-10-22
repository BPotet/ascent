# language: fr
Fonctionnalité: Socle technique du combat 2D
  L'application est prête à accueillir le combat en 2D sans que rien ne change pour le joueur.
  Seul le build de preview ouvre la sonde de toucher, par un lien profond, pour choisir la méthode
  de datation des appuis du combat.

  # Scénarios de #46 exécutés ici, à travers les vraies routes de l'app. Les autres sont vérifiés
  # par leurs tests et jobs dédiés (tableau de traçabilité de la PR #47) : non-régression (parcours
  # e2e et test/app/* inchangés), build natif (job android-apk), setups Jest
  # (test/setup/*.smoke.test.tsx, TouchProbeScreen.test.tsx), pureté (test/lint/purity.test.mjs),
  # canal fixé par la CI (scripts/ci/build-channel.test.mjs).

  Plan du scénario: Limite — canal absent ou inconnu
    Étant donné une app dont le canal du build est <canal>
    Quand l'app lit son canal
    Alors elle se considère comme un build de production

    Exemples:
      | canal               |
      | absent              |
      | vide                |
      | « Preview »         |
      | « staging »         |

  # La dernière ligne du scénario de #46, « le parcours e2e preview-touch-probe passe sur
  # l'émulateur », est le parcours Maestro e2e/flows/preview-touch-probe.yaml.
  Scénario: La sonde de toucher mesure la datation sur le build de preview
    Étant donné le build de preview
    Quand on ouvre le lien ascent://preview/touch-probe et qu'on touche 20 fois la zone d'essai
    Alors la sonde affiche l'écart entre l'instant du toucher et l'horloge JS (médiane et p95)
    Et la méthode de datation retenue (a, b ou c, voir #31 § 7)

  Scénario: Erreur — la sonde est inaccessible en production
    Étant donné le build de production
    Quand on ouvre le lien ascent://preview/touch-probe
    Alors l'app redirige vers l'accueil
    Et aucun bouton ni menu ne mène à la sonde, quel que soit le canal
