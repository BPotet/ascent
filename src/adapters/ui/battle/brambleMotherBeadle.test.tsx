// Les composants de la Mère-ronce et du Bedeau (#259, maquette 245, M1 à M7, B1 à B6) : leurs
// marques de signature (ronce, acier, état éteint), le liseré d'acier de la barre de garde, le « ½ »
// des chiffres amortis, le « −2 » vert ronce et le mot « Épines » sur le héros, le cadre de ronce de
// sa plaque, les mots de la cassure et du retour en garde, et les bulles de première rencontre.
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { HeroState } from '../../../domain/battle/Battle';
import type { EnemyView, SignatureView } from '../state/battleView';
import { battleColors } from '../theme/battleColors';
import { DamageFloat, FeedbackLabel, ThornsWord } from './BattleEffects';
import { EncounterHintBubble } from './EncounterHintBubble';
import { EnemyColumn } from './EnemyColumn';
import { HeroBar } from './HeroBar';
import { sceneGeometry } from './scene/sceneGeometry';
import { SignatureMark } from './SignatureMark';

const hiddenToo = { includeHiddenElements: true } as const;

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID, hiddenToo).props.style);

const textStyle = (text: string) =>
  StyleSheet.flatten(screen.getByText(text, hiddenToo).props.style);

const THORNS: SignatureView = {
  variant: 'thorns',
  glyph: 'thorn8',
  text: 'Épines 2',
  speech: 'épines : chaque frappe sur elle te coûte 2 PV',
  off: false,
  now: false,
};

const SANCTUARY: SignatureView = {
  variant: 'sanctuary',
  glyph: 'ward8',
  text: 'Sanctuaire ½',
  speech: 'sanctuaire : moitié des dégâts tant que sa garde tient',
  off: false,
  now: false,
};

const warden = (change: Partial<EnemyView> = {}): EnemyView => ({
  kind: 'beadle',
  name: 'Bedeau',
  standing: true,
  target: true,
  hpRatio: 1,
  hpText: '167/167 PV',
  guardRatio: 1,
  guardText: 'Garde 96/96',
  stunned: false,
  losingAction: false,
  rising: null,
  intent: { category: 'attack' },
  active: false,
  dimmed: false,
  tag: null,
  signature: SANCTUARY,
  guardWard: true,
  label: 'Bedeau, Élite, cible, 167 PV sur 167, garde 96 sur 96, sanctuaire : moitié des dégâts',
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

const HERO: HeroState = { hp: 57, maxHp: 80, momentum: 3, bulwark: false };

describe('the signature mark of the Thorns (#259, M1, M4)', () => {
  it('is in bramble colours, its thorn and its word', async () => {
    await render(<SignatureMark signature={THORNS} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: battleColors.thornBackground,
      borderColor: battleColors.thorn,
    });
    expect(textStyle('Épines 2')).toMatchObject({ color: battleColors.onThorn });
    expect(screen.getByTestId('signature-glyph-thorn8', hiddenToo)).toBeOnTheScreen();
  });

  it('is struck through and greyed out while she is stunned', async () => {
    await render(<SignatureMark signature={{ ...THORNS, off: true }} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: battleColors.signatureOffLine,
    });
    expect(textStyle('Épines 2')).toMatchObject({
      color: battleColors.signatureOff,
      textDecorationLine: 'line-through',
    });
  });
});

describe('the signature mark of the Sanctuary (#259, B1, B3)', () => {
  it('is in steel colours, its ward and its word', async () => {
    await render(<SignatureMark signature={SANCTUARY} testID="mark" />);

    expect(style('mark')).toMatchObject({
      backgroundColor: battleColors.wardBackground,
      borderColor: battleColors.ward,
    });
    expect(textStyle('Sanctuaire ½')).toMatchObject({ color: battleColors.onWard });
  });

  it('greys « Sanctuaire rompu » out with the crack, not struck through', async () => {
    await render(
      <SignatureMark
        signature={{ ...SANCTUARY, glyph: 'crack8', text: 'Sanctuaire rompu', off: true }}
        testID="mark"
      />,
    );

    expect(style('mark')).toMatchObject({ backgroundColor: 'transparent' });
    expect(textStyle('Sanctuaire rompu')).toMatchObject({ color: battleColors.signatureOff });
    expect(textStyle('Sanctuaire rompu')).not.toHaveProperty('textDecorationLine');
    expect(screen.getByTestId('signature-glyph-crack8', hiddenToo)).toBeOnTheScreen();
  });
});

describe('the guard bar of the Beadle (#259, B1, B3, B5)', () => {
  it('has a steel border while his Sanctuary holds, and shows his mark', async () => {
    await renderColumn(warden());

    expect(style('enemy-beadle-guard-ward')).toMatchObject({ borderColor: battleColors.ward });
    const mark = screen.getByTestId('enemy-beadle-signature', hiddenToo);
    expect(within(mark).getByText('Sanctuaire ½', hiddenToo)).toBeOnTheScreen();
  });

  it('loses its steel border once broken', async () => {
    const { guardWard: _, ...broken } = warden();
    await renderColumn({ ...broken, stunned: true, guardRatio: 0 });

    expect(screen.queryByTestId('enemy-beadle-guard-ward', hiddenToo)).toBeNull();
  });
});

describe('the damage numbers (#259, M2, B2)', () => {
  it('carries a steel « ½ » on a blow the Sanctuary reduced', async () => {
    await render(
      <DamageFloat float={{ at: 0, text: '−6', big: false, kind: 'damage', half: true }} />,
    );

    expect(screen.getByText('−6', hiddenToo)).toBeOnTheScreen();
    expect(style('damage-half')).toMatchObject({ backgroundColor: battleColors.ward });
    expect(screen.getByText('½', hiddenToo)).toBeOnTheScreen();
  });

  it('carries no « ½ » on full damage', async () => {
    await render(<DamageFloat float={{ at: 0, text: '−22', big: true, kind: 'damage' }} />);

    expect(screen.queryByTestId('damage-half', hiddenToo)).toBeNull();
  });

  it('writes the « −2 » of the Thorns in bramble green', async () => {
    await render(
      <DamageFloat float={{ at: 'hero', text: '−2', big: false, kind: 'thorns' }} delayMs={300} />,
    );

    expect(textStyle('−2')).toMatchObject({ color: battleColors.thornLight });
  });

  it('writes the word « Épines » in bramble green, near the hero', async () => {
    await render(<ThornsWord delayMs={300} />);

    expect(textStyle('Épines')).toMatchObject({ color: battleColors.thornLight });
  });
});

describe('the plate of the hero pricked (#259, M2)', () => {
  it('keeps the HP shown until the « −2 », then frames the plate in bramble', async () => {
    await render(<HeroBar hero={HERO} shownHp={59} />);

    expect(screen.getByText('PV 59/80', hiddenToo)).toBeOnTheScreen();
    expect(screen.queryByTestId('battle-hero-thorns', hiddenToo)).toBeNull();
  });

  it('frames the plate in bramble when the hero is pricked', async () => {
    await render(<HeroBar hero={HERO} pricked={{ key: 1 }} />);

    expect(screen.getByText('PV 57/80', hiddenToo)).toBeOnTheScreen();
    expect(style('battle-hero-thorns')).toMatchObject({ borderColor: battleColors.thorn });
  });
});

describe('the words of the scene (#259, B3, B5)', () => {
  it('writes the Cassure of the Beadle and its subtitle in steel', async () => {
    await render(
      <FeedbackLabel
        texts={[{ tone: 'ward', title: 'Cassure', sub: 'Sanctuaire rompu · dégâts entiers' }]}
      />,
    );

    expect(textStyle('Cassure')).toMatchObject({ color: battleColors.onWard });
    expect(screen.getByText('Sanctuaire rompu · dégâts entiers', hiddenToo)).toBeOnTheScreen();
  });
});

describe('the first encounter bubbles (#259, M1, B1)', () => {
  it('says the price of the Thorns of the Bramble mother', async () => {
    await render(<EncounterHintBubble enemy="brambleMother" onClose={jest.fn()} />);

    expect(screen.getByText('Mère-ronce', hiddenToo)).toBeOnTheScreen();
    expect(
      screen.getByText(/Chaque frappe sur elle te coûte 2 PV, une fois par frappe/u, hiddenToo),
    ).toBeOnTheScreen();
  });

  it('says the Sanctuary of the Beadle', async () => {
    await render(<EncounterHintBubble enemy="beadle" onClose={jest.fn()} />);

    expect(screen.getByText('Bedeau', hiddenToo)).toBeOnTheScreen();
    expect(screen.getByText(/tant que sa garde tient/u, hiddenToo)).toBeOnTheScreen();
  });
});
