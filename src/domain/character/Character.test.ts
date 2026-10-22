import { Character, InvalidXpError } from './Character';

describe('Character', () => {
  it('starts with no experience and no retained experience', () => {
    expect(Character.NEW).toEqual(new Character(0, 0));
    expect(Character.NEW.xp).toBe(0);
    expect(Character.NEW.retainedXp).toBe(0);
  });

  it('keeps its experience and its retained experience', () => {
    const character = new Character(70, 20);

    expect(character.xp).toBe(70);
    expect(character.retainedXp).toBe(20);
  });

  it('has no retained experience unless told so', () => {
    expect(new Character(30).retainedXp).toBe(0);
  });

  it.each([
    [-10, 0],
    [0, -10],
    [-1, 0],
    [0, -1],
    [2.5, 0],
    [0, 2.5],
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
  ])('refuses xp = %p and retainedXp = %p (R16)', (xp, retainedXp) => {
    expect(() => new Character(xp, retainedXp)).toThrow(InvalidXpError);
  });

  it('tells which value is invalid', () => {
    expect(() => new Character(-10, 0)).toThrow('Invalid xp: -10');
    expect(() => new Character(0, -5)).toThrow('Invalid retainedXp: -5');
    expect(new InvalidXpError('xp', -1).name).toBe('InvalidXpError');
  });

  describe('applyXpChange', () => {
    it('gains the experience of a case that becomes « fait » (R1)', () => {
      expect(new Character(30).applyXpChange(20)).toEqual(new Character(50));
    });

    it('loses the experience of a case that goes back from « fait » (R1)', () => {
      expect(new Character(40).applyXpChange(-5)).toEqual(new Character(35));
    });

    it('is unchanged by a change of 0', () => {
      expect(new Character(40, 10).applyXpChange(0)).toEqual(new Character(40, 10));
    });

    it('never goes below 0', () => {
      expect(new Character(0).applyXpChange(-10)).toEqual(new Character(0));
      expect(new Character(10).applyXpChange(-20)).toEqual(new Character(0));
      expect(new Character(10).applyXpChange(-10)).toEqual(new Character(0));
    });

    it('keeps the retained experience', () => {
      expect(new Character(50, 20).applyXpChange(10)).toEqual(new Character(60, 20));
      expect(new Character(50, 20).applyXpChange(-10)).toEqual(new Character(40, 20));
    });

    it('refuses a change that is not a whole number of points', () => {
      expect(() => new Character(50).applyXpChange(2.5)).toThrow(InvalidXpError);
      expect(() => new Character(50).applyXpChange(Number.NaN)).toThrow(InvalidXpError);
    });

    it('leaves the character itself unchanged', () => {
      const character = new Character(30);

      character.applyXpChange(10);

      expect(character.xp).toBe(30);
    });
  });

  describe('retainOnHabitDeletion', () => {
    it('removes the experience removed and adds the experience retained (R18, R19)', () => {
      expect(new Character(40).retainOnHabitDeletion({ removed: 20, retained: 20 })).toEqual(
        new Character(20, 20),
      );
    });

    it('adds to the retained experience already there (R19)', () => {
      expect(new Character(50, 10).retainOnHabitDeletion({ removed: 0, retained: 10 })).toEqual(
        new Character(50, 20),
      );
    });

    it('changes nothing when nothing is removed or retained', () => {
      expect(new Character(10).retainOnHabitDeletion({ removed: 0, retained: 0 })).toEqual(
        new Character(10),
      );
    });

    it('never goes below 0', () => {
      expect(new Character(0).retainOnHabitDeletion({ removed: 20, retained: 0 })).toEqual(
        new Character(0),
      );
      expect(new Character(5, 5).retainOnHabitDeletion({ removed: 10, retained: 5 })).toEqual(
        new Character(0, 10),
      );
    });

    it('leaves the character itself unchanged', () => {
      const character = new Character(40);

      character.retainOnHabitDeletion({ removed: 10, retained: 10 });

      expect(character).toEqual(new Character(40, 0));
    });
  });

  describe('xpChangeTo', () => {
    it('gives the change of experience from this character to the next one', () => {
      expect(new Character(30).xpChangeTo(new Character(40))).toBe(10);
      expect(new Character(40).xpChangeTo(new Character(30))).toBe(-10);
      expect(new Character(0).xpChangeTo(new Character(0))).toBe(0);
    });
  });
});
