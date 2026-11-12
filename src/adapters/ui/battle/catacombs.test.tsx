// Les composants des Catacombes (#268, maquette 246, C1 à C6) : la marque « Aura +20 % » en lueur
// citron, grisée « Aura · seul », la bulle du Porte-cierge, la petite flamme sur le chiffre d'un
// coup renforcé, le « +20 % » des alliés, barré à sa chute, et le mot « L'aura s'éteint ».
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { EnemyView, SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { AuraBoostChip, AuraGlow } from './CatacombsEffects';
import { DamageFloat, FeedbackLabel } from './BattleEffects';
import { EncounterHintBubble } from './EncounterHintBubble';
import { EnemyColumn } from './EnemyColumn';
import { sceneGeometry } from './scene/sceneGeometry';
import { SignatureMark } from './SignatureMark';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);
const textStyle = (text: string) =>
  StyleSheet.flatten(screen.getByText(text, hiddenToo).props.style);

const AURA: SignatureView = {
  variant: 'aura',
  glyph: 'candle8',
  text: 'Aura +20 %',
  speech: 'aura : ses alliés font 20 % de dégâts en plus tant qu’il vit',
  off: false,
  now: false,
};

describe('the Aura mark of the Candle bearer (#268, C1, C5)', () => {
  it('draws « Aura +20 % » in lemon light, #FFF2B8 on #2A2610, with its candle', async () => {
    await render(<SignatureMark signature={AURA} testID="mark" />);

    expect(style('mark')).toMatchObject({ backgroundColor: '#2A2610', borderColor: '#FFE680' });
    expect(textStyle('Aura +20 %')).toMatchObject({ color: '#FFF2B8' });
    expect(screen.getByTestId('signature-glyph-candle8', hiddenToo)).toBeOnTheScreen();
  });

  it('greys « Aura · seul » in #8C93A8 when he stands alone', async () => {
    await render(
      <SignatureMark signature={{ ...AURA, text: 'Aura · seul', off: true }} testID="mark" />,
    );

    expect(style('mark')).toMatchObject({ backgroundColor: 'transparent' });
    expect(textStyle('Aura · seul')).toMatchObject({ color: '#8C93A8' });
  });
});

describe('the first encounter bubble of the Candle bearer (#268, C1)', () => {
  it('shows his candle in lemon light, without the crown of an Elite', async () => {
    await render(<EncounterHintBubble enemy="candleBearer" onClose={() => undefined} />);

    expect(screen.getByText('Porte-cierge')).toBeOnTheScreen();
    expect(screen.getByTestId('encounter-hint-glyph-candle8', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryByTestId('encounter-hint-crown', hiddenToo)).toBeNull();
    expect(style('encounter-hint-frame')).toMatchObject({ borderColor: battleColors.aura });
  });
});

describe('the damage of a blow under the Aura (#268, C2)', () => {
  it('carries the small flame of the Aura, as the « ½ » of the Sanctuary', async () => {
    await render(
      <DamageFloat float={{ at: 'hero', text: '−6', big: false, kind: 'damage', aura: true }} />,
    );

    expect(screen.getByText('−6')).toBeOnTheScreen();
    expect(screen.getByTestId('damage-aura', hiddenToo)).toBeOnTheScreen();
    expect(style('damage-aura')).toMatchObject({ backgroundColor: battleColors.aura });
  });

  it('carries no flame on an ordinary blow', async () => {
    await render(<DamageFloat float={{ at: 'hero', text: '−5', big: false, kind: 'damage' }} />);

    expect(screen.queryByTestId('damage-aura', hiddenToo)).toBeNull();
  });
});

describe('the « +20 % » of an ally under the Aura (#268, C1, C4)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('says « +20 % » with its flame, never the colour alone', async () => {
    await render(<AuraBoostChip kind="ghoul" out={false} reducedMotion={false} />);

    expect(screen.getByText('+20 %', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-ghoul-aura-flame', hiddenToo)).toBeOnTheScreen();
    expect(textStyle('+20 %').textDecorationLine).toBeUndefined();
  });

  it('is struck through at his fall, then gone 400 ms later', async () => {
    await render(<AuraBoostChip kind="ghoul" out reducedMotion={false} />);

    expect(textStyle('+20 %')).toMatchObject({ textDecorationLine: 'line-through' });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.queryByText('+20 %', hiddenToo)).toBeNull();
  });

  it('is gone at once in reduced motion', async () => {
    await render(<AuraBoostChip kind="ghoul" out reducedMotion />);

    expect(screen.queryByText('+20 %', hiddenToo)).toBeNull();
  });
});

describe('the glow of the Candle bearer (#268, C1, C4, C5)', () => {
  it('glows lemon while his Aura serves, grey when it is out', async () => {
    const { rerender } = await render(<AuraGlow state="lit" reducedMotion />);
    expect(style('aura-glow')).toMatchObject({ backgroundColor: battleColors.aura });

    await rerender(<AuraGlow state="out" reducedMotion />);
    expect(style('aura-glow')).toMatchObject({ backgroundColor: battleColors.signatureOff });
  });
});

describe('the word of the fall (#268, C4)', () => {
  it('writes « L’aura s’éteint » in lemon light, with its line', async () => {
    await render(
      <FeedbackLabel
        texts={[
          { tone: 'aura', title: 'L’aura s’éteint', sub: 'Ses alliés reviennent à leurs dégâts' },
        ]}
      />,
    );

    expect(textStyle('L’aura s’éteint')).toMatchObject({ color: battleColors.aura });
    expect(screen.getByText('Ses alliés reviennent à leurs dégâts')).toBeOnTheScreen();
  });
});

const ghoul = (change: Partial<EnemyView> = {}): EnemyView => ({
  kind: 'ghoul',
  name: 'Goule',
  standing: true,
  target: false,
  hpRatio: 1,
  hpText: '50/50 PV',
  guardRatio: 1,
  guardText: 'Garde 30/30',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: null,
  active: false,
  dimmed: false,
  tag: null,
  label: 'Goule',
  ...change,
});

async function renderColumn(view: EnemyView, auraOut = false) {
  await render(
    <EnemyColumn
      view={view}
      index={0}
      slot={sceneGeometry(412, 440, 1).enemies[0]!}
      sealed={false}
      auraOut={auraOut}
      float={null}
      uiNow={() => 0}
      now={() => 0}
      onTarget={jest.fn()}
    />,
  );
}

describe('the column of an enemy of the Catacombs (#268, C1, C4, C5)', () => {
  it('carries « +20 % » on the plate of an ally under the Aura, and nothing without it', async () => {
    await renderColumn(ghoul({ auraBoost: true }));
    expect(screen.getByTestId('enemy-ghoul-aura', hiddenToo)).toBeOnTheScreen();

    await renderColumn(ghoul());
    expect(screen.queryByTestId('enemy-ghoul-aura', hiddenToo)).toBeNull();
  });

  it('strikes the « +20 % » through at the fall of the Candle bearer', async () => {
    await renderColumn(ghoul(), true);

    expect(textStyle('+20 %')).toMatchObject({ textDecorationLine: 'line-through' });
  });

  it('draws the glow of the Candle bearer under his figure, lit or out', async () => {
    await renderColumn(ghoul({ kind: 'candleBearer', name: 'Porte-cierge', auraGlow: 'out' }));

    expect(style('aura-glow')).toMatchObject({ backgroundColor: battleColors.signatureOff });
  });
});
