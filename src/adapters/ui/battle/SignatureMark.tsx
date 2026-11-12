import { StyleSheet, Text, View } from 'react-native';

import type { EnemySignature } from '../../../domain/battle/combatants';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { textFont } from '../pixelArt/pixelTypography';
import type { SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';

/**
 * Les teintes de chaque mécanique (maquette 245) : l'os, la ronce, l'acier ; le cyan du Balayage et
 * le bronze chauffé de la Charge (maquette 246, #266) ; la braise de la Brûlure pour la Cosse de
 * braise, l'or de l'Élan pour la Phalène voleuse (#267) : ce sont les ressources du joueur ; la
 * lueur citron de l'Aura (#268).
 */
const TINTS: Readonly<
  Record<EnemySignature, { readonly line: string; readonly fill: string; readonly ink: string }>
> = {
  exhume: {
    line: battleColors.grave,
    fill: battleColors.graveBackground,
    ink: battleColors.onGrave,
  },
  thorns: {
    line: battleColors.thorn,
    fill: battleColors.thornBackground,
    ink: battleColors.onThorn,
  },
  sanctuary: {
    line: battleColors.ward,
    fill: battleColors.wardBackground,
    ink: battleColors.onWard,
  },
  sweep: {
    line: battleColors.sweep,
    fill: battleColors.sweepBackground,
    ink: battleColors.onSweep,
  },
  charge: {
    line: battleColors.charge,
    fill: battleColors.chargeBackground,
    ink: battleColors.onCharge,
  },
  emberBurst: {
    line: battleColors.burn,
    fill: battleColors.burnBg,
    ink: battleColors.onBurn,
  },
  momentumTheft: {
    line: battleColors.stealLine,
    fill: battleColors.stealBackground,
    ink: battleColors.onSteal,
  },
  aura: {
    line: battleColors.aura,
    fill: battleColors.auraBackground,
    ink: battleColors.onAura,
  },
};

/** Le glyphe d'une marque allumée : l'os clair, le vert ronce, l'acier (maquette 245, `sigTag`). */
const GLYPH_TINTS: Readonly<Record<EnemySignature, string>> = {
  exhume: battleColors.onGrave,
  thorns: battleColors.thornLight,
  sanctuary: battleColors.ward,
  sweep: battleColors.sweep,
  charge: battleColors.charge,
  emberBurst: battleColors.burnRing,
  momentumTheft: battleColors.steal,
  aura: battleColors.aura,
};

/**
 * La marque de signature d'une Élite (`SignatureMark`, #258, maquette 245, `.ptag.sig`) : son
 * glyphe et son mot sous le nom, jamais la couleur seule. Elle ne lit que la vue générique de
 * l'ennemi (`EnemyView.signature`), et prend les teintes de sa mécanique : Exhumer en os, au cadre
 * doublé quand l'Exhumation est pour maintenant ; les Épines en ronce, barrées quand la Mère-ronce
 * est étourdie ; le Sanctuaire en acier (#259). Éteinte, elle est grisée. Elle tient sur une ligne
 * à 128 dp et passe à la ligne en texte agrandi. Le lecteur d'écran la lit avec la plaque.
 */
export function SignatureMark({
  signature,
  testID,
}: {
  readonly signature: SignatureView;
  readonly testID?: string;
}) {
  const { variant, glyph, text, off, now } = signature;
  const tint = TINTS[variant];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
      style={[
        styles.mark,
        { backgroundColor: tint.fill, borderColor: tint.line },
        now && [styles.now, { borderColor: tint.ink }],
        off && styles.off,
      ]}
    >
      <PixelIcon
        name={glyph}
        color={off ? battleColors.signatureOff : GLYPH_TINTS[variant]}
        testID={`signature-glyph-${glyph}`}
      />
      <Text
        style={[
          styles.text,
          { color: tint.ink },
          off && styles.offText,
          off && (variant === 'thorns' || variant === 'emberBurst') && styles.struck,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  // `.ptag.sig` : la teinte de la mécanique sur son fond, cernée de sa ligne.
  mark: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    paddingLeft: 3,
    paddingRight: 5,
    paddingVertical: 1,
    borderWidth: 1,
  },
  // `.ptag.grave.now` : le cadre doublé, de la teinte claire.
  now: { borderWidth: 2, paddingRight: 2, gap: 2 },
  // `.ptag.grave.full`, `.ptag.thorn.off`, `.ptag.ward.broken` : grisée, sans fond.
  off: { backgroundColor: 'transparent', borderColor: battleColors.signatureOffLine },
  text: { fontFamily: textFont.bold, fontSize: 10.5, lineHeight: 14 },
  offText: { color: battleColors.signatureOff },
  // `.ptag.thorn.off s`, `.ptag.off s` : « Épines 2 » et « Braises 2 » (#267) barrés tant qu'elle
  // est étourdie.
  struck: { textDecorationLine: 'line-through' },
});
