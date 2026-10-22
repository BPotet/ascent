import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import {
  attackButtonLabel,
  endLine,
  endTitle,
  enemyLabel,
  feedbackAnnouncement,
  feedbackText,
  heroHpText,
  intentBadge,
  intentLabel,
  phaseAnnouncement,
  phaseBanner,
  windUpAnnouncement,
} from './battleText';

const intent = (attack: 'basic' | 'double' | 'perilous', damage: number) => ({
  attack,
  damage,
  windUpMs: 1_100,
  feintFraction: 0.5,
});

function blow(
  outcome: Extract<BattleEvent, { type: 'blowResolved' }>['outcome'],
  damage: number,
): BattleEvent {
  return {
    type: 'blowResolved',
    at: 0,
    enemy: 0,
    index: 0,
    outcome,
    button: null,
    delta: null,
    damage,
    heroHp: 80,
  };
}

describe('battle texts', () => {
  it('writes the damage of an intent on its badge, twice for a double attack', () => {
    expect(intentBadge(intent('basic', 5))).toBe('5');
    expect(intentBadge(intent('double', 3))).toBe('2×3');
  });

  it('reads an intent in full', () => {
    expect(intentLabel(intent('basic', 5))).toBe('Coup simple, 5 dégâts');
    expect(intentLabel(intent('double', 3))).toBe('Double frappe, 2 fois 3 dégâts');
    expect(intentLabel(intent('perilous', 1))).toBe('Coup imparable, 1 dégât');
  });

  it('reads an enemy in full: name, target, HP and intent', () => {
    const ghoul = { kind: 'ghoul' as const, hp: 14, maxHp: 20, intent: intent('basic', 5) };

    expect(enemyLabel(ghoul, true)).toBe(
      'Goule, cible, PV 14 sur 20, intention : coup simple, 5 dégâts',
    );
    expect(enemyLabel({ ...ghoul, kind: 'specter' }, false)).toBe(
      'Spectre, PV 14 sur 20, intention : coup simple, 5 dégâts',
    );
    expect(enemyLabel({ ...ghoul, hp: 0 }, false)).toBe('Goule, tombé');
  });

  it('names the target in the label of « Attaquer »', () => {
    expect(attackButtonLabel('Spectre')).toBe('Attaquer, cible : Spectre');
  });

  it('announces each phase with its banner', () => {
    expect(phaseBanner('enemy')).toEqual({ title: 'Phase ennemie', line: 'Prépare ta parade' });
    expect(phaseBanner('hero')).toEqual({ title: 'À toi', line: 'Vise et attaque' });
    expect(phaseAnnouncement('enemy')).toBe('Phase ennemie. Prépare ta parade.');
    expect(phaseAnnouncement('hero')).toBe('À toi. Vise et attaque.');
  });

  it.each([
    [blow('perfectParry', 0), { tone: 'perfect', title: 'Parade parfaite', detail: null }],
    [blow('parry', 1), { tone: 'good', title: 'Parade', detail: '1 dégât au lieu de 5' }],
    [blow('parry', 2), { tone: 'good', title: 'Parade', detail: '2 dégâts au lieu de 5' }],
    [blow('dodge', 0), { tone: 'good', title: 'Esquive', detail: 'Aucun dégât' }],
    [blow('perilousParry', 8), { tone: 'miss', title: 'Imparable : esquive !', detail: '−8 PV' }],
    [blow('suffered', 4), { tone: 'miss', title: 'Touché', detail: '−4 PV' }],
    [
      { type: 'counterAttacked', at: 0, enemy: 0, damage: 6, until: 400 },
      { tone: 'perfect', title: 'Parade parfaite', detail: 'Contre-attaque · 6 dégâts' },
    ],
    [
      { type: 'whiffed', at: 0, button: 'parry', reason: 'early' },
      { tone: 'miss', title: 'Trop tôt', detail: null },
    ],
    [
      { type: 'whiffed', at: 0, button: 'parry', reason: 'late' },
      { tone: 'miss', title: 'Trop tard', detail: null },
    ],
    [
      { type: 'whiffed', at: 0, button: 'dodge', reason: 'empty' },
      { tone: 'miss', title: 'Dans le vide', detail: null },
    ],
    [
      { type: 'pressIgnored', at: 0, button: 'parry', reason: 'offBalance' },
      { tone: 'miss', title: 'Déséquilibré', detail: null },
    ],
    [
      { type: 'heroAttacked', at: 0, enemy: 0, damage: 10, until: 500 },
      { tone: 'neutral', title: 'Attaque', detail: '10 dégâts' },
    ],
  ] as [BattleEvent, unknown][])('shows %j', (event, text) => {
    expect(feedbackText(event, 5)).toEqual(text);
  });

  it.each([
    { type: 'pressIgnored', at: 0, button: 'parry', reason: 'phaseTransition' },
    { type: 'offBalanceStarted', at: 0, until: 450 },
    { type: 'heroPhaseStarted', at: 0 },
  ] as BattleEvent[])('shows nothing for $type', (event) => {
    expect(feedbackText(event, 5)).toBeNull();
  });

  it('announces a result with its detail, when it has one', () => {
    expect(feedbackAnnouncement({ tone: 'miss', title: 'Touché', detail: '−4 PV' })).toBe(
      'Touché, −4 PV',
    );
    expect(feedbackAnnouncement({ tone: 'miss', title: 'Trop tôt', detail: null })).toBe(
      'Trop tôt',
    );
  });

  it('announces a wind-up, and asks to dodge a perilous attack', () => {
    expect(windUpAnnouncement('ghoul', 'double')).toBe('Goule : double frappe');
    expect(windUpAnnouncement('specter', 'perilous')).toBe('Spectre : coup imparable, esquive');
  });

  it('ends the battle with its outcome', () => {
    expect([endTitle('victory'), endLine('victory')]).toEqual([
      'Combat gagné',
      'La Goule et le Spectre sont tombés.',
    ]);
    expect([endTitle('defeat'), endLine('defeat')]).toEqual([
      'Combat perdu',
      'La Sentinelle est tombée.',
    ]);
  });

  it('writes the HP of the hero', () => {
    expect(heroHpText(56, 80)).toBe('PV 56/80');
  });
});
