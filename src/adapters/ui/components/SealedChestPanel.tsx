import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { SKIP_CHEST_LABEL, TAP_TO_SKIP } from '../format/ascentText';
import {
  LEAVE_FOR_GOOD,
  NOTHING_LOST,
  NO_KEY,
  NO_KEY_LABEL,
  OPENS_WITH_A_KEY,
  OPEN_WITH_A_KEY,
  SEALED_CHEST_CONTENT,
  SEALED_CHEST_OPENING,
  SEALED_CHEST_SOURCE,
  SEALED_CHEST_TITLE,
  openLabel,
  sealedOpenedAnnouncement,
} from '../format/sealedChestText';
import { artPalette } from '../pixelArt/artPalette';
import { artPixelSize } from '../pixelArt/artPixel';
import { PixelButton } from '../pixelArt/PixelButton';
import { PixelIcon } from '../pixelArt/PixelIcon';
import { pixelFont, pixelTypography } from '../pixelArt/pixelTypography';
import { KEY_IMAGE } from '../pixelArt/sprites/atelier/data/key';
import {
  SEALED_CHEST_IMAGE,
  SEALED_CHEST_OPEN_IMAGE,
} from '../pixelArt/sprites/atelier/data/sealedChest';
import { assetSprite } from '../pixelArt/sprites/atelier/fullAnimation';
import { toPixelImage } from '../pixelArt/sprites/Sprite';
import { SpriteCanvas } from '../pixelArt/SpriteCanvas';
import { useReducedMotion } from '../state/useReducedMotion';
import { useSteps } from './CampFeedback';
import { ChestStage } from './ChestStage';

const { roles } = artPalette;

/** L'ouverture du coffre scellé (#226, maquette 208 S3), en millisecondes. */
export const SEALED_CHEST_OPEN_MS = 800;
const STEP_MS = 100;
const LAST_STEP = SEALED_CHEST_OPEN_MS / STEP_MS;
/** La clé descend dans le sceau (0 à 200 ms), puis le coffre tremble (200 à 500 ms). */
const KEY_STEPS = 2;
/** Le pas où le coffre s'ouvre (500 ms) ; la lueur monte ensuite en 3 pas (500 à 800 ms). */
const OPEN_STEP = 5;
const GLOW_STEPS = LAST_STEP - OPEN_STEP;
/** La secousse du coffre fermé, en pixels d'art, sur ses 3 pas. */
const SHAKE = [-0.5, 0.5, -0.5] as const;
const CHEST_SCALE = 5;

export interface SealedChestPanelProps {
  /** Les clés du héros : celles qui restent, une fois la clé de l'ouverture dépensée. */
  readonly keys: number;
  /** L'ouverture se joue : la clé est déjà dépensée et l'objet tiré. */
  readonly opening: boolean;
  readonly onOpen: () => void;
  /** « Laisser », avec une clé, ou « Continuer », sans clé. */
  readonly onLeave: () => void;
  /** La fin de l'ouverture, ou un toucher qui la passe. */
  readonly onOpened: () => void;
}

/** La frise de l'ouverture (S3) : 800 ms, puis `onOpened`. */
function Opening({ onOpened }: { readonly onOpened: () => void }) {
  const reducedMotion = useReducedMotion();
  const step = useSteps(LAST_STEP, STEP_MS);
  const ended = useRef(false);
  const end = () => {
    if (ended.current) return;
    ended.current = true;
    onOpened();
  };
  useEffect(() => {
    if (step >= LAST_STEP) end();
  });
  const opened = step >= OPEN_STEP;
  const shaking = !reducedMotion && step >= KEY_STEPS && !opened;
  const glow = opened ? Math.min(1, (step - OPEN_STEP + 1) / GLOW_STEPS) : 0;
  const pixel = artPixelSize(2);
  return (
    <>
      <View style={styles.slot}>
        {!reducedMotion && step < KEY_STEPS && (
          // La clé qui descend dans le sceau (0 à 200 ms) ; décorative.
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            testID="sealed-chest-key"
            style={[styles.key, { transform: [{ translateY: step * 6 * pixel }] }]}
          >
            <SpriteCanvas
              sprite="key"
              draw={() => toPixelImage(assetSprite(KEY_IMAGE))}
              scale={2}
            />
          </View>
        )}
        <ChestStage
          name="sealed-chest"
          closed={SEALED_CHEST_IMAGE}
          open={SEALED_CHEST_OPEN_IMAGE}
          scale={CHEST_SCALE}
          opened={opened}
          shake={shaking ? SHAKE[step - KEY_STEPS]! : 0}
          glow={glow}
        />
      </View>
      <Text style={styles.line}>{SEALED_CHEST_OPENING}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SKIP_CHEST_LABEL}
        onPress={end}
        style={styles.skip}
        testID="sealed-chest-skip"
      >
        <Text style={styles.line}>{TAP_TO_SKIP}</Text>
      </Pressable>
    </>
  );
}

/**
 * Le coffre scellé (#226, maquette 208 S2, S3, S7), entre « Objet trouvé » et « Choisis un
 * bienfait ». Avec une clé : « Laisser » à gauche, sans confirmation, et « Ouvrir · 1 clé » à droite.
 * Sans clé : « Aucune clé », indisponible, et « Continuer ». L'ouverture se joue en 800 ms, passable
 * d'un toucher ; en mouvement réduit, ni secousse ni clé qui vole.
 */
export function SealedChestPanel({
  keys,
  opening,
  onOpen,
  onLeave,
  onOpened,
}: SealedChestPanelProps) {
  const title = useRef<Text>(null);
  useEffect(() => {
    if (title.current !== null) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
  }, []);
  useEffect(() => {
    if (opening) AccessibilityInfo.announceForAccessibility(sealedOpenedAnnouncement(keys));
    // L'annonce suit le début de l'ouverture seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  return (
    <View style={styles.center}>
      <Text style={styles.source}>{SEALED_CHEST_SOURCE}</Text>
      <Text ref={title} accessibilityRole="header" style={styles.title}>
        {SEALED_CHEST_TITLE}
      </Text>
      {opening ? (
        <Opening onOpened={onOpened} />
      ) : (
        <>
          <View style={styles.slot}>
            <ChestStage
              name="sealed-chest"
              closed={SEALED_CHEST_IMAGE}
              open={SEALED_CHEST_OPEN_IMAGE}
              scale={CHEST_SCALE}
              opened={false}
              shake={0}
              glow={0}
            />
          </View>
          {keys > 0 ? (
            <>
              <Text style={styles.line}>{SEALED_CHEST_CONTENT}</Text>
              <Text style={[styles.line, styles.muted]}>{LEAVE_FOR_GOOD}</Text>
              <View style={styles.row}>
                <PixelButton
                  label="Laisser"
                  variant="secondary"
                  onPress={onLeave}
                  style={styles.half}
                />
                <PixelButton label={openLabel(keys)} onPress={onOpen} style={styles.half}>
                  <Text style={[pixelTypography.button, styles.openText]}>{OPEN_WITH_A_KEY}</Text>
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    testID="sealed-chest-keys"
                    style={styles.count}
                  >
                    <PixelIcon name="key8" color={roles.ink} />
                    <Text style={styles.countText}>{keys}</Text>
                  </View>
                </PixelButton>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.line}>{OPENS_WITH_A_KEY}</Text>
              <PixelButton
                label={NO_KEY_LABEL}
                text={NO_KEY}
                icon="lock"
                variant="secondary"
                disabled
                onPress={onOpen}
              />
              <Text style={styles.line}>{NOTHING_LOST}</Text>
              <PixelButton label="Continuer" onPress={onLeave} />
            </>
          )}
        </>
      )}
    </View>
  );
}

// Stryker disable all: styles purement visuels, vérifiés par la conformité aux maquettes (barrière 10 bis).
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24, gap: 12 },
  source: { ...pixelTypography.body, color: roles.muted, textAlign: 'center' },
  title: {
    fontFamily: pixelFont,
    fontSize: 22,
    lineHeight: 26,
    color: roles.light,
    textAlign: 'center',
  },
  slot: {
    minHeight: SEALED_CHEST_IMAGE.h * artPixelSize(CHEST_SCALE),
    justifyContent: 'center',
  },
  key: { position: 'absolute', top: 0, alignSelf: 'center', zIndex: 1 },
  line: { ...pixelTypography.body, color: roles.parchment, textAlign: 'center' },
  muted: { color: roles.muted },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  half: { flex: 1 },
  openText: { color: roles.ink },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 26,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
    backgroundColor: roles.done,
  },
  countText: { fontFamily: pixelFont, fontSize: 15, lineHeight: 18, color: roles.ink },
  skip: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingBottom: 30,
  },
});
// Stryker restore all
