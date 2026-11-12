# ADR 0028 — Éclatement et Vol d'Élan

- **Statut** : accepté
- **Date** : 12 novembre 2026
- **Décideur** : Architect (notes techniques de #267), écrit par le dev
- **Contexte produit** : épique #246, story #267 « Les Jardins de cendre : l'Éclatement de la Cosse
  de braise et le Vol d'Élan de la Phalène voleuse »
- **Complète** : [ADR 0010](0010-contenu-recopie-de-l-atelier.md) (copie de l'Atelier),
  [ADR 0016](0016-journal-des-combats.md) (avenant du 12 novembre 2026, #267),
  [ADR 0025](0025-signatures-d-elite-epines-et-sanctuaire.md) (lecture avant le coup, Épines) et
  [ADR 0027](0027-balayage-et-charge.md) (signature d'un ennemi ordinaire, une bulle par combat)

## Contexte

Les Jardins de cendre reçoivent deux ennemis ordinaires à mécanique. La **Cosse de braise** inflige
2 charges de **Brûlure** au héros à sa chute, sauf si elle est **étourdie** avant le coup qui la fait
tomber (EC1 à EC6 du Game Designer). La **Phalène voleuse** retire 1 **Élan** au héros à chaque
impact qui le touche, bonne parade comprise ; seules la parade parfaite et l'esquive le protègent
(VE1 à VE4, décision du propriétaire du 9 novembre 2026).

## Décisions

1. **Nom de code de l'Éclatement : `EmberBurst`**, champ de profil `emberBurst: { stacks }`.
   `Burst` est déjà l'Étincelle de l'interface. La valeur est recopiée du champ `burst` de
   `codex/emberPod` v1 : l'écart de nom est écrit dans le commentaire de `ENEMIES.emberPod`. La pose
   de l'Atelier garde son nom, `burst` (`ExtraFrame`), à côté de `smothered` et de `steal`.
   « Étouffée » est l'événement `emberBurstSmothered`.
2. **L'Éclatement vit dans `hitEnemy`, à la chute.** C'est le seul endroit où tombe un ennemi sous
   un coup du héros : frappe, frappe de pouvoir, contre-attaque, Riposte du Rempart (EC6, sans code
   par auteur). La règle est pure, dans `emberBurst.ts` (`emberBurstOnFall`), sans importer
   `Battle.ts` :
   - l'état est **lu avant le coup** (l'ennemi d'avant `blowOnEnemy`), comme les Épines (EC2) ; un
     coup qui brise et fait tomber est une chute, pas une cassure : elle éclate ;
   - une chute qui **gagne** le combat (`isWon` après la chute : personne debout, réserve vide) ne
     produit rien, ni charge ni événement (EC4) ;
   - sinon, debout : `addBurn` et `heroBurning { added, stacks, cause: 'emberBurst', enemy }`
     (`added` vaut 0 à 5 charges : l'Éclatement se voit et s'entend, EC1) ; étourdie :
     `emberBurstSmothered { at, enemy }` ;
   - elle ne passe ni par `heroDamage` ni par `resolveBlow` : ni réduction, ni Rempart, ni Brume,
     rien d'usé ; `stacks` est lu du profil, ni palier ni malédiction (EC5) ;
   - elle se place après `enemyDefeated` et `fallWithSummoner`, **avant** le changement de cible :
     une Cosse qui n'est pas la cible (abattue par la Riposte) éclate aussi. Une Cosse relevée par
     la Glaneuse de cendre repasse par `hitEnemy` à sa 2ᵉ chute (EC3, sans code).
3. **`heroBurning` reçoit deux champs facultatifs**, `cause?: 'emberBurst'` et `enemy?: number`,
   absents pour la Brûlure d'un impact. Il peut maintenant tomber pendant l'action du héros : le
   journal le range dans l'action en cours (le héros pour une frappe, l'ennemi qui portait le coup
   pour une contre-attaque ou une Riposte).
4. **Le Vol d'Élan vit dans `resolveBlow`.** Profil `momentumTheft: { amount }` (`MomentumTheft`,
   le champ du Codex tel quel). Règle pure dans `momentumTheft.ts` : `stolenMomentum(momentum,
   outcome, theft)` vaut `min(amount, momentum)` si l'issue est dans `HERO_TOUCHED_OUTCOMES`, 0
   sinon. Elle s'applique **après** les dégâts, le Rempart, la Brume, le Saignement et la Brûlure de
   l'impact (VE3), au héros **encore debout** : un impact qui le met à 0 PV ne vole rien (décision
   de l'orchestrateur), la seconde chance garde l'Élan qu'il avait. Si le vol est positif :
   `momentumStolen { at, enemy, stolen, momentum }`, puis `momentumChanged { momentum }`. Rien à
   0 Élan (VE1). La parade parfaite et l'esquive ne sont pas dans la liste (VE2) ; le +1 Élan de la
   parade parfaite ne change pas. L'esquive sur un Balayage (`sweepDodge`, #266) vole aussi, sans
   code. Ni palier ni malédiction (VE4).
5. **Signatures.** `enemySignature` reçoit `'emberBurst'` et `'momentumTheft'`. La lecture du
   domaine pour l'interface est `emberBurstPrimed(enemy)` (`emberBurst.ts`) : une Cosse debout et
   non étourdie, « Braises 2 » ; sinon la marque est barrée et grisée.
6. **Le temps de l'écran, pas du domaine.** `momentumChanged` est émis à l'impact (le journal et
   `powerAvailability` en ont besoin à cet instant) ; le losange quitte la barre 300 ms après
   (`MOMENTUM_STEAL_AFTER_IMPACT_MS`), et la barre d'Élan affichée garde l'Élan d'avant le vol
   jusque-là (`momentumShown`). L'Éclatement se montre 200 ms après la chute
   (`EMBER_BURST_AFTER_FALL_MS`), comme son son.

## Conséquences

- **Aucune migration** : `SAVE_VERSION` reste 1. Aucun état nouveau dans `EnemyState` ni
  `HeroState` : l'Éclatement et le vol se déduisent de l'état lu au moment du coup ; seuls des
  événements et des champs facultatifs s'ajoutent. Deux nouvelles clés de bulle, sans migration.
- Toute nouvelle façon de faire tomber un ennemi doit passer par `hitEnemy`, sinon une Cosse
  n'éclaterait pas.
- Toute nouvelle issue d'impact qui touche le héros (`HERO_TOUCHED_OUTCOMES`) fait aussi voler
  l'Élan.
- La liste fermée des effets de l'Équilibrage de l'Atelier (`burst`, `momentumTheft`) est hors du
  dépôt, à la charge de l'orchestrateur.
