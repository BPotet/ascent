import { enemiesText, exitLabel, floorLine, goldText } from './ascentText';

describe('ascent texts', () => {
  it('names the floor out of 6, the Gold and the number of enemies', () => {
    expect(floorLine(3)).toBe('Palier 1 · Étage 3 sur 6');
    expect(goldText(12)).toBe('12 Or');
    expect(enemiesText(1)).toBe('1 ennemi');
    expect(enemiesText(4)).toBe('4 ennemis');
  });

  it('announces the group size on a Combat door, not its composition', () => {
    expect(exitLabel({ kind: 'combat', groupSize: 4 })).toBe('Combat · 4 ennemis');
    expect(exitLabel({ kind: 'elite', groupSize: null })).toBe('Élite · le Chevalier déchu');
    expect(exitLabel({ kind: 'campfire', groupSize: null })).toBe(
      'Feu de camp · soin de 40 % des PV',
    );
    expect(exitLabel({ kind: 'boss', groupSize: null })).toBe('Affronter le boss');
  });
});
