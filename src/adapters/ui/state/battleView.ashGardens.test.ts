// Ce que l'écran montre de la Cosse de braise et de la Phalène voleuse (#267, maquette 246, J1, J5,
// J6, J8) : leurs marques de signature lues dans le domaine, la ligne du pouce de la Cosse, et la
// touche du pouvoir à qui la Phalène a volé l'Élan.
import { startBattle, type Battle, type EnemyState } from '../../../domain/battle/Battle';
import { battleView } from './battleView';

const STUN = { heroAction: 1, actionLost: false };

/** La Phalène voleuse (place 0), la Ronce de cendre et la Cosse de braise (place 2), ciblée. */
function gardens(pod: Partial<EnemyState> = {}, battle: Partial<Battle> = {}): Battle {
  const { battle: started } = startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies: ['thievingMoth', 'ashBramble', 'emberPod'],
  });
  return {
    ...started,
    target: 2,
    ...battle,
    enemies: started.enemies.map((enemy, index) => (index === 2 ? { ...enemy, ...pod } : enemy)),
  };
}

const signatureOf = (battle: Battle, index: number) => battleView(battle).enemies[index]!.signature;

describe('the signature mark of the Ember pod (#267, J6, J8)', () => {
  it('says « Braises 2 » in ember on a standing pod', () => {
    expect(signatureOf(gardens(), 2)).toEqual({
      variant: 'emberBurst',
      glyph: 'ember8',
      text: 'Braises 2',
      speech: 'à sa mort, 2 charges de Brûlure, sauf si elle est étourdie',
      off: false,
      now: false,
    });
  });

  it('greys it while she is stunned, and lights it again at her guard restore', () => {
    expect(signatureOf(gardens({ stun: STUN, guard: 0 }), 2)).toMatchObject({
      text: 'Braises 2',
      off: true,
      speech: 'étourdie : pas de Brûlure à sa mort',
    });
    expect(signatureOf(gardens({ stun: null }), 2)).toMatchObject({ off: false });
  });

  it('reads her column as an ordinary enemy, with her mark said with the plate', () => {
    const view = battleView(gardens()).enemies[2]!;

    expect(view.label).toBe(
      'Cosse de braise, cible, 34 PV sur 34, garde 18 sur 18, à sa mort, 2 charges de Brûlure, sauf si elle est étourdie, intention : attaque',
    );
    expect(view).not.toHaveProperty('elite');
  });

  it('writes the price on the thumb line when she is the target (J6)', () => {
    expect(battleView(gardens()).line).toEqual({
      before: 'Cible : ',
      strong: 'Cosse de braise',
      after: ' · Braises : Brûlure ×2 à sa mort',
    });
  });

  it('writes no price once she is stunned', () => {
    expect(battleView(gardens({ stun: STUN, guard: 0 })).line).toEqual({
      before: 'Cible : ',
      strong: 'Cosse de braise',
      after: ' · ×1,5',
    });
  });
});

describe('the signature mark of the Thieving moth (#267, J1)', () => {
  it('says « Vole l’Élan » with the gold diamond of the momentum, never greyed', () => {
    expect(signatureOf(gardens(), 0)).toEqual({
      variant: 'momentumTheft',
      glyph: 'diamond8',
      text: "Vole l'Élan",
      speech:
        'vole 1 Élan à chaque impact qui te touche, bonne parade comprise ; parade parfaite ou esquive : rien n’est volé',
      off: false,
      now: false,
    });
    expect(signatureOf(gardens(), 1)).toBeUndefined();
  });
});

describe('the theft is felt in the hero phase (#267, J5)', () => {
  it('greys the Bulwark key short of 1 momentum when the moth stole it', () => {
    const robbed = gardens();
    const view = battleView({ ...robbed, hero: { ...robbed.hero, momentum: 0 } });

    expect(view.pad).toMatchObject({
      kind: 'hero',
      powers: [expect.objectContaining({ power: 'bulwark', availability: 'missing', missing: 1 })],
    });
  });
});
