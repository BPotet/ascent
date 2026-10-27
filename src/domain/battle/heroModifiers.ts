/**
 * Les modificateurs du héros (`HeroModifiers`, épique #89, prototype) : ce que les objets, les
 * bénédictions de départ et les bienfaits changent au héros dans un combat. Ils se combinent en un
 * seul jeu (`combineModifiers`) : listes concaténées, nombres additionnés. Les pourcentages se
 * multiplient ensuite en un seul calcul, arrondi une seule fois (P18, P21).
 */
export interface HeroModifiers {
  /** Un ajout fixe à l'Attaque, avant les pourcentages (Tranchant). */
  readonly attackFlat: number;
  /** Les pourcentages de l'Attaque (Marteau 80). */
  readonly attackPercents: readonly number[];
  /** Les pourcentages du Brise-garde (Hache 130, Marteau 160). */
  readonly guardDamagePercents: readonly number[];
  /** Les bonus du multiplicateur de frappe parfaite, en points de % (Cuir 20). */
  readonly perfectStrikeBonusPercents: readonly number[];
  /** Les points de réduction des dégâts, sous le plafond de 40 % (Égide, Mailles). */
  readonly damageReductionPoints: number;
  /** Le bonus d'Initiative : arme, armure, accessoire et Hâte (P15). */
  readonly initiative: number;
  /** L'Élan de départ en plus (Élan). */
  readonly startingMomentum: number;
  /** Les PV rendus par impact paré parfaitement (Bouclier du veilleur). */
  readonly healOnPerfectParry: number;
}

export const NO_MODIFIERS: HeroModifiers = {
  attackFlat: 0,
  attackPercents: [],
  guardDamagePercents: [],
  perfectStrikeBonusPercents: [],
  damageReductionPoints: 0,
  initiative: 0,
  startingMomentum: 0,
  healOnPerfectParry: 0,
};

export function combineModifiers(...all: readonly Partial<HeroModifiers>[]): HeroModifiers {
  return all.reduce<HeroModifiers>(
    (sum, each) => ({
      attackFlat: sum.attackFlat + (each.attackFlat ?? 0),
      attackPercents: [...sum.attackPercents, ...(each.attackPercents ?? [])],
      guardDamagePercents: [...sum.guardDamagePercents, ...(each.guardDamagePercents ?? [])],
      perfectStrikeBonusPercents: [
        ...sum.perfectStrikeBonusPercents,
        ...(each.perfectStrikeBonusPercents ?? []),
      ],
      damageReductionPoints: sum.damageReductionPoints + (each.damageReductionPoints ?? 0),
      initiative: sum.initiative + (each.initiative ?? 0),
      startingMomentum: sum.startingMomentum + (each.startingMomentum ?? 0),
      healOnPerfectParry: sum.healOnPerfectParry + (each.healOnPerfectParry ?? 0),
    }),
    NO_MODIFIERS,
  );
}
