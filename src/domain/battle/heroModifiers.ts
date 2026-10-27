/**
 * Les modificateurs du héros (`HeroModifiers`, prototype #92, règles P18 et P21 de #88) : les
 * effets de build (bienfaits, puis objets et bénédictions) appliqués au héros dans un combat. Les
 * multiplicateurs restent en listes de pourcentages, pour un seul calcul et un seul arrondi.
 */
export interface HeroModifiers {
  /** Les multiplicateurs des PV de la contre-attaque. */
  readonly counterPercents: readonly number[];
  /** Les multiplicateurs du Brise-garde (frappe et contre-attaque). */
  readonly guardDamagePercents: readonly number[];
  /** Ajoutés à la réduction des dégâts du héros, avant son plafond de 40 %. */
  readonly damageReductionPoints: number;
  /** Les bonus du multiplicateur de frappe parfaite, additionnés. */
  readonly perfectStrikeBonusPercents: readonly number[];
  /** Ajouté aux 150 % du multiplicateur d'étourdi. */
  readonly stunnedBonusPercent: number;
  /** La garde au retour en garde d'un étourdi, en % de son maximum ; `null` : 100 %. */
  readonly guardRestorePercent: number | null;
  /** À chaque garde brisée : l'Élan gagné et les PV rendus. */
  readonly onGuardBreak: { readonly momentum: number; readonly heal: number };
}

/** Aucun effet : le combat d'essai et le combat de l'ascension sans build. */
export const NO_MODIFIERS: HeroModifiers = {
  counterPercents: [],
  guardDamagePercents: [],
  damageReductionPoints: 0,
  perfectStrikeBonusPercents: [],
  stunnedBonusPercent: 0,
  guardRestorePercent: null,
  onGuardBreak: { momentum: 0, heal: 0 },
};

/** Deux sources d'effets combinées : listes mises bout à bout, points additionnés. */
export function combineModifiers(a: HeroModifiers, b: HeroModifiers): HeroModifiers {
  return {
    counterPercents: [...a.counterPercents, ...b.counterPercents],
    guardDamagePercents: [...a.guardDamagePercents, ...b.guardDamagePercents],
    damageReductionPoints: a.damageReductionPoints + b.damageReductionPoints,
    perfectStrikeBonusPercents: [...a.perfectStrikeBonusPercents, ...b.perfectStrikeBonusPercents],
    stunnedBonusPercent: a.stunnedBonusPercent + b.stunnedBonusPercent,
    guardRestorePercent:
      a.guardRestorePercent === null || b.guardRestorePercent === null
        ? (a.guardRestorePercent ?? b.guardRestorePercent)
        : Math.min(a.guardRestorePercent, b.guardRestorePercent),
    onGuardBreak: {
      momentum: a.onGuardBreak.momentum + b.onGuardBreak.momentum,
      heal: a.onGuardBreak.heal + b.onGuardBreak.heal,
    },
  };
}
