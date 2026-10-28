import { startTrialBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { DEFAULT_TRIAL_TUNING } from '../../../domain/battle/TrialTuning';
import {
  ENEMY_NAMES,
  announcement,
  attackButtonLabel,
  bleedChipText,
  damageFloat,
  endLine,
  endTitle,
  enemyHpText,
  enemyLabel,
  feedbackText,
  guardText,
  heroHpText,
  intentNumber,
  intentSpeech,
  momentumLabel,
  phaseAnnouncement,
  phaseBanner,
  powerButtonLabel,
  powerCostText,
  respiteText,
  stunnedLabel,
} from './battleText';

const battle: Battle = startTrialBattle({
  seed: 1,
  tuning: DEFAULT_TRIAL_TUNING,
  defenseHint: false,
  at: 0,
}).battle;

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

function strike(
  judgement: Extract<BattleEvent, { type: 'strikeResolved' }>['judgement'],
  damage: number,
): BattleEvent {
  return {
    type: 'strikeResolved',
    at: 0,
    enemy: 0,
    judgement,
    delta: judgement === null ? null : 0,
    damage,
    guardDamage: 12,
  };
}

const ghoul = { kind: 'ghoul', hp: 38, maxHp: 50, guard: 15, maxGuard: 15, stun: null } as const;

describe('battle texts', () => {
  it('writes the HP and the guard under an enemy', () => {
    expect(enemyHpText(38, 50)).toBe('38/50 PV');
    expect(guardText(8, 12)).toBe('Garde 8/12');
  });

  it('says « Étourdie » for the Ghoul, « Étourdi » for the others', () => {
    expect(stunnedLabel('ghoul')).toBe('Étourdie ×1,5');
    expect(stunnedLabel('specter')).toBe('Étourdi ×1,5');
    expect(stunnedLabel('necromancer')).toBe('Étourdi ×1,5');
  });

  it('shows a number only on the Guard and Heal intents', () => {
    expect(intentNumber({ category: 'guard', gain: 3 })).toBe('+3');
    expect(intentNumber({ category: 'heal', gain: 6 })).toBe('+6');
    expect(intentNumber({ category: 'attack' })).toBeNull();
    expect(intentNumber({ category: 'raise' })).toBeNull();
    expect(intentNumber({ category: 'skip', reason: 'stunned' })).toBeNull();
  });

  it('reads the category of an intent, with its number for Guard and Heal (C2.2)', () => {
    expect(intentSpeech('ghoul', { category: 'attack' })).toBe('intention : attaque');
    expect(intentSpeech('necromancer', { category: 'guard', gain: 3 })).toBe(
      'intention : garde, plus 3',
    );
    expect(intentSpeech('necromancer', { category: 'heal', gain: 6 })).toBe(
      'intention : soin, plus 6',
    );
    expect(intentSpeech('necromancer', { category: 'raise' })).toBe('intention : relever un allié');
    expect(intentSpeech('ghoul', { category: 'skip', reason: 'stunned' })).toBe(
      "étourdie, n'agit pas",
    );
    expect(intentSpeech('specter', { category: 'skip', reason: 'raised' })).toBe(
      "relevé, n'agit pas",
    );
  });

  it('reads an enemy in full: name, target, HP, guard and intent, never the attack', () => {
    expect(enemyLabel(ghoul, { category: 'attack' }, true)).toBe(
      'Goule, cible, 38 PV sur 50, garde 15 sur 15, intention : attaque',
    );
    expect(
      enemyLabel(
        { ...ghoul, kind: 'necromancer', hp: 41, maxHp: 45, guard: 8, maxGuard: 12 },
        { category: 'guard', gain: 3 },
        false,
      ),
    ).toBe('Nécromancien, 41 PV sur 45, garde 8 sur 12, intention : garde, plus 3');
    expect(
      enemyLabel(
        { ...ghoul, guard: 0, stun: { actionLost: false, heroAction: 1 } },
        { category: 'skip', reason: 'stunned' },
        false,
      ),
    ).toBe("Goule, 38 PV sur 50, étourdie, dégâts ×1,5, étourdie, n'agit pas");
    expect(
      enemyLabel({ ...ghoul, guard: 0, stun: { actionLost: true, heroAction: 1 } }, null, false),
    ).toBe('Goule, 38 PV sur 50, étourdie, dégâts ×1,5');
    expect(enemyLabel({ ...ghoul, hp: 0 }, null, false)).toBe('Goule, tombée');
    expect(enemyLabel({ ...ghoul, kind: 'specter', hp: 0 }, null, false)).toBe('Spectre, tombé');
  });

  it('names the target in the label of « Attaquer »', () => {
    expect(attackButtonLabel('Spectre')).toBe('Attaquer, cible : Spectre');
  });

  it('writes the Bulwark with its cost, or the momentum it misses (C3)', () => {
    expect(powerCostText('bulwark')).toBe('Rempart · 1 Élan');
    expect(powerButtonLabel('bulwark', 0)).toBe('Pouvoir : Rempart, 1 Élan');
    expect(powerButtonLabel('bulwark', 1)).toBe(
      'Pouvoir : Rempart, 1 Élan, indisponible : il manque 1 Élan',
    );
    expect(powerButtonLabel('bulwark', 2)).toBe(
      'Pouvoir : Rempart, 1 Élan, indisponible : il manque 2 Élan',
    );
  });

  it('reads the momentum out of 5', () => {
    expect(momentumLabel(2)).toBe('Élan 2 sur 5');
  });

  it('announces each phase with its banner', () => {
    expect(phaseBanner('enemy')).toEqual({ title: 'Phase ennemie', line: 'Prépare ta parade' });
    expect(phaseBanner('hero')).toEqual({ title: 'À toi', line: 'Vise et attaque' });
    expect(phaseAnnouncement('enemy')).toBe('Phase ennemie. Prépare ta parade.');
    expect(phaseAnnouncement('hero')).toBe('À toi. Vise et attaque.');
  });

  describe('feedbackText: the only words shown on the scene', () => {
    it.each([
      [blow('perfectParry', 0), { tone: 'perfect', title: 'Parfait' }],
      [
        { type: 'counterAttacked', at: 0, enemy: 0, damage: 6, guardDamage: 12, until: 400 },
        { tone: 'perfect', title: 'Parfait · contre-attaque' },
      ],
      [
        { type: 'guardBroken', at: 0, enemy: 0, by: 'counter' },
        { tone: 'break', title: 'Cassure' },
      ],
      [strike('perfect', 15), { tone: 'perfect', title: 'Frappe parfaite' }],
    ] as [BattleEvent, unknown][])('shows %j', (event, text) => {
      expect(feedbackText(event)).toEqual(text);
    });

    it.each([
      blow('parry', 1),
      blow('dodge', 0),
      blow('perilousParry', 8),
      blow('suffered', 4),
      strike('good', 12),
      strike(null, 10),
      { type: 'whiffed', at: 0, button: 'parry', reason: 'early' },
      { type: 'pressIgnored', at: 0, button: 'parry', reason: 'offBalance' },
      { type: 'heroPhaseStarted', at: 0, announced: true },
    ] as BattleEvent[])('shows no word for $type', (event) => {
      expect(feedbackText(event)).toBeNull();
    });

    it('never writes « Critique »', () => {
      expect(JSON.stringify(feedbackText(strike('perfect', 15)))).not.toMatch(/critique/i);
    });
  });

  describe('damageFloat: the « −N » and « +N » that fly up', () => {
    it.each([
      [blow('parry', 1), { at: 'hero', text: '−1', big: false, kind: 'damage' }],
      [blow('suffered', 4), { at: 'hero', text: '−4', big: false, kind: 'damage' }],
      [blow('perilousParry', 8), { at: 'hero', text: '−8', big: false, kind: 'damage' }],
      [strike('perfect', 15), { at: 0, text: '−15', big: true, kind: 'damage' }],
      [strike(null, 10), { at: 0, text: '−10', big: false, kind: 'damage' }],
      [
        { type: 'counterAttacked', at: 0, enemy: 1, damage: 6, guardDamage: 12, until: 400 },
        { at: 1, text: '−6', big: false, kind: 'damage' },
      ],
      [
        { type: 'guardRaised', at: 0, enemy: 2, gain: 3, guard: 7 },
        { at: 2, text: '+3', big: false, kind: 'guard' },
      ],
    ] as [BattleEvent, unknown][])('flies %j', (event, float) => {
      expect(damageFloat(event)).toEqual(float);
    });

    it.each([
      blow('dodge', 0),
      blow('perfectParry', 0),
      { type: 'feintStarted', at: 0, enemy: 0 },
    ] as BattleEvent[])('flies nothing for $type without damage', (event) => {
      expect(damageFloat(event)).toBeNull();
    });
  });

  describe('announcement: the full sentences of the screen reader', () => {
    it.each([
      [
        { type: 'phaseTransitionStarted', at: 0, to: 'enemy', until: 800 },
        'Phase ennemie. Prépare ta parade.',
      ],
      [
        { type: 'phaseTransitionStarted', at: 0, to: 'hero', until: 800 },
        'À toi. Vise et attaque.',
      ],
      [{ type: 'heroPhaseStarted', at: 0, announced: true }, 'À toi. Vise et attaque.'],
      [
        { type: 'windUpStarted', at: 0, enemy: 0, attack: 'basic', impacts: [900], feintAt: null },
        'Goule, coup simple',
      ],
      [
        {
          type: 'windUpStarted',
          at: 0,
          enemy: 1,
          attack: 'perilous',
          impacts: [900],
          feintAt: null,
        },
        'Spectre, coup imparable, esquive',
      ],
      [blow('perfectParry', 0), 'Parade parfaite'],
      [blow('parry', 1), 'Parade, 1 dégât'],
      [blow('dodge', 0), 'Esquive, aucun dégât'],
      [blow('perilousParry', 8), 'Coup imparable : la parade échoue, 8 dégâts'],
      [blow('suffered', 4), 'Touché, 4 dégâts'],
      [
        { type: 'counterAttacked', at: 0, enemy: 0, damage: 6, guardDamage: 12, until: 400 },
        'Contre-attaque, 6 dégâts',
      ],
      [{ type: 'whiffed', at: 0, button: 'parry', reason: 'early' }, 'Trop tôt, déséquilibré'],
      [{ type: 'whiffed', at: 0, button: 'parry', reason: 'late' }, 'Trop tard, déséquilibré'],
      [{ type: 'whiffed', at: 0, button: 'dodge', reason: 'empty' }, 'Dans le vide, déséquilibré'],
      [{ type: 'pressIgnored', at: 0, button: 'parry', reason: 'offBalance' }, 'Déséquilibré'],
      [strike('perfect', 15), 'Frappe parfaite, 15 dégâts'],
      [strike('good', 12), 'Bonne frappe, 12 dégâts'],
      [strike('miss', 10), 'Frappe, 10 dégâts'],
      [{ type: 'guardBroken', at: 0, enemy: 0, by: 'counter' }, 'Cassure, Goule étourdie'],
      [{ type: 'guardBroken', at: 0, enemy: 1, by: 'strike' }, 'Cassure, Spectre étourdi'],
      [{ type: 'actionLost', at: 0, enemy: 0, until: 250 }, "Goule, étourdie, n'agit pas"],
      [
        { type: 'guardRestored', at: 0, enemy: 0, until: 400, inPlaceOfAction: false },
        'Goule, retour en garde',
      ],
      [
        { type: 'guardRaised', at: 0, enemy: 2, gain: 3, guard: 7 },
        'Nécromancien relève sa garde, plus 3',
      ],
      [
        { type: 'allyRaised', at: 0, enemy: 2, ally: 0, hp: 25 },
        'Nécromancien relève Goule, 25 PV',
      ],
      [{ type: 'powerUsed', at: 0, power: 'bulwark', until: 500 }, 'Rempart'],
      [{ type: 'respite', at: 0, gain: 8, heroHp: 58 }, 'Répit, plus 8 PV'],
      [{ type: 'battleEnded', at: 0, outcome: 'defeat' }, 'Combat perdu.'],
    ] as [BattleEvent, string][])('reads %j', (event, sentence) => {
      expect(announcement(event, battle)).toBe(sentence);
    });

    it.each([
      { type: 'heroPhaseStarted', at: 0, announced: false },
      { type: 'pressIgnored', at: 0, button: 'parry', reason: 'phaseTransition' },
      { type: 'offBalanceStarted', at: 0, until: 450 },
      { type: 'strikeStarted', at: 0, enemy: 0, impactAt: 700, until: 1_180 },
      { type: 'respite', at: 0, gain: 0, heroHp: 80 },
    ] as BattleEvent[])('reads nothing for $type', (event) => {
      expect(announcement(event, battle)).toBeNull();
    });
  });

  it('ends the battle with its outcome and the respite', () => {
    expect([endTitle('victory'), endLine('victory')]).toEqual([
      'Combat gagné',
      'La Goule, le Spectre et le Nécromancien sont tombés.',
    ]);
    expect([endTitle('defeat'), endLine('defeat')]).toEqual([
      'Combat perdu',
      'La Sentinelle est tombée.',
    ]);
    expect(respiteText(8)).toBe('Répit +8 PV');
  });

  it('writes the HP of the hero', () => {
    expect(heroHpText(56, 80)).toBe('PV 56/80');
  });

  describe('the Bleed (prototype #107)', () => {
    const ticked = (loss: number, roundsLeft: number): BattleEvent => ({
      type: 'bleedTicked',
      at: 0,
      loss,
      heroHp: 48,
      roundsLeft,
    });

    it('writes the chip with the rounds left', () => {
      expect(bleedChipText(3)).toBe('Saignement ×3');
    });

    it('shows the loss above the hero, nothing at the 1 HP floor', () => {
      expect(damageFloat(ticked(2, 2))).toEqual({
        at: 'hero',
        text: '−2',
        big: false,
        kind: 'damage',
      });
      expect(damageFloat(ticked(0, 1))).toBeNull();
    });

    it.each([
      [
        { type: 'heroBleeding', at: 0, damage: 2, rounds: 3 },
        'Saignement : moins 2 PV pendant 3 manches',
      ],
      [ticked(2, 2), 'Saignement, 2 dégâts, encore 2 manches'],
      [ticked(1, 1), 'Saignement, 1 dégât, encore 1 manche'],
      [ticked(2, 0), 'Saignement, 2 dégâts. Saignement terminé'],
    ] as [BattleEvent, string][])('reads %j', (event, sentence) => {
      expect(announcement(event, battle)).toBe(sentence);
    });

    it('names the Mad villager, a masculine name', () => {
      expect(ENEMY_NAMES.madVillager).toBe('Villageois fou');
      expect(stunnedLabel('madVillager')).toBe('Étourdi ×1,5');
    });
  });
});
