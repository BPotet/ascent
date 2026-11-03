// Le fond de l'annonce de l'Invocation (#172, maquette 170, `.announce`) : une bande sombre qui
// s'efface sur les bords, opaque de 14 % à 86 % de la largeur.
import { SUMMON_BAND_POSITIONS, summonBandGradient } from './summonBand';

describe('the band of the summon banner (#172)', () => {
  it('fades from the edges to the band, full from 14 % to 86 %', () => {
    expect(SUMMON_BAND_POSITIONS).toEqual([0, 0.14, 0.86, 1]);
  });

  it('runs across the width, transparent on both edges', () => {
    expect(summonBandGradient(390, '#100E14F0')).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 390, y: 0 },
      colors: ['#100E1400', '#100E14F0', '#100E14F0', '#100E1400'],
      positions: [0, 0.14, 0.86, 1],
    });
  });
});
