// Les composants de la Cosse de braise et de la Phalène voleuse (#267, maquette 246, J1 à J10) : les
// marques de signature en braise et en or, « Braises 2 » barré quand elle est étourdie, la bulle de
// première rencontre d'un ennemi ordinaire, les mots de la scène, les 2 flammes de l'Éclatement et
// le losange de l'Élan volé.
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { EmberFlames, StolenMomentum } from './AshGardensEffects';
import { FeedbackLabel } from './BattleEffects';
import { EncounterHintBubble } from './EncounterHintBubble';
import { SignatureMark } from './SignatureMark';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);
const textStyle = (text: string) =>
  StyleSheet.flatten(screen.getByText(text, hiddenToo).props.style);

const EMBERS: SignatureView = {
  variant: 'emberBurst',
  glyph: 'ember8',
  text: 'Braises 2',
  speech: 'à sa mort, 2 charges de Brûlure, sauf si elle est étourdie',
  off: false,
  now: false,
};

const THEFT: SignatureView = {
  variant: 'momentumTheft',
  glyph: 'diamond8',
  text: "Vole l'Élan",
  speech: 'vole 1 Élan à chaque impact qui te touche',
  off: false,
  now: false,
};

describe('the signature marks of the Ash gardens (#267, J1, J6, J8)', () => {
  it('draws « Braises 2 » in the ember of the Burn, #FFC9A3 on #3A2014', async () => {
    await render(<SignatureMark signature={EMBERS} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: '#3A2014',
      borderColor: battleColors.burn,
    });
    expect(textStyle('Braises 2')).toMatchObject({ color: '#FFC9A3' });
    expect(textStyle('Braises 2').textDecorationLine).toBeUndefined();
    expect(screen.getByTestId('signature-glyph-ember8', hiddenToo)).toBeOnTheScreen();
  });

  it('strikes « Braises 2 » through and greys it while she is stunned (J8)', async () => {
    await render(<SignatureMark signature={{ ...EMBERS, off: true }} testID="mark" />);

    expect(style('mark')).toMatchObject({ backgroundColor: 'transparent' });
    expect(textStyle('Braises 2')).toMatchObject({
      color: battleColors.signatureOff,
      textDecorationLine: 'line-through',
    });
  });

  it('draws « Vole l’Élan » with the gold diamond of the momentum', async () => {
    await render(<SignatureMark signature={THEFT} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: battleColors.stealBackground,
      borderColor: battleColors.stealLine,
    });
    expect(screen.getByTestId('signature-glyph-diamond8', hiddenToo)).toBeOnTheScreen();
  });
});

describe('the first encounter bubbles of the Ash gardens (#267, J1, J6)', () => {
  it.each([
    ['thievingMoth', 'Phalène voleuse', 'diamond8', battleColors.steal],
    ['emberPod', 'Cosse de braise', 'ember8', battleColors.burnRing],
  ] as const)(
    'names the %s with the glyph of its mark, never the crown',
    async (enemy, name, glyph, color) => {
      await render(<EncounterHintBubble enemy={enemy} onClose={jest.fn()} />);

      expect(screen.getByText(name, hiddenToo)).toBeOnTheScreen();
      expect(screen.getByTestId(`encounter-hint-glyph-${glyph}`, hiddenToo)).toBeOnTheScreen();
      expect(screen.queryByTestId('encounter-hint-crown', hiddenToo)).toBeNull();
      expect(style('encounter-hint-frame')).toMatchObject({ borderColor: color });
    },
  );

  it('says the words of the corrected mockup for the Thieving moth', async () => {
    await render(<EncounterHintBubble enemy="thievingMoth" onClose={jest.fn()} />);

    expect(
      screen.getByText(
        'Chaque impact qui te touche te vole 1 Élan, même une bonne parade. Seules la parade parfaite et l’esquive le protègent.',
        hiddenToo,
      ),
    ).toBeOnTheScreen();
  });
});

describe('the words of the scene (#267, J7, J9, J2b)', () => {
  it.each([
    ['ember', 'Elle éclate', battleColors.burnRing],
    ['smoke', 'Éteinte', battleColors.burnSmoke],
  ] as const)('writes « %s »', async (tone, title, color) => {
    await render(<FeedbackLabel texts={[{ tone, title, sub: 'Brûlure ×2' }]} />);

    expect(textStyle(title)).toMatchObject({ color });
    expect(screen.getByText('Brûlure ×2', hiddenToo)).toBeOnTheScreen();
  });
});

describe('the flight of the Burst and of the theft (#267, J2, J7)', () => {
  it('flies 2 flames from the pod to the hero', async () => {
    await render(
      <EmberFlames
        from={{ x: 300, y: 100 }}
        to={{ x: 80, y: 260 }}
        delayMs={200}
        reducedMotion={false}
      />,
    );

    expect(screen.getAllByTestId('battle-ember-flame', hiddenToo)).toHaveLength(2);
  });

  it('sends a gold diamond to the moth, and writes « −1 Élan »', async () => {
    await render(
      <StolenMomentum
        from={{ x: 80, y: 260 }}
        to={{ x: 300, y: 100 }}
        stolen={1}
        delayMs={300}
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId('battle-stolen-diamond', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText('−1 Élan', hiddenToo)).toBeOnTheScreen();
    expect(textStyle('−1 Élan')).toMatchObject({ color: battleColors.steal });
  });

  it('writes « −1 Élan » without the flight of the diamond in reduced motion', async () => {
    await render(
      <StolenMomentum
        from={{ x: 80, y: 260 }}
        to={{ x: 300, y: 100 }}
        stolen={1}
        delayMs={300}
        reducedMotion
      />,
    );

    expect(screen.queryByTestId('battle-stolen-diamond', hiddenToo)).toBeNull();
    expect(screen.getByText('−1 Élan', hiddenToo)).toBeOnTheScreen();
  });
});
