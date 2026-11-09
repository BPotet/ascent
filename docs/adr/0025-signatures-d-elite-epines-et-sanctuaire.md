# ADR 0025 — Signatures d'Élite : Épines et Sanctuaire

- **Statut** : accepté
- **Date** : 9 novembre 2026
- **Décideur** : Architect (notes techniques de #259), écrit par le dev
- **Contexte produit** : épique #245, story #259 « La Mère-ronce et ses Épines, le Bedeau et son
  Sanctuaire : les 3ᵉ Élites des paliers 2 et 3 »
- **Complète** : [ADR 0010](0010-contenu-recopie-de-l-atelier.md) (copie de l'Atelier),
  [ADR 0016](0016-journal-des-combats.md) (avenant du 9 novembre 2026) et
  [ADR 0024](0024-exhumation-et-regle-du-sac.md) (marque de signature, règle du sac)

## Contexte

Les paliers 2 et 3 reçoivent chacun une 3ᵉ Élite à mécanique signature. Les **Épines** de la
Mère-ronce coûtent des PV au héros à chaque frappe sur elle tant qu'elle n'est pas étourdie (T1 à T4
du Game Designer). Le **Sanctuaire** du Bedeau le protège lui-même : chaque coup du héros ne lui
retire que la moitié des PV tant que sa garde tient (S1 à S3, décision Q2 du propriétaire). Briser
la garde devient l'objectif de ces combats.

## Décisions

1. **La signature est une donnée du Codex, sur le profil de l'ennemi.** `EnemyProfile.thorns?:
   Thorns` (`{ damage: 2 }`) et `EnemyProfile.sanctuary?: Sanctuary` (`{ damagePercent: 50 }`),
   recopiés de la fiche comme `selfRevive` ou `exhume`. Ils ne sont jamais multipliés (ni palier, ni
   Élite, ni malédiction). Les ennemis d'escorte sont d'autres types : ils n'ont pas de signature,
   sans aucun code d'escorte. `eliteSignature` rend `'thorns'` ou `'sanctuary'`.
2. **Aucun état nouveau, aucune migration.** Épines et Sanctuaire se déduisent de l'état de
   l'ennemi **lu avant le coup** (`stun`, `guard`) : aucun champ dans `EnemyState`, `Battle` ou la
   phase de frappe ; `SAVE_VERSION` reste 1.
3. **Épines : une fois par frappe, au 1er coup.** Seulement dans `resolveStrike` (frappe en rythme
   et frappe de pouvoir) : la cible, lue avant `hitEnemy`, a `thorns` et `stun === null`, et le coup
   est le 1er de la frappe. Le coup se résout d'abord (dégâts, cassure, Cœur de braise, chute), puis
   le héros paie (`prick`), avant l'arrêt sur image. Les coups suivants (Dagues jumelles, Rafale,
   Frappe furtive) ne piquent jamais ; la frappe qui brise la garde ou fait tomber la Mère-ronce
   pique. `counterAttack` (contre-attaque, Riposte du Rempart) ne pique jamais.
4. **Les Épines passent à côté de `heroDamage`** : perte = `min(damage, hp − 1)`, au moins 0
   (`thornsLoss`). Ni réduction des dégâts, ni Rempart, ni Brume, et elles ne les usent pas. Le
   héros ne tombe jamais : pas de seconde chance.
5. **Événement `thornsPricked`** `{ at, enemy, loss, heroHp }` à chaque frappe qui pique, même avec
   `loss: 0` (le lecteur d'écran dit « Épines : tu restes à 1 PV »). `at` est l'instant du 1er coup.
6. **Sanctuaire : un pourcentage de plus dans le même arrondi.** `sanctuaryPercents(enemy)` rend
   `[50]` si le profil a `sanctuary`, si `guard > 0` et si `stun === null`, sinon `[]`.
   `resolveStrike` l'ajoute aux `attackPercents` de `strikeBlow`, `counterAttack` à ceux de
   `counterBlow` et `bulwarkCounterBlow` : un seul `scaleDamage` (entier inférieur, minimum 1), sur
   les PV seulement ; la garde retirée ne change pas. Le coup qui brise est réduit ; ensuite, × 1,5
   sans réduction ; au retour en garde, le Sanctuaire revient sans code.
7. **Drapeau `sanctuary?: true`** sur `strikeResolved`, `counterAttacked` et `bulwarkCountered`
   quand le Sanctuaire a réduit le coup ; absent sinon (le JSON des autres combats ne change pas).
8. **Lectures pour l'interface** : `thornsActive(enemy)` et `sanctuaryUp(enemy)`, dans `thorns.ts`
   et `sanctuary.ts`, sur des types structurels (sans importer `Battle.ts`). L'interface ne refait
   aucune règle.
9. **Affichage de la piqûre : après la frappe** (décision de l'orchestrateur, écran M3). La règle
   reste au 1er coup ; la session de combat et l'état d'affichage gardent la piqûre en attente tant
   qu'un coup de la frappe reste à résoudre (`strikeUnderway`), puis la montrent
   `THORNS_AFTER_STRIKE_MS` (300 ms) plus tard : le « −2 », le mot « Épines », les pointes, le cadre
   de la plaque, la vibration `thorns`. La barre de PV du héros baisse avec le « −2 ».

## Conséquences

- Une seule règle par endroit : les Épines vivent dans `resolveStrike` seul, le Sanctuaire dans
  `resolveStrike` et `counterAttack`. **Toute nouvelle source de dégâts du héros sur un ennemi devra
  dire si elle pique et si le Sanctuaire la réduit.**
- Les garde-fous du Game Designer (Épines à 1 au-delà de 10 % des PV max par combat ; garde du
  Bedeau à 56 au-delà de 7 frappes pour la briser) sont des valeurs du Codex : un changement passe
  par l'Atelier, puis une ligne de `ENEMIES`. Le journal porte les deux mesures (ADR 0016).
- Le Cœur de braise soigne avant les Épines : à PV max, la frappe qui brise laisse le héros à
  PV max − 2.
- Les effets de la piqûre, de l'étincelle et de la rupture sont faits en code
  (`battle/scene/signatureScene.ts`), le vert ronce et l'acier ajoutés en fin de la palette d'art
  (ADR 0007).
