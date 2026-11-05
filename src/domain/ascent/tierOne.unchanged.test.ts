// Le palier 1 ne change pas (#38, risque 1 des notes de l'Architect) : pour 200 graines, les
// groupes, leurs tailles, les Élites, les boss, l'Or, le butin, les intentions tirées (dégâts
// compris), les PV et la garde des ennemis, et le changement de phase à 150 PV des boss du
// palier 1 sont ceux de `develop` à `582cc236`, figés avant les paliers 2 et 3. Seul second
// changement voulu : les durées de préparation ×0,9 à ×1,1 (#211), régénérées seules.
import { TIER_ONE_PHASE_SHIFTS, TIER_ONE_WALKS } from './testing/tierOneDraws';
import { WALKED_SEEDS, phaseShiftText, walkTierOne } from './testing/tierOneWalk';

describe('Tier 1 unchanged (#38)', () => {
  it('replays the same 200 ascents of tier 1, draw for draw', () => {
    expect(TIER_ONE_WALKS).toHaveLength(WALKED_SEEDS);
    TIER_ONE_WALKS.forEach((walk, index) => {
      expect(walkTierOne(index + 1)).toBe(walk);
    });
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
