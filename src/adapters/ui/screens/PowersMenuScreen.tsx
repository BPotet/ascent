import { type Ref, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RefusalHaptics } from '../../../application/ports/RefusalHaptics';
import type { AscentSession } from '../../../application/useCases/AscentSession';
import type { CampSession, CampView } from '../../../application/useCases/CampSession';
import type { NewPowerStanding } from '../../../domain/ascent/equippedPowers';
import type { OathStanding } from '../../../domain/ascent/oaths';
import { EQUIPPED_POWER_SLOTS } from '../../../domain/ascent/powerTree';
import type { HeroKind } from '../../../domain/battle/combatants';
import type { PowerKind } from '../../../domain/battle/powers';
import { HeroTabs } from '../components/HeroTabs';
import { PowersMenuRow, type PowersMenuRowMode } from '../components/PowersMenuRow';
import { Screen } from '../components/Screen';
import { CAMP_TITLE } from '../format/campText';
import { fullSlotsBand, missingChoiceText } from '../format/powerText';
import {
  ASCENT_SUBTITLE,
  FIRST_OPEN_BAND,
  LOCKED_FOOT_NOTE,
  NEXT_ASCENT_SUBTITLE,
  OFFICE_FOOT_NOTE,
  POWERS_LOADING,
  POWERS_MENU_TITLE,
  POWERS_SAVE_ERROR,
  autoEquippedBand,
  backLabel,
  equippedAnnouncement,
  lockedBand,
  menuHeading,
  menuOathLine,
  missingLabel,
  officeBand,
  otherMissingText,
  slotsText,
  waitingBand,
  type MenuOathLine,
  type TabBadge,
} from '../format/powersMenuText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { MIN_TARGET_SIZE, PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { PixelSkeleton } from '../pixelArt/PixelSkeleton';
import { pixelFont, textFont } from '../pixelArt/pixelTypography';
import { useAscent } from '../state/useAscent';
import { useCamp } from '../state/useCamp';
import { useFateGauge } from '../state/useFateGauge';

const { roles } = artPalette;
const LINE = artPixelSize(2);
const HEROES: readonly HeroKind[] = ['sentinel', 'wanderer'];

type Draft = Readonly<Record<HeroKind, readonly PowerKind[]>>;

/** Ce que l'écran fige à son ouverture (D3) : les pouvoirs nouveaux et la première ouverture. */
interface Opening {
  readonly newPowers: Readonly<Record<HeroKind, NewPowerStanding>>;
  readonly firstOpen: boolean;
}

/** Le bandeau unique du menu : son ton, son texte, et s'il est une alerte (M7). */
interface Band {
  readonly tone: 'info' | 'done' | 'error' | 'locked';
  readonly text: string;
}

const sameChoice = (left: readonly PowerKind[], right: readonly PowerKind[]) =>
  left.length === right.length && left.every((power) => right.includes(power));

/** Le nombre de places d'un héros : min(3, possédés). */
const slotsOf = (view: CampView, hero: HeroKind) =>
  Math.min(EQUIPPED_POWER_SLOTS, view.owned[hero].length);

/**
 * Le bandeau, dans l'ordre de priorité de la maquette : l'échec (M7), un pouvoir nouveau sans place
 * (M9), un pouvoir équipé tout seul (M8), le refus d'un 4e (M2), puis l'ascension en cours (M10), la
 * première ouverture (M12) ou l'équipé d'office (M4). Pendant une ascension, le menu est en lecture
 * seule : aucun bandeau de pouvoir nouveau.
 */
function bandOf({
  hero,
  view,
  opening,
  failed,
  refused,
  locked,
}: {
  readonly hero: HeroKind;
  readonly view: CampView;
  readonly opening: Opening;
  readonly failed: boolean;
  readonly refused: PowerKind | null;
  readonly locked: HeroKind | null;
}): Band | null {
  if (failed) return { tone: 'error', text: POWERS_SAVE_ERROR };
  const fresh = opening.newPowers[hero];
  if (locked === null && fresh.waiting[0] !== undefined) {
    return { tone: 'info', text: waitingBand(fresh.waiting[0]) };
  }
  if (locked === null && fresh.autoEquipped[0] !== undefined) {
    return { tone: 'done', text: autoEquippedBand(fresh.autoEquipped[0]) };
  }
  if (refused !== null) return { tone: 'info', text: fullSlotsBand(refused) };
  if (locked !== null) return { tone: 'locked', text: lockedBand(locked) };
  if (opening.firstOpen) return { tone: 'info', text: FIRST_OPEN_BAND };
  const owned = view.owned[hero].length;
  if (owned <= EQUIPPED_POWER_SLOTS) return { tone: 'info', text: officeBand(owned) };
  return null;
}

function BandView({ band, ref }: { readonly band: Band; readonly ref: Ref<View> }) {
  const alert = band.tone === 'error';
  return (
    <View
      ref={ref}
      accessible
      testID="powers-menu-band"
      role={alert ? 'alert' : 'status'}
      {...(!alert && { accessibilityLiveRegion: 'polite' as const })}
      style={[styles.band, { borderWidth: LINE }, BAND_STYLES[band.tone]]}
    >
      {band.tone === 'locked' ? (
        <PixelIcon name="lock" color={roles.parchment} />
      ) : band.tone === 'done' ? (
        <PixelIcon name="check8" color={roles.done} />
      ) : band.tone === 'error' ? (
        <PixelIcon name="info" color={roles.pink} />
      ) : (
        <View style={styles.dot} />
      )}
      <Text style={[styles.bandText, band.tone === 'error' && { color: roles.pink }]}>
        {band.text}
      </Text>
    </View>
  );
}

/**
 * Le menu des pouvoirs (`PowersMenu`, #270, maquette 269 : M1 à M13) : un écran poussé, titré
 * « Pouvoirs équipés ». Les deux héros en onglets, chacun avec son compte ; une ligne par pouvoir
 * possédé, dans l'ordre de l'arbre, qui coche ou décoche (la règle de la case est celle du domaine,
 * `toggleEquippedPower`) ; un seul « Valider » pour les deux héros, qui enregistre la mémoire des
 * pouvoirs équipés, puis annonce chaque héros changé et quitte. Le retour quitte sans rien écrire.
 * Un 4e pouvoir est refusé : le bandeau le dit, la ligne se secoue, le téléphone vibre (M2). Un
 * échec garde le brouillon, alerte et prend le focus ; « Réessayer » relance (M7). Pendant une
 * ascension, tout est en lecture seule (M10). L'écran fige à son ouverture les pouvoirs nouveaux et
 * la première ouverture, puis les marque vus.
 */
export function PowersMenuScreen({
  camp,
  session,
  hero: initialHero,
  from,
  refusal,
  onLeave,
  onCamp,
}: {
  readonly camp: CampSession;
  readonly session: AscentSession;
  /** L'onglet ouvert. */
  readonly hero: HeroKind;
  /** D'où le menu est ouvert : le libellé du retour (M13). */
  readonly from: 'tower' | 'choice';
  readonly refusal: RefusalHaptics;
  /** Quitter le menu : le retour, ou un « Valider » enregistré. */
  readonly onLeave: () => void;
  /** « Le camp » (M4). */
  readonly onCamp: () => void;
}) {
  const view = useCamp(camp);
  const ascent = useAscent(session);
  const { reading } = useFateGauge();
  const doneYesterday = reading === null || reading.unreadable ? null : reading.doneYesterday;
  const [hero, setHero] = useState(initialHero);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refused, setRefused] = useState<{ power: PowerKind; count: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const band = useRef<View>(null);
  const ready = view.status === 'ready';

  // Le camp lu, l'écran fige ce qu'il montre à son ouverture, puis le marque vu.
  if (ready && opening === null) {
    setOpening({ newPowers: view.newPowers, firstOpen: !view.powersMenuSeen });
    setDraft(view.equipped);
  }
  const opened = opening !== null;
  useEffect(() => {
    if (opened) void camp.markPowersMenuSeen();
  }, [opened, camp]);

  useEffect(() => {
    if (status === 'failed' && band.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(band.current, 'focus');
    }
  }, [status]);

  const departed = view.ascentInProgress && ascent !== null ? ascent : null;
  const locked = departed?.hero.kind ?? null;
  const shown = (kind: HeroKind): readonly PowerKind[] =>
    kind === locked ? departed!.powers : (draft?.[kind] ?? view.equipped[kind]);
  const missing = (kind: HeroKind) => slotsOf(view, kind) - shown(kind).length;

  const toggle = (power: PowerKind) => {
    if (draft === null || status === 'saving') return;
    const result = camp.toggleEquippedPower(hero, draft[hero], power);
    if (result.kind === 'refused') {
      setRefused({ power, count: (refused?.count ?? 0) + 1 });
      refusal.refusal();
      return;
    }
    setRefused(null);
    setDraft({ ...draft, [hero]: result.powers });
  };

  const validate = async () => {
    if (draft === null) return;
    const before = view.equipped;
    setStatus('saving');
    const result = await camp.equipPowers(draft);
    if (result === 'failed') {
      setStatus('failed');
      return;
    }
    setStatus('idle');
    if (result === 'refused') return;
    for (const kind of HEROES) {
      if (!sameChoice(before[kind], draft[kind])) {
        AccessibilityInfo.announceForAccessibility(equippedAnnouncement(kind, draft[kind]));
      }
    }
    onLeave();
  };

  const kindledOf = (kind: HeroKind): readonly PowerKind[] =>
    kind === locked
      ? departed!.kindled.map(({ power }) => power)
      : camp.kindledPreview(doneYesterday, { [kind]: shown(kind) })[kind].map(({ power }) => power);
  const standings = camp.oathStandings(doneYesterday);
  const oathOf = (
    power: PowerKind,
    checked: boolean,
    kindled: boolean,
  ): MenuOathLine | undefined => {
    const oath = view.oaths[power];
    if (oath === undefined || oath.name === null) return undefined;
    const standing: OathStanding | null | undefined = kindled ? 'kept' : standings[power];
    if (standing === undefined || standing === null || standing === 'broken') return undefined;
    // Tenu hier mais pas attisé pour l'ascension en cours : rien à dire du lendemain.
    if (standing === 'kept' && checked && !kindled) return undefined;
    return menuOathLine(power, oath.name, standing, checked);
  };

  const badges = Object.fromEntries(
    HEROES.map((kind): [HeroKind, TabBadge] => [
      kind,
      kind === locked
        ? 'locked'
        : { count: shown(kind).length, toComplete: !view.ascentInProgress && missing(kind) > 0 },
    ]),
  ) as Record<HeroKind, TabBadge>;

  const loading = !ready || opening === null || draft === null;
  const modeOf = (kind: HeroKind): PowersMenuRowMode => {
    if (view.ascentInProgress) return 'fixed';
    return view.owned[kind].length > EQUIPPED_POWER_SLOTS ? 'check' : 'office';
  };
  const currentBand = loading
    ? null
    : bandOf({
        hero,
        view,
        opening,
        failed: status === 'failed',
        refused: refused?.power ?? null,
        locked,
      });
  const powers = shown(hero);
  const kindled = loading ? [] : kindledOf(hero);
  const fresh = opening?.newPowers[hero];

  return (
    <Screen layout="top" background={roles.night} testID="powers-menu">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel(from)}
          onPress={onLeave}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {POWERS_MENU_TITLE}
          </Text>
          <Text style={styles.subtitle}>
            {view.ascentInProgress ? ASCENT_SUBTITLE : NEXT_ASCENT_SUBTITLE}
          </Text>
        </View>
      </View>
      <HeroTabs
        hero={hero}
        onSelect={(kind) => {
          setHero(kind);
          setRefused(null);
        }}
        testIDPrefix="powers-menu-tab"
        {...(!loading && { badges })}
      />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View accessibilityState={{ busy: true }} style={styles.rows}>
            {[0, 1, 2, 3].map((index) => (
              <PixelSkeleton key={index} width="100%" height={72} testID="powers-menu-skeleton" />
            ))}
            <Text accessibilityLiveRegion="polite" role="status" style={styles.srOnly}>
              {POWERS_LOADING}
            </Text>
          </View>
        ) : (
          <View style={styles.rows}>
            <View style={styles.heading}>
              <Text style={styles.headingText}>{menuHeading(hero)}</Text>
              <Text accessibilityLiveRegion="polite" role="status" style={styles.count}>
                {slotsText(powers.length)}
              </Text>
            </View>
            {currentBand === null ? null : <BandView ref={band} band={currentBand} />}
            {view.owned[hero].map((power) => {
              const checked = powers.includes(power);
              const lit = kindled.includes(power);
              const oath = oathOf(power, checked, lit);
              return (
                <PowersMenuRow
                  key={power}
                  power={power}
                  mode={modeOf(hero)}
                  checked={checked}
                  kindled={lit}
                  {...(oath !== undefined && { oath })}
                  isNew={
                    fresh?.autoEquipped.includes(power) === true ||
                    fresh?.waiting.includes(power) === true
                  }
                  fresh={locked === null && fresh?.autoEquipped.includes(power) === true}
                  {...(refused?.power === power && { shake: refused.count })}
                  onPress={() => toggle(power)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
      <View style={styles.foot}>
        <Foot
          loading={loading}
          view={view}
          hero={hero}
          missing={missing}
          failed={status === 'failed'}
          saving={status === 'saving'}
          onValidate={() => void validate()}
          onCamp={onCamp}
        />
      </View>
    </Screen>
  );
}

/**
 * Le pied fixé en bas : « Valider » ; ce qui manque pour ce héros ou pour l'autre ; « Réessayer » ;
 * « Le camp » quand les deux héros ont 3 pouvoirs ou moins (M4) ; la note de l'Équipement pendant
 * une ascension (M10) ; « Valider » inactif pendant le chargement (M11).
 */
function Foot({
  loading,
  view,
  hero,
  missing,
  failed,
  saving,
  onValidate,
  onCamp,
}: {
  readonly loading: boolean;
  readonly view: CampView;
  readonly hero: HeroKind;
  readonly missing: (hero: HeroKind) => number;
  readonly failed: boolean;
  readonly saving: boolean;
  readonly onValidate: () => void;
  readonly onCamp: () => void;
}) {
  const validate = (props: { label?: string; text?: string; disabled?: boolean } = {}) => (
    <PixelButton
      label={props.label ?? 'Valider'}
      text={props.text ?? props.label ?? 'Valider'}
      onPress={onValidate}
      disabled={props.disabled ?? false}
      testID="powers-menu-validate"
    />
  );
  if (loading) return validate({ disabled: true });
  if (view.ascentInProgress) return <Text style={styles.note}>{LOCKED_FOOT_NOTE}</Text>;
  if (HEROES.every((kind) => view.owned[kind].length <= EQUIPPED_POWER_SLOTS)) {
    return (
      <>
        <Text style={styles.note}>{OFFICE_FOOT_NOTE}</Text>
        <PixelButton label={CAMP_TITLE} variant="secondary" onPress={onCamp}>
          <View style={styles.camp}>
            <PixelIcon name="flame8" color={roles.ember} secondColor={roles.gold} />
            <Text style={styles.campText}>{CAMP_TITLE}</Text>
          </View>
        </PixelButton>
      </>
    );
  }
  const other: HeroKind = hero === 'sentinel' ? 'wanderer' : 'sentinel';
  if (missing(hero) > 0) {
    return validate({
      label: missingLabel(hero, missing(hero)),
      text: missingChoiceText(missing(hero)),
      disabled: true,
    });
  }
  if (missing(other) > 0) {
    return validate({
      label: missingLabel(other, missing(other)),
      text: otherMissingText(other, missing(other)),
      disabled: true,
    });
  }
  return validate({ ...(failed && { label: 'Réessayer' }), disabled: saving });
}

const BAND_STYLES = StyleSheet.create({
  info: { borderColor: roles.blue, backgroundColor: roles.raised },
  done: { borderColor: roles.doneLine, backgroundColor: roles.doneBg },
  error: { borderColor: roles.curse, backgroundColor: roles.errorBg },
  locked: { borderColor: roles.line, backgroundColor: roles.raised },
});

// Stryker disable all: valeurs purement visuelles, vérifiées par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    paddingLeft: 8,
    paddingRight: 14,
  },
  back: {
    minWidth: MIN_TARGET_SIZE,
    minHeight: MIN_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontFamily: pixelFont, fontSize: 28, lineHeight: 32, color: roles.light },
  titles: { flex: 1 },
  title: { fontFamily: pixelFont, fontSize: 22, lineHeight: 24, color: roles.light },
  subtitle: { fontFamily: textFont.medium, fontSize: 12, lineHeight: 16, color: roles.muted },
  body: { paddingHorizontal: 16, paddingBottom: 10 },
  rows: { gap: 8 },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  headingText: {
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.parchment,
  },
  count: { fontFamily: pixelFont, fontSize: 15, lineHeight: 18, color: roles.gold },
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dot: {
    width: 10,
    height: 10,
    marginTop: 4,
    backgroundColor: roles.blue,
    transform: [{ rotate: '45deg' }],
  },
  bandText: {
    flex: 1,
    fontFamily: textFont.medium,
    fontSize: 13,
    lineHeight: 18,
    color: roles.light,
  },
  foot: { gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },
  note: {
    fontFamily: textFont.regular,
    fontSize: 13,
    lineHeight: 18,
    color: roles.muted,
    textAlign: 'center',
  },
  camp: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  campText: { fontFamily: textFont.bold, fontSize: 15, lineHeight: 19, color: roles.light },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
});
// Stryker restore all
