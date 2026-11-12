// Le palier 1 ne change pas (#38, risque 1 des notes de l'Architect) : pour 200 graines, les
// groupes, leurs tailles, les Élites, les boss, l'Or, le butin, les intentions tirées (dégâts
// compris), les PV et la garde des ennemis, et le changement de phase à 150 PV des boss du
// palier 1 sont ceux de `develop` à `582cc236`, figés avant les paliers 2 et 3. Changements
// voulus depuis, régénérés seuls : les durées de préparation ×0,9 à ×1,1 (#211) ; #244 : les gardes
// (G2, colonne garde du multiplicateur d'Élite et de boss) et l'Élite non répétée (R5) ; #257 : PV
// et dégâts des Élites à 80 % ; #258 : le Fossoyeur et la règle du sac ; #246 : Porte-cierge et Rat
// de crypte dans les groupes du palier 1, compositions régénérées (#268, contrôle par jeton dans
// l'en-tête de `tierOneDraws.ts`).
import { TIER_ONE_PHASE_SHIFTS, TIER_ONE_WALKS } from './testing/tierOneDraws';
import { WALKED_SEEDS, phaseShiftText, walkTierOne } from './testing/tierOneWalk';

describe('Tier 1 unchanged (#38)', () => {
  it('replays the same 200 ascents of tier 1, draw for draw', () => {
    expect(TIER_ONE_WALKS).toHaveLength(WALKED_SEEDS);
    TIER_ONE_WALKS.forEach((walk, index) => {
      expect(walkTierOne(index + 1)).toBe(walk);
    });
  });

  it('keeps the damage of the Codex in the drawn intents of the Candle bearer and the Crypt rats (#268, D1)', () => {
    const segment = /combat\[([^\]]*)\]#\d+\{[^}]*\}<([^>]*)>/g;
    const drawn = TIER_ONE_WALKS.flatMap((walk) =>
      [...walk.matchAll(segment)].flatMap(([, group, intents]) => {
        const kinds = group!.split(',').slice(0, 3);
        return intents!
          .split('/')
          .flatMap((line) => line.split(',').map((intent, index) => [kinds[index], intent]));
      }),
    );
    const of = (kind: string) =>
      new Set(
        drawn
          .filter(([each]) => each === kind)
          .map(([, intent]) => intent!.split(':', 2).join(':')),
      );

    expect(of('candleBearer')).toEqual(new Set(['basic:5']));
    expect(of('cryptRat')).toEqual(new Set(['basic:4', 'double:3']));
  });

  it('shifts the tier 1 bosses to phase 2 at 150 HP or less, as before', () => {
    const replayed = ['ossuaryWarden', 'facelessPrior'].flatMap((boss) =>
      [150, 151, 155, 158, 160, 165, 170].map((hp) =>
        phaseShiftText(boss as 'ossuaryWarden' | 'facelessPrior', hp),
      ),
    );

    expect(replayed).toEqual(TIER_ONE_PHASE_SHIFTS);
  });
});
