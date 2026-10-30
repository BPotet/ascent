/**
 * Les modificateurs du héros (`HeroModifiers`, épique #89, prototype) : ce que les objets, les
 * bénédictions de départ et les bienfaits (#92) changent au héros dans un combat. Ils se combinent en un
 * seul jeu (`combineModifiers`) : listes concaténées, nombres additionnés. Les pourcentages se
 * multiplient ensuite en un seul calcul, arrondi une seule fois (P18, P21).
 */
export interface HeroModifiers {
  /** Un ajout fixe à l'Attaque, porté par les combats sauvegardés avant #152. */
  readonly attackFlat: number;
  /**
   * Le bonus de la caractéristique Attaque, en points de % additionnés (Tranchant, Armure de
   * chevalier déchu, #152), appliqué par `heroAttack`. À ne pas confondre avec `attackPercents`.
   */
  readonly attackBonusPercent: number;
  /** Les multiplicateurs des dégâts de l'Attaque, en % (Marteau 80), passés à `scaleDamage`. */
  readonly attackPercents: readonly number[];
  /** Les pourcentages du Brise-garde (Hache rouillée 110, Marteau 160). */
  readonly guardDamagePercents: readonly number[];
  /** Les bonus du multiplicateur de frappe parfaite, en points de % (Cuir 20). */
  readonly perfectStrikeBonusPercents: readonly number[];
  /** Les points de réduction des dégâts, sous le plafond de 40 % (Protection, Mailles, Armure de chevalier déchu). */
  readonly damageReductionPoints: number;
  /** Le bonus d'Initiative : arme, armure, accessoire et Hâte (P15). */
  readonly initiative: number;
  /** L'Élan de départ en plus (Élan). */
  readonly startingMomentum: number;
  /** Les PV rendus par impact paré parfaitement (Bouclier du veilleur). */
  readonly healOnPerfectParry: number;
  /** Les pourcentages des PV de la contre-attaque (Écho parfait 150, #92). */
  readonly counterPercents: readonly number[];
  /** Ajouté aux 150 % du multiplicateur d'étourdi (Braise ardente 50, #92). */
  readonly stunnedBonusPercent: number;
  /** La garde au retour en garde d'un étourdi, en % de son maximum (Givre persistant 50, #92) ; `null` : 100 %. */
  readonly guardRestorePercent: number | null;
  /** À chaque garde brisée : l'Élan gagné et les PV rendus (Cœur de braise, #92). */
  readonly onGuardBreak: { readonly momentum: number; readonly heal: number };
}

export const NO_MODIFIERS: HeroModifiers = {
  attackFlat: 0,
  attackBonusPercent: 0,
  attackPercents: [],
  guardDamagePercents: [],
  perfectStrikeBonusPercents: [],
  damageReductionPoints: 0,
  initiative: 0,
  startingMomentum: 0,
  healOnPerfectParry: 0,
  counterPercents: [],
  stunnedBonusPercent: 0,
  guardRestorePercent: null,
  onGuardBreak: { momentum: 0, heal: 0 },
};

/** Le plus petit pourcentage de retour en garde, `null` s'il n'y en a aucun. */
function smallestRestore(a: number | null, b: number | null | undefined): number | null {
  if (b === undefined || b === null) return a;
  return a === null ? b : Math.min(a, b);
}

export function combineModifiers(...all: readonly Partial<HeroModifiers>[]): HeroModifiers {
  return all.reduce<HeroModifiers>(
    (sum, each) => ({
      attackFlat: sum.attackFlat + (each.attackFlat ?? 0),
      attackBonusPercent: sum.attackBonusPercent + (each.attackBonusPercent ?? 0),
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
      counterPercents: [...sum.counterPercents, ...(each.counterPercents ?? [])],
      stunnedBonusPercent: sum.stunnedBonusPercent + (each.stunnedBonusPercent ?? 0),
      guardRestorePercent: smallestRestore(sum.guardRestorePercent, each.guardRestorePercent),
      onGuardBreak: {
        momentum: sum.onGuardBreak.momentum + (each.onGuardBreak?.momentum ?? 0),
        heal: sum.onGuardBreak.heal + (each.onGuardBreak?.heal ?? 0),
      },
    }),
    NO_MODIFIERS,
  );
}

/**
 * L'Attaque du héros (#152) : les % d'Attaque additionnés s'appliquent à l'Attaque de base en un seul
 * calcul, arrondis au plus proche, au moins +1 ; puis l'ajout fixe d'un combat sauvegardé.
 */
export function heroAttack(attackPower: number, modifiers: HeroModifiers): number {
  const bonus = modifiers.attackBonusPercent;
  const fromPercent = bonus > 0 ? Math.max(1, Math.round((attackPower * bonus) / 100)) : 0;
  return attackPower + fromPercent + modifiers.attackFlat;
}
