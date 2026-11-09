// Les composants du Fossoyeur (#258, maquette 245, F1 à F6) : la pelle de l'intention Exhumer, la
// marque de signature sous le nom, la bulle de première rencontre, l'annonce de l'Exhumation et la
// case en pointillé du Squelette exhumé dans l'aperçu de la frise d'action.
import { render, screen, userEvent, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { ActionTrackView, EnemyView, SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { ActionTrack } from './ActionTrack';
import { FeedbackLabel } from './BattleEffects';
import { EncounterHintBubble } from './EncounterHintBubble';
import { EnemyColumn } from './EnemyColumn';
import { sceneGeometry } from './scene/sceneGeometry';
import { SignatureMark } from './SignatureMark';
import { SummonBanner } from './SummonBanner';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

const NEXT: SignatureView = {
  variant: 'exhume',
  glyph: 'shovel8',
  text: 'Exhume · manche 2',
  speech: 'exhume un Squelette à la manche 2',
  off: false,
  now: false,
};

const digger = (change: Partial<EnemyView> = {}): EnemyView => ({
  kind: 'gravedigger',
  name: 'Fossoyeur',
  standing: true,
  target: true,
  hpRatio: 1,
  hpText: '120/120 PV',
  guardRatio: 1,
  guardText: 'Garde 50/50',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: { category: 'attack' },
  active: false,
  dimmed: false,
  tag: null,
  signature: NEXT,
  label:
    'Fossoyeur, Élite, cible, 120 PV sur 120, garde 50 sur 50, exhume un Squelette à la manche 2, intention : attaque',
  ...change,
});

async function renderColumn(view: EnemyView) {
  await render(
    <EnemyColumn
      view={view}
      index={0}
      slot={sceneGeometry(412, 440, 1).enemies[0]!}
      sealed={false}
      float={null}
      uiNow={() => 0}
      now={() => 0}
      onTarget={jest.fn()}
    />,
  );
}

describe('the intent Exhume (#258, F2)', () => {
  it('shows the bone shovel in a bone frame', async () => {
    await renderColumn(digger({ intent: { category: 'exhume' } }));

    const shovel = screen.getByTestId('enemy-gravedigger-intent-exhume', hiddenToo);
    const pixels = (shovel.children as unknown as { props: { style: object } }[]).map((pixel) =>
      StyleSheet.flatten(pixel.props.style),
    );
    expect(pixels.length).toBeGreaterThan(0);
    for (const pixel of pixels)
      expect(pixel).toMatchObject({ backgroundColor: battleColors.onGrave });
    expect(style('enemy-gravedigger-intent')).toMatchObject({ borderColor: battleColors.grave });
  });
});

describe('the signature mark (#258, F1 to F5)', () => {
  it('shows its glyph and its word under the name of the Elite, never the colour alone', async () => {
    await renderColumn(digger());

    const mark = screen.getByTestId('enemy-gravedigger-signature', hiddenToo);
    expect(within(mark).getByText('Exhume · manche 2', hiddenToo)).toBeOnTheScreen();
    expect(within(mark).getByTestId('signature-glyph-shovel8', hiddenToo)).toBeOnTheScreen();
  });

  it('is in bone colours, in a bone frame, and passes to the next line in large text', async () => {
    await render(<SignatureMark signature={NEXT} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: battleColors.graveBackground,
      borderColor: battleColors.grave,
      flexWrap: 'wrap',
    });
    const word = screen.getByText('Exhume · manche 2', hiddenToo);
    expect(StyleSheet.flatten(word.props.style)).toMatchObject({ color: battleColors.onGrave });
    expect(word.props.numberOfLines).toBeUndefined();
  });

  it('frames « Exhume maintenant » twice as thick (F2)', async () => {
    await render(
      <SignatureMark signature={{ ...NEXT, text: 'Exhume maintenant', now: true }} testID="mark" />,
    );

    expect(style('mark')).toMatchObject({ borderWidth: 2, borderColor: battleColors.onGrave });
  });

  it.each([
    ['crack8', 'Pas d’exhumation'],
    ['bone8', 'Squelette debout'],
  ] as const)('greys out « %s » with its glyph (F4, F5)', async (glyph, text) => {
    await render(<SignatureMark signature={{ ...NEXT, glyph, text, off: true }} testID="mark" />);

    expect(style('mark')).toMatchObject({ backgroundColor: 'transparent' });
    expect(StyleSheet.flatten(screen.getByText(text, hiddenToo).props.style)).toMatchObject({
      color: battleColors.signatureOff,
    });
    expect(screen.getByTestId(`signature-glyph-${glyph}`, hiddenToo)).toBeOnTheScreen();
  });

  it('is read with the plate, not on its own', async () => {
    await renderColumn(digger());

    expect(screen.getByLabelText(digger().label)).toBeOnTheScreen();
    expect(
      screen.getByTestId('enemy-gravedigger-signature', hiddenToo).props
        .accessibilityElementsHidden,
    ).toBe(true);
  });

  it('has no mark for an enemy without a signature', async () => {
    const { signature: _, ...unmarked } = digger();
    await renderColumn(unmarked);

    expect(screen.queryByTestId('enemy-gravedigger-signature', hiddenToo)).toBeNull();
  });
});

describe('the first encounter bubble (#258, F1)', () => {
  it('names the Elite with the crown, says its rule and how to close it', async () => {
    await render(<EncounterHintBubble enemy="gravedigger" onClose={jest.fn()} />);

    expect(screen.getByText('Fossoyeur', hiddenToo)).toBeOnTheScreen();
    expect(
      screen.getByText(/Aux manches paires, il exhume un Squelette/u, hiddenToo),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Touche n'importe où pour fermer. Elle ne reviendra pas.", hiddenToo),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('encounter-hint-crown', hiddenToo)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Fossoyeur. Aux manches paires, il exhume un Squelette, un seul à la fois. Brise sa garde avant son tour pour l’en empêcher',
      ),
    ).toBeOnTheScreen();
  });

  it('closes at a touch', async () => {
    const onClose = jest.fn();
    await render(<EncounterHintBubble enemy="gravedigger" onClose={onClose} />);

    await userEvent.setup().press(screen.getByTestId('encounter-hint-gravedigger'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is framed in the purple of the Elite, announced as a status', async () => {
    await render(<EncounterHintBubble enemy="gravedigger" onClose={jest.fn()} />);

    expect(style('encounter-hint-frame')).toMatchObject({ borderColor: battleColors.elite });
    expect(screen.getByTestId('encounter-hint-gravedigger').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });
});

describe('the announcement of the exhumation (#258, F3)', () => {
  it('has bone dotted edges and a bone title', async () => {
    await render(
      <SummonBanner
        title="Il exhume un Squelette"
        line="Première place libre · il n’agit pas cette manche"
        tone="grave"
        reducedMotion={false}
      />,
    );

    expect(style('summon-banner')).toMatchObject({
      borderStyle: 'dotted',
      borderColor: battleColors.grave,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Il exhume un Squelette', hiddenToo).props.style).color,
    ).toBe(battleColors.onGrave);
  });
});

describe('the exhumed Skeleton in the preview of the action track (#258, F3)', () => {
  const track: ActionTrackView = {
    round: 2,
    current: [{ actor: 0, fighter: 'gravedigger', phase2: false }],
    next: [
      { actor: 'hero', fighter: 'sentinel', phase2: false },
      { actor: 1, fighter: 'skeleton', phase2: false, exhumed: true },
      { actor: 0, fighter: 'gravedigger', phase2: false },
    ],
  };

  it('dots the entry of the exhumed Skeleton, like an announced summon', async () => {
    await render(<ActionTrack track={track} />);

    const [dotted, ...others] = screen.getAllByTestId('track-entry-exhumed', hiddenToo);
    expect(others).toEqual([]);
    expect(StyleSheet.flatten(dotted!.props.style)).toMatchObject({
      borderStyle: 'dashed',
      borderColor: battleColors.summonDust,
    });
    expect(within(dotted!).getByTestId('track-pending-ring', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryAllByTestId('track-entry-pending', hiddenToo)).toEqual([]);
  });
});

describe('the word « Victoire » of the fall of the Gravedigger (#258, F6)', () => {
  it('writes « Victoire » in gold, over « Le Squelette tombe avec lui »', async () => {
    await render(
      <FeedbackLabel
        texts={[{ tone: 'victory', title: 'Victoire', sub: 'Le Squelette tombe avec lui' }]}
      />,
    );

    expect(StyleSheet.flatten(screen.getByText('Victoire', hiddenToo).props.style)).toMatchObject({
      color: battleColors.light,
    });
    expect(screen.getByText('Le Squelette tombe avec lui', hiddenToo)).toBeOnTheScreen();
  });
});
