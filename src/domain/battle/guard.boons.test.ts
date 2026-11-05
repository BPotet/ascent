// Le retour en garde avec Givre persistant (prototype #92).
import { restoreGuard } from './guard';

const stun = { actionLost: true, heroAction: 1 };

describe('restoreGuard with a percentage (Givre persistant)', () => {
  it('brings the guard back to its maximum by default', () => {
    expect(restoreGuard({ hp: 30, guard: 0, maxGuard: 15, stun })).toEqual({
      hp: 30,
      guard: 15,
      maxGuard: 15,
      stun: null,
    });
  });

  it('brings back half of the guard, rounded down, at least 1', () => {
    expect(restoreGuard({ hp: 30, guard: 0, maxGuard: 15, stun }, 50).guard).toBe(7);
    expect(restoreGuard({ hp: 30, guard: 0, maxGuard: 1, stun }, 50).guard).toBe(1);
  });
});
