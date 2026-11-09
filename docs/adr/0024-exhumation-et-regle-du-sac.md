# ADR 0024 — Exhumation et règle du sac

- **Statut** : accepté
- **Date** : 9 novembre 2026
- **Décideur** : Architect (notes techniques de #258), écrit par le dev
- **Contexte produit** : épique #245, story #258 « Le Fossoyeur exhume des Squelettes, et chaque
  Élite du palier passe avant qu'une revienne »
- **Complète** : [ADR 0010](0010-contenu-recopie-de-l-atelier.md),
  [ADR 0013](0013-invocation.md) et [ADR 0016](0016-journal-des-combats.md) (avenants du
  9 novembre 2026), et la règle R5 de [ADR 0020](0020-multiplicateur-d-elite-et-de-boss.md)

## Contexte

Le palier 1 reçoit une 3ᵉ Élite, le Fossoyeur, qui exhume un Squelette aux manches paires (X1 à X4
du Game Designer). Jusqu'ici, seul un boss appelait des ennemis, par l'Invocation de son changement
de phase, et ses invoqués entraient au début d'une manche. L'Exhumation est une intention affichée
d'avance, que le héros peut empêcher en brisant la garde, et son Squelette entre au milieu de la
manche. Avec 3 Élites au palier, l'Élite non répétée (R5 : « jamais la dernière ») ne suffit plus à
renouveler les rencontres : le propriétaire a validé la règle du sac.

## Décision

1. **Exhumer est une intention dont la place est fixée au tirage.** Le Codex donne
   `exhume: { enemy, rounds: 'even', maxStanding: 1 }`, recopié tel quel dans
   `EnemyProfile.exhume`. `exhumeSlot(enemies, index, round)` (`exhume.ts`, pur, sans hasard) rend
   la place si l'ennemi a `exhume`, que la manche est paire, qu'il est debout et non étourdi, que
   moins de `maxStanding` ennemis exhumés sont debout et que `freeSlots` (ADR 0013, règle 6) rend
   une place. `startRound` le passe à `drawIntent` (`IntentContext.exhumeSlot`), qui tire toujours
   ses 3 valeurs puis rend `{ category: 'exhume', slot }` : l'intention ne change jamais les
   tirages. Entre le début de la manche et l'action, aucune place libre ne peut être reprise.
2. **L'Exhumation est l'action du Fossoyeur, sur le modèle de Relever** : `startSupport` la joue
   (400 ms, `SUPPORT_ACTION_MS`). La place reçoit un ennemi aux valeurs des invoqués du palier,
   `summoned` (les règles de l'Invoqué), `exhumed` (le plafond, la frise, le journal) et
   `raisedRound` (« n'agit pas »). Une place vide allonge la ligne, celle d'un tombé est reprise.
   La place était libre au début de la manche, donc hors de l'ordre d'action : il n'agit pas dans
   la manche, sans règle de plus. Nouvel événement `enemyExhumed`, sauvegardé.
3. **La garde brisée avant son tour ne demande aucun code** : `stunTurn` perd l'action sans jouer
   l'intention ; rien n'est reporté, X1 est réévalué à chaque manche paire.
4. **La chute avec celui qui appelle** : `summonedKind(kind)` (`summon.ts`) rend l'ennemi de
   l'Invocation de phase 2 ou de l'Exhumation ; `fallWithSummoner` joue pour tout ennemi qui en a
   un. Un seul ennemi appelle par combat.
5. **La règle du sac remplace R5** : `Ascent.facedElites` (les Élites affrontées au palier, dans
   l'ordre) remplace `lastElite`. `eliteCandidates(elites, faced)` rend, dans l'ordre du palier,
   celles qui ne sont pas dans `faced` ; sinon toutes sauf `faced.at(-1)` ; sinon toutes.
   `chooseExit` ajoute l'Élite tirée, `enterNextTier` vide la liste. L'ordre des tirages de
   l'ascension ne change pas (ADR 0023, point 4) ; seul le nombre de candidats change. Avec 2
   Élites, la règle donne exactement R5.
6. **Sans migration** (`SAVE_VERSION` 1) : `parse` d'`AscentSession` relit `lastElite` comme
   `facedElites: [lastElite]` et retire la clé ; `facedElites` l'emporte si les deux sont là. Les
   champs du combat (`exhumed`, l'intention `exhume`, l'étape d'Exhumation) sont facultatifs.
7. **L'interface ne décide d'aucune règle** : la marque de signature lit `exhumeMark(battle,
   index)` (`next`, `now`, `lost`, `standing`) par une seule vue générique par ennemi
   (`EnemyView.signature`), que #259 étendra aux Épines et au Sanctuaire. Sans place libre, la
   marque n'a pas d'état propre (décision de l'orchestrateur) : la règle reste dans `exhumeSlot`.
   La bulle de première rencontre est retenue par une clé par Élite
   (`battle.hint.encounter.<nom de code>.seen`), dans le stockage clé-valeur existant.

## Alternatives écartées

- Fixer la place à l'action : une place pourrait changer entre l'intention et l'action, et
  l'écran montrerait une intention qui ne s'accomplit pas là où elle était annoncée.
- Faire entrer le Squelette par `summonEnter`, au début de la manche suivante : l'Exhumation ne
  serait plus une action qu'une cassure peut empêcher.
- Garder `lastElite` à côté d'une nouvelle liste : deux sources de vérité.

## Conséquences

- Les 200 marches figées du palier 1 sont régénérées (le Fossoyeur entre dans le tirage), jamais la
  graine ; un contrôle de préfixe borne ce changement (voir `tierOneDraws.ts`).
- La scène passe d'une colonne à trois (`el3`) à la 1ʳᵉ Exhumation et ne se redispose plus.
- Le journal des combats compte les exhumations par combat sur les effets `enemyExhumed`.
- Rien ne quitte le téléphone.
