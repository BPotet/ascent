import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import { startTestBattle } from '../../../domain/battle/testing/testBattle';
import {
  ENEMY_NAMES,
  actionTrackLabel,
  announcement,
  attackButtonLabel,
  bleedChipText,
  bulwarkChipText,
  cursedTag,
  damageFloat,
  endTitle,
  enemyHpText,
  enemyLabel,
  enemyName,
  feedbackText,
  guardText,
  heroCard,
  powerDescription,
  heroHpText,
  intentNumber,
  intentSpeech,
  momentumLabel,
  phaseAnnouncement,
  phaseBanner,
  stunnedLabel,
  SECOND_CHANCE_SPENT,
  secondChanceBannerText,
} from './battleText';

const battle: Battle = startTestBattle({
  seed: 1,
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

const riposte: BattleEvent = {
  type: 'bulwarkCountered',
  at: 0,
  enemy: 0,
  damage: 3,
  guardDamage: 3,
  until: 400,
};

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

  it('reads « relevé » for an enemy that has revived by itself (#106)', () => {
    const skeleton = {
      ...ghoul,
      kind: 'skeleton',
      hp: 17,
      maxHp: 35,
      guard: 10,
      maxGuard: 10,
    } as const;
    expect(enemyLabel({ ...skeleton, selfRevives: 1 }, null, false)).toBe(
      'Squelette, relevé, 17 PV sur 35, garde 10 sur 10',
    );
    expect(enemyLabel({ ...skeleton, selfRevives: 0 }, null, false)).toBe(
      'Squelette, 17 PV sur 35, garde 10 sur 10',
    );
  });

  it('names the target in the label of « Attaquer »', () => {
    expect(attackButtonLabel('Spectre')).toBe('Attaquer, cible : Spectre');
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
      [
        { type: 'enemySelfRevived', at: 0, enemy: 0, hp: 17 },
        { tone: 'rise', title: 'Il se relève' },
      ],
      [riposte, { tone: 'riposte', title: 'Riposte' }],
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
      { type: 'bulwarkWorn', at: 0, enemy: 0 },
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
      // La Riposte du Rempart (#128) : précédé de l'écu, jamais agrandi.
      [
        { ...riposte, enemy: 1, damage: 4 },
        { at: 1, text: '−4', big: false, kind: 'riposte' },
      ],
    ] as [BattleEvent, unknown][])('flies %j', (event, float) => {
      expect(damageFloat(event)).toEqual(float);
    });

    it.each([
      blow('dodge', 0),
      blow('perfectParry', 0),
      { type: 'feintStarted', at: 0, enemy: 0 },
      { type: 'bulwarkWorn', at: 0, enemy: 0 },
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
      [
        {
          type: 'windUpStarted',
          at: 0,
          enemy: 1,
          attack: 'delayedPerilous',
          impacts: [900],
          feintAt: null,
        },
        'Spectre, coup retardé imparable, esquive',
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
      [{ type: 'bulwarkWorn', at: 0, enemy: 0 }, 'Rempart usé.'],
      [riposte, 'Riposte du Rempart, Goule, 3 dégâts'],
      [{ ...riposte, enemy: 1, damage: 1 }, 'Riposte du Rempart, Spectre, 1 dégât'],
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

    it('reads the Skeleton that revives with its HP (#106)', () => {
      const withSkeleton = startBattle({
        seed: 1,
        defenseHint: false,
        at: 0,
        enemies: ['skeleton'],
      }).battle;

      expect(
        announcement({ type: 'enemySelfRevived', at: 0, enemy: 0, hp: 17 }, withSkeleton),
      ).toBe('Squelette se relève, 17 PV sur 35');
    });
  });

  it('describes the Bulwark of the Sentinel by the text of the Codex (#128)', () => {
    expect(powerDescription('bulwark')).toBe(
      "Elle plante son bouclier devant elle et y met tout son poids. Le prochain coup qu'elle subit ne lui fait que la moitié de ses dégâts, après sa réduction, et elle riposte aussitôt, moins fort qu'une contre-attaque.",
    );
  });

  describe('the instant Shadow Step of the Wanderer (#173)', () => {
    it('announces that the hero phase goes on, the Bulwark unchanged', () => {
      expect(
        announcement(
          { type: 'powerUsed', at: 0, power: 'shadowStep', until: 0, instant: true },
          battle,
        ),
      ).toBe("Pas de l'ombre actif. Toujours à toi : vise et attaque.");
      expect(announcement({ type: 'powerUsed', at: 0, power: 'bulwark', until: 500 }, battle)).toBe(
        'Rempart',
      );
    });

    it('describes the Wanderer with 55 HP and the Shadow Step by the text of the Codex', () => {
      expect(heroCard('wanderer').stats).toBe('55 PV · Attaque 6 × 2 · Initiative 7');
      expect(powerDescription('shadowStep')).toBe(
        "Elle se fond dans sa propre ombre sans s'arrêter, et frappe dans le même élan. Sa prochaine esquive complète déclenche une contre-attaque, comme si le coup l'avait traversée sans la trouver.",
      );
      expect(heroCard('wanderer').label).toContain('55 PV');
      expect(heroCard('wanderer').label).toContain("Pouvoirs équipés : Pas de l'ombre, 3 Élan.");
      expect(heroCard('wanderer', ['shadowStep', 'rend', 'mist']).label).toContain(
        "Pouvoirs équipés : Pas de l'ombre, 3 Élan ; Entaille, 1 Élan ; Brume, 2 Élan.",
      );
    });
  });

  it('writes the Bulwark chip, then « Rempart usé » once it wears (#128)', () => {
    expect([bulwarkChipText(false), bulwarkChipText(true)]).toEqual(['Rempart', 'Rempart usé']);
  });

  it('ends the battle with its outcome', () => {
    expect([endTitle('victory'), endTitle('defeat')]).toEqual(['Combat gagné', 'Combat perdu']);
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

describe('actionTrackLabel (#175)', () => {
  const hero = { actor: 'hero', fighter: 'wanderer', phase2: false } as const;
  const specter = { actor: 1, fighter: 'specter', phase2: false } as const;
  const ghoul = (actor: number) => ({ actor, fighter: 'ghoul', phase2: false }) as const;

  it('reads the same sentence as before, two Ghouls as « Goule, Goule »', () => {
    const round = [specter, hero, ghoul(0), ghoul(2)];
    expect(actionTrackLabel(3, round, round)).toBe(
      "Ordre d'action. Manche 3 : Spectre, toi, Goule, Goule. Manche suivante : Spectre, toi, Goule, Goule.",
    );
  });

  it('reads a boss in phase 2 by its name only', () => {
    const gardener = { actor: 0, fighter: 'ashGardener', phase2: true } as const;
    expect(actionTrackLabel(2, [gardener], [gardener, hero])).toBe(
      "Ordre d'action. Manche 2 : Jardinière des cendres. Manche suivante : Jardinière des cendres, toi.",
    );
  });
});

describe('the names of the enemies of the Belfry (#214)', () => {
  const fallen = (kind: 'bellNovice' | 'matinsRinger' | 'clockJack') =>
    enemyLabel({ kind, hp: 0, maxHp: 45, guard: 0, maxGuard: 12, stun: null }, null, false);

  it('names them as the Codex does, without article', () => {
    expect([ENEMY_NAMES.bellNovice, ENEMY_NAMES.matinsRinger, ENEMY_NAMES.clockJack]).toEqual([
      'Novice des cloches',
      'Sonneuse de matines',
      'Jaquemart',
    ]);
  });

  it('agrees with the Matins ringer, a feminine name, and with the two others', () => {
    expect(fallen('matinsRinger')).toBe('Sonneuse de matines, tombée');
    expect(fallen('clockJack')).toBe('Jaquemart, tombé');
    expect(fallen('bellNovice')).toBe('Novice des cloches, tombé');
    expect(stunnedLabel('matinsRinger')).toBe('Étourdie ×1,5');
    expect(stunnedLabel('clockJack')).toBe('Étourdi ×1,5');
  });

  it('agrees the curse with the Bell novice and the Clock jack (#209)', () => {
    expect(enemyName({ kind: 'bellNovice', cursed: true })).toBe('Novice des cloches maudit');
    expect(enemyName({ kind: 'clockJack', cursed: true })).toBe('Jaquemart maudit');
  });
});

describe('the cursed enemy (#209)', () => {
  const cursedBattle = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['ghoul', 'specter', 'necromancer'],
    cursed: 0,
  }).battle;

  it('names it with the curse agreed to its name, everywhere', () => {
    expect(enemyName({ kind: 'ghoul', cursed: true })).toBe('Goule maudite');
    expect(enemyName({ kind: 'fallenKnight', cursed: true })).toBe('Chevalier déchu maudit');
    expect(enemyName({ kind: 'ghoul' })).toBe('Goule');
  });

  it('tags it « Maudite » or « Maudit », and an uncursed enemy not at all', () => {
    expect(cursedTag({ kind: 'ghoul', cursed: true })).toBe('Maudite');
    expect(cursedTag({ kind: 'specter', cursed: true })).toBe('Maudit');
    expect(cursedTag({ kind: 'ghoul' })).toBeNull();
  });

  it('says « Goule maudite » before its HP', () => {
    expect(
      enemyLabel(
        { ...ghoul, hp: 60, maxHp: 60, guard: 18, maxGuard: 18, cursed: true },
        { category: 'attack' },
        true,
      ),
    ).toBe('Goule maudite, cible, 60 PV sur 60, garde 18 sur 18, intention : attaque');
  });

  it('says both « maudit » and « relevé » of a cursed Skeleton that revived by itself', () => {
    expect(
      enemyLabel(
        {
          kind: 'skeleton',
          hp: 21,
          maxHp: 42,
          guard: 12,
          maxGuard: 12,
          stun: null,
          selfRevives: 1,
          cursed: true,
        },
        null,
        false,
      ),
    ).toBe('Squelette maudit, relevé, 21 PV sur 42, garde 12 sur 12');
  });

  it('names it in the announcements of the battle', () => {
    expect(
      announcement(
        { type: 'windUpStarted', at: 0, enemy: 0, attack: 'basic', impacts: [900], feintAt: null },
        cursedBattle,
      ),
    ).toBe('Goule maudite, coup simple');
    expect(
      announcement({ type: 'allyRaised', at: 0, enemy: 2, ally: 0, hp: 30 }, cursedBattle),
    ).toBe('Nécromancien relève Goule maudite, 30 PV');
  });

  it('names it in the action track', () => {
    const cursed = { actor: 0, fighter: 'ghoul', phase2: false, cursed: true } as const;
    const hero = { actor: 'hero', fighter: 'sentinel', phase2: false } as const;
    expect(actionTrackLabel(1, [cursed, hero], [hero, cursed])).toBe(
      "Ordre d'action. Manche 1 : Goule maudite, toi. Manche suivante : toi, Goule maudite.",
    );
  });
});

describe('the second chance (#206)', () => {
  const rise = (
    cancelled: number,
    enemy = 0,
  ): Extract<BattleEvent, { type: 'secondChanceUsed' }> => ({
    type: 'secondChanceUsed',
    at: 0,
    until: 2_000,
    enemy,
    hp: 40,
    cancelled,
  });

  it('writes the banner: the hero rises, then the second blow of the enemy is cancelled', () => {
    expect(secondChanceBannerText(rise(1), battle)).toEqual({
      title: 'Seconde chance',
      lines: ['La Sentinelle se relève avec 40 PV.', 'Le second coup de la Goule est annulé.'],
    });
  });

  it('writes no second line when no impact was cancelled', () => {
    expect(secondChanceBannerText(rise(0, 1), battle)).toEqual({
      title: 'Seconde chance',
      lines: ['La Sentinelle se relève avec 40 PV.'],
    });
  });

  it('announces the rise in one sentence, from the text of the mockup', () => {
    expect(announcement(rise(1), battle)).toBe(
      'Seconde chance : la Sentinelle se relève avec 40 PV. Le second coup de la Goule est annulé.',
    );
    expect(announcement(rise(0), { ...battle, heroKind: 'wanderer' })).toBe(
      "Seconde chance : l'Errante se relève avec 40 PV.",
    );
  });

  it('flies « +40 » in gold over the hero', () => {
    expect(damageFloat(rise(1))).toEqual({
      at: 'hero',
      text: '+40',
      big: false,
      kind: 'secondChance',
    });
  });

  it('says the second chance has already served at the defeat after it was used', () => {
    const ended: BattleEvent = { type: 'battleEnded', at: 0, outcome: 'defeat' };
    const used = { ...battle, hero: { ...battle.hero, secondChance: 'used' as const } };

    expect(announcement(ended, used)).toBe(`Combat perdu. ${SECOND_CHANCE_SPENT}`);
    expect(SECOND_CHANCE_SPENT).toBe('Ta seconde chance a déjà servi.');
    expect(announcement(ended, battle)).toBe('Combat perdu.');
    expect(announcement({ ...ended, outcome: 'victory' }, used)).toBe('Combat gagné.');
  });
});

describe('the texts of the powers of #235', () => {
  const battle = startTestBattle({ seed: 7, defenseHint: false, at: 0 }).battle;
  const casting: Battle = {
    ...battle,
    phase: { kind: 'heroPower', power: 'holdFast', since: 0, until: 500 },
  };

  it('writes a scene word for each power but the Bulwark, in shade for the Wanderer', () => {
    expect(
      feedbackText({ type: 'powerUsed', at: 0, power: 'rend', until: 0, instant: true }),
    ).toEqual({ tone: 'shadowStep', title: 'Entaille' });
    expect(feedbackText({ type: 'powerUsed', at: 0, power: 'holdFast', until: 500 })).toEqual({
      tone: 'perfect',
      title: 'Tenir bon',
    });
    expect(feedbackText({ type: 'powerUsed', at: 0, power: 'bulwark', until: 500 })).toBeNull();
  });

  it('announces an instant power, agreed in gender, then « Toujours à toi »', () => {
    expect(
      announcement({ type: 'powerUsed', at: 0, power: 'rend', until: 0, instant: true }, battle),
    ).toBe('Entaille active. Toujours à toi : vise et attaque.');
    expect(
      announcement(
        { type: 'powerUsed', at: 0, power: 'retaliation', until: 0, instant: true },
        battle,
      ),
    ).toBe('Représailles actif. Toujours à toi : vise et attaque.');
  });

  it('announces and floats the heal of Hold Fast in gold, nothing at max HP (K12)', () => {
    const healed = { type: 'heroHealed', at: 0, power: 'holdFast', heal: 16, heroHp: 46 } as const;

    expect(announcement(healed, casting)).toBe('Plus 16 PV');
    expect(damageFloat(healed)).toEqual({ at: 'hero', text: '+16', big: false, kind: 'heal' });
    expect(damageFloat({ ...healed, heal: 0 })).toBeNull();
    expect(announcement({ ...healed, heal: 0 }, casting)).toBeNull();
    expect(announcement({ type: 'burnCleared', at: 0 }, casting)).toBe('Brûlure éteinte.');
    expect(announcement({ type: 'burnCleared', at: 0 }, battle)).toBeNull();
    expect(announcement({ type: 'bleedStopped', at: 0 }, casting)).toBe('Saignement arrêté.');
  });

  it('announces the wear of the Mist and the counter of Retaliation', () => {
    expect(announcement({ type: 'mistWorn', at: 0, enemy: 0 }, battle)).toBe('Brume usée.');
    expect(
      announcement(
        {
          type: 'counterAttacked',
          at: 0,
          enemy: 0,
          damage: 13,
          guardDamage: 24,
          until: 200,
          retaliation: true,
        },
        battle,
      ),
    ).toBe('Représailles, contre-attaque, 13 dégâts');
  });
});

describe('the texts of a kindled power in battle (#237)', () => {
  const kindledBattle = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['ghoul'],
    powers: ['bulwark', 'retaliation'],
    kindled: ['retaliation'],
  }).battle;
  const used = {
    type: 'powerUsed',
    at: 10,
    power: 'retaliation',
    until: 510,
    instant: true,
  } as const;

  it('reads the kindled power on the card of the hero', () => {
    expect(heroCard('sentinel', ['bulwark', 'retaliation'], ['retaliation']).label).toContain(
      'Pouvoirs équipés : Rempart, 1 Élan ; Représailles, attisé, 1 Élan.',
    );
  });

  it('writes « Attisé · 1 Élan » under the scene word, and says it', () => {
    expect(feedbackText(used, kindledBattle)).toEqual({
      tone: 'perfect',
      title: 'Représailles',
      sub: 'Attisé · 1 Élan',
    });
    expect(announcement(used, kindledBattle)).toBe(
      'Représailles actif, attisé, 1 Élan. Toujours à toi : vise et attaque.',
    );
  });

  it('writes the scene word alone for a power that is not kindled', () => {
    const plain = { ...kindledBattle, kindled: [] };

    expect(feedbackText(used, plain)).toEqual({ tone: 'perfect', title: 'Représailles' });
    expect(announcement(used, plain)).toBe('Représailles actif. Toujours à toi : vise et attaque.');
  });
});
