// Les textes du Fossoyeur (#258, maquette 245, F1 à F6, § 6) : son nom, sa marque de signature, sa
// bulle de première rencontre, l'annonce de l'Exhumation et ses phrases au lecteur d'écran. Les
// libellés disent « exhume », jamais « relève » (écart de vocabulaire noté par l'UX).
import { startBattle, type Battle } from '../../../domain/battle/Battle';
import type { BattleEvent } from '../../../domain/battle/BattleEvent';
import type { EnemyKind } from '../../../domain/battle/combatants';
import {
  ENEMY_NAMES,
  announcement,
  announcementsFor,
  encounterHintText,
  enemyLabel,
  exhumeBannerText,
  intentSpeech,
  signatureText,
} from './battleText';

function battleOf(kinds: readonly EnemyKind[]): Battle {
  const { battle } = startBattle({ seed: 1, defenseHint: false, at: 0, enemies: kinds });
  return battle;
}

const exhumed: BattleEvent = { type: 'enemyExhumed', at: 0, enemy: 0, slot: 1, kind: 'skeleton' };

describe('the name of the Gravedigger (#258)', () => {
  it('is « Fossoyeur », without an article, masculine', () => {
    expect(ENEMY_NAMES.gravedigger).toBe('Fossoyeur');
    expect(intentSpeech('gravedigger', { category: 'skip', reason: 'stunned' })).toBe(
      "étourdi, n'agit pas",
    );
  });
});

describe('the signature mark Exhume (#258, F1 to F5)', () => {
  it('says the next even round: « Exhume · manche 2 »', () => {
    expect(signatureText('gravedigger', { state: 'next', round: 2 })).toEqual({
      text: 'Exhume · manche 2',
      speech: 'exhume un Squelette à la manche 2',
    });
  });

  it('says « Exhume maintenant », and how to prevent it to the screen reader', () => {
    expect(signatureText('gravedigger', { state: 'now' })).toEqual({
      text: 'Exhume maintenant',
      speech: 'exhume un Squelette cette manche ; brise sa garde avant son tour pour l’en empêcher',
    });
  });

  it('says « Pas d’exhumation » when the guard broke', () => {
    expect(signatureText('gravedigger', { state: 'lost' })).toEqual({
      text: 'Pas d’exhumation',
      speech: 'garde brisée : pas d’exhumation cette manche',
    });
  });

  it('says « Squelette debout » while an exhumed Skeleton stands', () => {
    expect(signatureText('gravedigger', { state: 'standing' })).toEqual({
      text: 'Squelette debout',
      speech: 'un Squelette debout : il n’exhume pas',
    });
  });

  it('never says « relève »', () => {
    const marks = [
      { state: 'next', round: 4 },
      { state: 'now' },
      { state: 'lost' },
      { state: 'standing' },
    ] as const;
    for (const mark of marks) {
      const { text, speech } = signatureText('gravedigger', mark);
      expect(`${text} ${speech}`).not.toMatch(/relève/u);
    }
  });
});

describe('the first encounter bubble (#258, F1)', () => {
  it('names the Gravedigger and says his rule, once per Elite', () => {
    expect(encounterHintText('gravedigger')).toEqual({
      title: 'Fossoyeur',
      text: 'Aux manches paires, il exhume un Squelette, un seul à la fois. Sa pelle s’affiche d’avance : brise sa garde avant son tour pour l’en empêcher.',
      close: "Touche n'importe où pour fermer. Elle ne reviendra pas.",
      speech:
        'Fossoyeur. Aux manches paires, il exhume un Squelette, un seul à la fois. Brise sa garde avant son tour pour l’en empêcher',
    });
  });
});

describe('the exhumation on the screen and to the screen reader (#258, F3, F4, F6)', () => {
  it('announces « Il exhume un Squelette » over « Première place libre · il n’agit pas cette manche »', () => {
    expect(exhumeBannerText('gravedigger', 'skeleton')).toEqual({
      title: 'Il exhume un Squelette',
      line: 'Première place libre · il n’agit pas cette manche',
    });
  });

  it('reads « Le Fossoyeur exhume un Squelette. Squelette, invoqué, n’agit pas cette manche »', () => {
    expect(announcement(exhumed, battleOf(['gravedigger', 'skeleton']))).toBe(
      'Le Fossoyeur exhume un Squelette. Squelette, invoqué, n’agit pas cette manche',
    );
  });

  it('reads the guard broken before his exhumation: « pas d’exhumation cette manche »', () => {
    const battle = battleOf(['gravedigger']);
    const exhuming: Battle = {
      ...battle,
      enemies: [{ ...battle.enemies[0]!, intent: { category: 'exhume', slot: 1 } }],
    };
    const broken: BattleEvent = { type: 'guardBroken', at: 0, enemy: 0, by: 'strike' };

    expect(announcement(broken, exhuming)).toBe(
      'Cassure, Fossoyeur étourdi : pas d’exhumation cette manche',
    );
    expect(announcement(broken, battle)).toBe('Cassure, Fossoyeur étourdi');
  });

  it('reads the fall of the exhumed Skeleton with him: « Le Fossoyeur tombe. Le Squelette tombe avec lui. »', () => {
    const battle = battleOf(['gravedigger', 'skeleton']);

    expect(announcementsFor([{ type: 'summonedFell', at: 0, enemy: 1 }], battle)).toEqual([
      'Le Fossoyeur tombe. Le Squelette tombe avec lui.',
    ]);
  });

  it('reads the plate with the Elite, the signature and the intent Exhume (F2)', () => {
    const [digger] = battleOf(['gravedigger']).enemies;

    expect(
      enemyLabel(
        { ...digger!, hp: 108, maxHp: 120, guard: 36, maxGuard: 50 },
        { category: 'exhume' },
        true,
        'elite',
        'exhume un Squelette cette manche',
      ),
    ).toBe(
      'Fossoyeur, Élite, cible, 108 PV sur 120, garde 36 sur 50, exhume un Squelette cette manche, intention : exhumer',
    );
  });

  it('reads an exhumed Skeleton that does not act: « invoqué, n’agit pas »', () => {
    expect(intentSpeech('skeleton', { category: 'skip', reason: 'exhumed' })).toBe(
      "invoqué, n'agit pas",
    );
  });
});
