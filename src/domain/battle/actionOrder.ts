/**
 * Ordre d'action (`ActionOrder`, #32) : qui agit dans la manche, et dans quel ordre. `actionOrder`
 * est celui du #31 : le héros, puis les ennemis debout de gauche à droite. `initiativeOrder` est
 * celui du prototype #90 (P14), par Initiative ; il remplacera `actionOrder` avec la story #78.
 */

/** Un combattant de l'ordre d'action : le héros, ou l'indice d'un ennemi. */
export type Actor = 'hero' | number;

export function actionOrder(enemies: readonly { readonly hp: number }[]): Actor[] {
  return ['hero', ...enemies.flatMap((enemy, index) => (enemy.hp > 0 ? [index] : []))];
}

/**
 * L'ordre par Initiative décroissante (P14) : à égalité, le héros d'abord, puis les ennemis de
 * gauche à droite. Seuls les ennemis debout y entrent.
 */
export function initiativeOrder(
  heroInitiative: number,
  enemies: readonly { readonly hp: number; readonly initiative: number }[],
): Actor[] {
  const actors = [
    { actor: 'hero' as Actor, initiative: heroInitiative },
    ...enemies.flatMap((enemy, index) =>
      enemy.hp > 0 ? [{ actor: index as Actor, initiative: enemy.initiative }] : [],
    ),
  ];
  // Le tri est stable : à égalité, l'ordre de départ (le héros, puis de gauche à droite) reste.
  return actors.sort((left, right) => right.initiative - left.initiative).map(({ actor }) => actor);
}
