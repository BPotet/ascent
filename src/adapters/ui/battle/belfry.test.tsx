// Les composants du Battant de cloche et du Bélier de bronze (#266, maquette 246, A1 à A12) : le
// trait de balayage et ses chevrons, l'intention Charge et ses 2 crans, les marques de signature
// cyan et bronze, la bulle de première rencontre d'un ennemi ordinaire et les mots de la scène.
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { EnemyView, SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { FeedbackLabel } from './BattleEffects';
import { EncounterHintBubble } from './EncounterHintBubble';
import { EnemyColumn } from './EnemyColumn';
import { sceneGeometry } from './scene/sceneGeometry';
import { SignatureMark } from './SignatureMark';
import { SWEEP_CHEVRONS, SweepTrail } from './SweepStroke';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

const SWEEP: SignatureView = {
  variant: 'sweep',
  glyph: 'sweep8',
  text: 'Balayage',
  speech: 'balayage : l’esquive échoue, pare',
  off: false,
  now: false,
};

const CHARGE: SignatureView = {
  variant: 'charge',
  glyph: 'ram8',
  text: 'Charge 1/2',
  speech: 'charge, manche 1 sur 2 : brise sa garde pour l’annuler',
  off: false,
  now: true,
};

const ram = (change: Partial<EnemyView> = {}): EnemyView => ({
  kind: 'bronzeRam',
  name: 'Bélier de bronze',
  standing: true,
  target: true,
  hpRatio: 1,
  hpText: '84/84 PV',
  guardRatio: 1,
  guardText: 'Garde 39/39',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: { category: 'charge', notches: 1 },
  active: false,
  dimmed: false,
  tag: null,
  signature: CHARGE,
  label: 'Bélier de bronze, cible',
  ...change,
});

async function renderColumn(view: EnemyView, swept = false) {
  await render(
    <EnemyColumn
      view={view}
      index={0}
      slot={sceneGeometry(412, 440, 1).enemies[0]!}
      sealed={false}
      swept={swept}
      float={null}
      uiNow={() => 0}
      now={() => 0}
      onTarget={jest.fn()}
    />,
  );
}

const notches = (kind: string) =>
  [0, 1].map((notch) => style(`enemy-${kind}-notch-${notch}`).backgroundColor);

describe('the intent Charge (#266, A6, A8)', () => {
  it('shows the horns in a bronze frame, the first of its 2 notches lit (A6)', async () => {
    await renderColumn(ram());

    expect(screen.getByTestId('enemy-bronzeRam-intent-charge', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByTestId('enemy-bronzeRam-intent-horns', hiddenToo)).toBeOnTheScreen();
    expect(style('enemy-bronzeRam-intent')).toMatchObject({ borderColor: battleColors.chargeDark });
    expect(notches('bronzeRam')).toEqual([battleColors.charge, 'transparent']);
  });

  it('shows the blade of the Ram blow, still in the bronze frame, both notches lit (A8)', async () => {
    await renderColumn(ram({ intent: { category: 'charge', notches: 2 } }));

    expect(screen.queryByTestId('enemy-bronzeRam-intent-horns', hiddenToo)).toBeNull();
    expect(screen.getByTestId('enemy-bronzeRam-intent-blade', hiddenToo)).toBeOnTheScreen();
    expect(notches('bronzeRam')).toEqual([battleColors.charge, battleColors.charge]);
  });

  it('lights the bronze frame of the active Bronze ram', async () => {
    await renderColumn(ram({ active: true }));

    expect(style('enemy-bronzeRam-intent')).toMatchObject({ borderColor: battleColors.charge });
  });
});

describe('the stroke of the Sweep (#266, A2)', () => {
  const clapper = ram({
    kind: 'bellClapper',
    name: 'Battant de cloche',
    intent: { category: 'attack' },
    signature: SWEEP,
    active: true,
  });

  it('stands over the Bell clapper during its wind-up, read as a parry', async () => {
    await renderColumn(clapper, true);

    expect(screen.getByLabelText('Trait de balayage : parade')).toBeOnTheScreen();
    expect(screen.queryByTestId('peril-seal', hiddenToo)).toBeNull();
    expect(style('enemy-bellClapper-intent')).toMatchObject({ borderColor: battleColors.sweep });
  });

  it('is absent outside a Sweep', async () => {
    await renderColumn(clapper);

    expect(screen.queryByTestId('sweep-stroke', hiddenToo)).toBeNull();
  });

  it('runs its chevrons on the ground towards the hero, all shown in reduced motion', async () => {
    await render(<SweepTrail from={60} to={240} y={300} reducedMotion />);

    expect(SWEEP_CHEVRONS).toBe(7);
    const chevrons = within(screen.getByTestId('sweep-trail', hiddenToo)).getAllByTestId(
      /sweep-chevron-/u,
      hiddenToo,
    );
    expect(chevrons).toHaveLength(7);
    expect(style('sweep-trail')).toMatchObject({ left: 60, width: 180 });
  });
});

describe('the signature marks of the Belfry (#266, A1, A6, A9)', () => {
  it('draws the Sweep in cyan, with its grazing arrows', async () => {
    await render(<SignatureMark signature={SWEEP} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: battleColors.sweepBackground,
      borderColor: battleColors.sweep,
    });
    expect(screen.getByTestId('signature-glyph-sweep8', hiddenToo)).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText('Balayage', hiddenToo).props.style)).toMatchObject({
      color: battleColors.onSweep,
    });
  });

  it('draws the Charge in heated bronze, framed twice as thick while it charges', async () => {
    await render(<SignatureMark signature={CHARGE} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: battleColors.chargeBackground,
      borderColor: battleColors.onCharge,
      borderWidth: 2,
    });
    expect(screen.getByTestId('signature-glyph-ram8', hiddenToo)).toBeOnTheScreen();
  });

  it('greys out « Charge brisée », with a cracked glyph', async () => {
    await render(
      <SignatureMark
        signature={{ ...CHARGE, glyph: 'crack8', text: 'Charge brisée', off: true, now: false }}
        testID="mark"
      />,
    );

    expect(style('mark')).toMatchObject({ backgroundColor: 'transparent' });
    expect(
      StyleSheet.flatten(screen.getByText('Charge brisée', hiddenToo).props.style),
    ).toMatchObject({ color: battleColors.signatureOff });
  });
});

describe('the first encounter bubble of an ordinary enemy (#266, A1, A6)', () => {
  it.each([
    ['bellClapper', 'Battant de cloche', 'sweep8', battleColors.sweep],
    ['bronzeRam', 'Bélier de bronze', 'ram8', battleColors.charge],
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
});

describe('the words of the scene (#266, A5, A7)', () => {
  it('writes « Balayé » in cyan, with its subtitle', async () => {
    await render(
      <FeedbackLabel
        texts={[{ tone: 'sweep', title: 'Balayé', sub: 'L’esquive échoue · pare le Balayage' }]}
      />,
    );

    expect(StyleSheet.flatten(screen.getByText('Balayé', hiddenToo).props.style)).toMatchObject({
      color: battleColors.sweep,
    });
    expect(screen.getByText('L’esquive échoue · pare le Balayage', hiddenToo)).toBeOnTheScreen();
  });

  it('writes « Il charge » in bronze', async () => {
    await render(
      <FeedbackLabel
        texts={[
          {
            tone: 'charge',
            title: 'Il charge',
            sub: 'Pas de coup cette manche · gros coup à la suivante',
          },
        ]}
      />,
    );

    expect(StyleSheet.flatten(screen.getByText('Il charge', hiddenToo).props.style)).toMatchObject({
      color: battleColors.charge,
    });
  });
});
