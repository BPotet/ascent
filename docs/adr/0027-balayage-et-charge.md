# ADR 0027 — Balayage et Charge

- **Statut** : accepté
- **Date** : 12 novembre 2026
- **Décideur** : Architect (notes techniques de #266), écrit par le dev
- **Contexte produit** : épique #246, story #266 « Le Beffroi : le Balayage du Battant de cloche et
  la Charge du Bélier de bronze »
- **Complète** : [ADR 0010](0010-contenu-recopie-de-l-atelier.md) (copie de l'Atelier),
  [ADR 0016](0016-journal-des-combats.md) (avenant du 12 novembre 2026),
  [ADR 0024](0024-exhumation-et-regle-du-sac.md) (action de soutien, marque de signature) et
  [ADR 0025](0025-signatures-d-elite-epines-et-sanctuaire.md) (lectures structurelles)

## Contexte

Le Beffroi reçoit deux ennemis ordinaires à mécanique. Le **Battant de cloche** porte un nouveau
type de coup, le **Balayage**, miroir du coup imparable : il se pare, l'esquive échoue (SW1 à SW7 du
Game Designer). Le **Bélier de bronze** annonce une **Charge** sur 2 manches, qu'une cassure de garde
annule avant la préparation de son Coup de bélier (CH1 à CH6, décisions du propriétaire du
9 novembre 2026).

## Décisions

1. **Le Balayage est un type de coup.** `AttackKind` reçoit `'sweep'`, `AttackProfile.sweep`
   (faux partout ailleurs, exclusif de `perilous`) : `ATTACKS.sweep = { windUpMs: 1_300,
   hitOffsetsMs: [0], feint: false, perilous: false, sweep: true }`. Son reflet est `sweep`
   (`glintsOf`), un trait horizontal cyan à l'écran.
2. **Issue `sweepDodge`.** Dans `judgeDefense`, une esquive **dans la fenêtre** sur un coup `sweep`
   passe par `failDefense`, le chemin de la parade sur un coup imparable : dégâts entiers
   (`heroDamage`), puis déséquilibre, sauf si le combat est fini. `afterDodge` n'est pas appelé :
   ni Élan de l'Errante, ni Pas de l'ombre. La parade suit le chemin ordinaire ; un appui hors de la
   fenêtre reste un appui raté, sans code.
3. **`sweepDodge` touche le héros** : elle rejoint `HERO_TOUCHED_OUTCOMES` (Saignement, Brûlure ;
   Rempart et Brume s'usent dès que les dégâts sont positifs). `EXTINGUISHING_OUTCOMES` ne change
   pas : aucune charge de Brûlure ne s'éteint.
4. **La Charge est une intention, plus un état sauvegardé.**
   - Codex : `Move.charge?: true` sur le Coup de bélier.
   - `ChargeIntent { category: 'charge' }` rejoint `Intent`. `drawIntent` reçoit
     `IntentContext.charging` ; les 3 tirages sont toujours consommés, dans le même ordre. Sans
     `charging`, un coup tiré avec `charge` par un ennemi non étourdi donne la Charge (CH1) ; un
     ennemi étourdi garde l'intention d'attaque, qu'il perdra. Avec `charging`, le tirage du coup
     est ignoré : le coup est celui qui a `charge`, préparation et dégâts calculés comme d'habitude
     (CH3).
   - L'action (CH2) passe par `startSupport`, comme l'Exhumation : un `SupportStep` de 400 ms,
     `EnemyState.charge = 'charging'`, événement `chargeStarted`. Aucun impact, aucune fenêtre.
   - `EnemyState.charge?: 'charging' | 'broken'`, sérialisé avec le combat.
   - `startAttack` efface `charging` et marque le pas `AttackStep.charged` et l'événement
     `windUpStarted.charged` : à partir de là, plus rien ne l'annule (« trop tard »).
   - Dans `hitEnemy`, une cassure (`hit.broken`) d'un ennemi **lu avant le coup** dont l'intention
     est la Charge ou qui charge met `charge = 'broken'` et émet `chargeBroken` juste après
     `guardBroken`, quel que soit l'auteur (CH4). L'étourdissement fait le reste. Au début de la
     manche suivante, `charging` est faux : le tirage est libre.
   - Effacements : la Charge brisée au retour en garde (`restoredEnemy`, aux deux sites de
     `restoreGuard` du moteur) ; tout état de Charge à la chute (CH6) : un Bélier relevé repart de
     zéro.
   - `chargeMark(battle, index)` (`charge.ts`) est la seule lecture de l'interface : `idle`,
     `first` (l'intention Charge, avant et après son action), `second` (il charge à la manche
     suivante, puis pendant son Coup de bélier `charged`), `broken`, `null` sans coup à Charge.
     `shownIntent` montre `{ category: 'charge', notches: 1 | 2 }` pendant les deux manches
     (maquette A8).
5. **Signature d'un ennemi ordinaire.** `EliteSignature` / `eliteSignature` deviennent
   `EnemySignature` / `enemySignature`, qui reçoit `'sweep'` (un coup `sweep`) et `'charge'` (un
   coup avec `charge`).
6. **Une bulle de première rencontre par combat.** `BattleSession.encounterOf` prend le premier
   ennemi à signature de la première ligne, de gauche à droite, dont la bulle n'a pas été vue ; un
   ennemi de la réserve n'est pas présenté dans ce combat (décision de l'orchestrateur). Clé
   inchangée : `battle.hint.encounter.<nom de code>.seen`.
7. **Trait de balayage : `SweepStroke`** (composant `SweepStroke.tsx`, champ de vue `swept`, à
   côté de `sealed`), accordé au nom français choisi par l'UX ; ses chevrons au sol sont
   `SweepTrail`.

## Conséquences

- **Aucune migration** : `SAVE_VERSION` reste 1 (`EnemyState.charge`, `AttackStep.charged` et
  l'issue `sweepDodge` sont des champs et une valeur ajoutés au JSON du combat).
- Toute nouvelle issue d'impact devra dire si elle touche le héros (`HERO_TOUCHED_OUTCOMES`) et si
  elle éteint une charge de Brûlure.
- Toute nouvelle source de cassure passe par `hitEnemy` : elle brise la Charge sans code de plus.
- En jeu, la contre-attaque et la Riposte du Rempart ne frappent le Bélier qu'après l'impact de son
  Coup de bélier, donc trop tard ; la règle ne regarde pas l'auteur de la cassure.
- La Sonneuse de matines ne remonte pas la garde du Bélier : l'intention Garde ne remonte que la
  garde de celui qui la joue (correction de l'orchestrateur du 12 novembre 2026).
- Le cyan du Balayage et son cœur clair sont ajoutés en fin de la palette d'art (ADR 0007) ; le
  reflet de balayage est fait en code (`battleEffects.ts`).
