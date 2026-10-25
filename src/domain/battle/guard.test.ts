// Garde et étourdissement (#32, règles C5) : cassure, ennemi étourdi, retour en garde.
import {
  GUARD_RESTORE_MS,
  LOST_ACTION_MS,
  STUNNED_DAMAGE_PERCENT,
  blowOnEnemy,
  isRestoreDue,
  restoreGuard,
  stunnedPercent,
} from './guard';

const ghoul = { hp: 50, guard: 15, maxGuard: 15, stun: null };

describe('guard and stun (C5)', () => {
  it('lasts 250 ms for a lost action and 400 ms for a guard restore', () => {
    expect([LOST_ACTION_MS, GUARD_RESTORE_MS]).toEqual([250, 400]);
  });

  it('multiplies the damage to a stunned enemy by 1.5 (C5.2)', () => {
    expect(STUNNED_DAMAGE_PERCENT).toBe(150);
    expect(stunnedPercent(null)).toBe(100);
    expect(stunnedPercent({ actionLost: false, heroAction: 1 })).toBe(150);
  });

  describe('blowOnEnemy', () => {
    it('removes the HP and the guard points of the blow', () => {
      expect(blowOnEnemy(ghoul, { hp: 10, guard: 12 }, 1)).toEqual({
        enemy: { ...ghoul, hp: 40, guard: 3 },
        broken: false,
        fallen: false,
      });
    });

    it('breaks the guard at 0: the enemy is stunned, its action still to lose (C5.1)', () => {
      expect(blowOnEnemy({ ...ghoul, guard: 8 }, { hp: 10, guard: 12 }, 3)).toEqual({
        enemy: { ...ghoul, hp: 40, guard: 0, stun: { actionLost: false, heroAction: 3 } },
        broken: true,
        fallen: false,
      });
    });

    it('breaks the guard when it falls exactly to 0', () => {
      expect(blowOnEnemy({ ...ghoul, guard: 12 }, { hp: 10, guard: 12 }, 1).broken).toBe(true);
    });

    it('never breaks a stunned enemy again, nor removes its guard (C5.8)', () => {
      const stunned = { ...ghoul, guard: 0, stun: { actionLost: true, heroAction: 2 } };

      expect(blowOnEnemy(stunned, { hp: 15, guard: 12 }, 3)).toEqual({
        enemy: { ...stunned, hp: 35 },
        broken: false,
        fallen: false,
      });
    });

    it('fells an enemy at 0 HP, ends its stun and never breaks it (C5.9)', () => {
      const stunned = { ...ghoul, hp: 10, guard: 0, stun: { actionLost: true, heroAction: 2 } };
      expect(blowOnEnemy(stunned, { hp: 15, guard: 0 }, 3)).toEqual({
        enemy: { ...stunned, hp: 0, stun: null },
        broken: false,
        fallen: true,
      });

      const standing = { ...ghoul, hp: 5, guard: 4 };
      expect(blowOnEnemy(standing, { hp: 10, guard: 12 }, 1)).toEqual({
        enemy: { ...standing, hp: 0, guard: 0 },
        broken: false,
        fallen: true,
      });
    });
  });

  describe('isRestoreDue (C5.3)', () => {
    it('waits for the next hero action, not the one of the guard break', () => {
      const stun = { actionLost: false, heroAction: 3 };
      expect(isRestoreDue(stun, 3)).toBe(false);
      expect(isRestoreDue(stun, 4)).toBe(true);
    });
  });

  it('restores the guard to its maximum and ends the stun (C5.5)', () => {
    expect(
      restoreGuard({ ...ghoul, hp: 20, guard: 0, stun: { actionLost: true, heroAction: 1 } }),
    ).toEqual({ ...ghoul, hp: 20 });
  });
});
