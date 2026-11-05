// Le portrait d'une case de la Frise d'action (#175) : celui du combattant, celui de phase 2 d'un
// boss qui en a un, ou rien (repli sur l'initiale).
import { PHASE_2_PORTRAITS, PORTRAITS } from '../atelier/data/portraits';
import { trackPortrait } from './portraits';

describe('trackPortrait', () => {
  it('gives the portrait of a hero and of an enemy, named after its code name', () => {
    expect(trackPortrait('sentinel', false)).toEqual({
      sprite: 'portrait:sentinel',
      image: PORTRAITS.sentinel,
    });
    expect(trackPortrait('wanderer', false)?.image).toBe(PORTRAITS.wanderer);
    expect(trackPortrait('ghoul', false)).toEqual({
      sprite: 'portrait:ghoul',
      image: PORTRAITS.ghoul,
    });
  });

  it('gives two enemies of the same name the same sprite', () => {
    expect(trackPortrait('ghoul', false)).toEqual(trackPortrait('ghoul', false));
  });

  it.each(['ashGardener', 'hourRinger', 'wishGranter'] as const)(
    'gives %s its phase 2 portrait, under its own sprite name, after the phase shift',
    (kind) => {
      expect(trackPortrait(kind, true)).toEqual({
        sprite: `portrait:${kind}:phase2`,
        image: PHASE_2_PORTRAITS[kind],
      });
      expect(trackPortrait(kind, false)).toEqual({
        sprite: `portrait:${kind}`,
        image: PORTRAITS[kind],
      });
    },
  );

  it.each(['ossuaryWarden', 'facelessPrior'] as const)(
    'keeps the portrait of %s in phase 2, which has no phase 2 aspect',
    (kind) => {
      expect(trackPortrait(kind, true)).toEqual(trackPortrait(kind, false));
    },
  );

  it('gives no portrait to a fighter whose icon is not validated', () => {
    const portraits = { ...PORTRAITS, ghoul: null, sentinel: null };
    expect(trackPortrait('ghoul', false, portraits)).toBeNull();
    expect(trackPortrait('sentinel', false, portraits)).toBeNull();
    expect(trackPortrait('specter', false, portraits)?.image).toBe(PORTRAITS.specter);
  });
});
