/**
 * Ordre d'action (`ActionOrder`, #32) : qui agit dans la manche, et dans quel ordre. Ici, celui du
 * #31 : le héros, puis les ennemis debout de gauche à droite. Point d'extension de la story
 * « Initiative et frise d'action » (#78), qui le triera par Initiative.
 */

/** Un combattant de l'ordre d'action : le héros, ou l'indice d'un ennemi. */
export type Actor = 'hero' | number;

export function actionOrder(enemies: readonly { readonly hp: number }[]): Actor[] {
  return ['hero', ...enemies.flatMap((enemy, index) => (enemy.hp > 0 ? [index] : []))];
}
