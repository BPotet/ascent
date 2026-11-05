// #188 : l'ombre d'une case de la Frise d'action, en phase du héros et en phase ennemie (maquette
// v2 de #174, `.frise.dimf`) : la luminosité par un voile d'encre (1 − luminosité), la saturation du
// portrait.
import { trackShade } from './trackShade';

describe('trackShade (the shade of an entry of the action track)', () => {
  it('keeps the one who acts in full light, in both phases', () => {
    expect(trackShade('current', true, false)).toEqual({ veil: 0, saturation: 1 });
    expect(trackShade('current', true, true)).toEqual({ veil: 0, saturation: 1 });
  });

  it('keeps the other entries of the round in full light in the hero phase', () => {
    expect(trackShade('current', false, false)).toEqual({ veil: 0, saturation: 1 });
  });

  it('dims the other entries of the round to 45 % brightness and 60 % saturation in the enemy phase', () => {
    expect(trackShade('current', false, true)).toEqual({ veil: 0.55, saturation: 0.6 });
  });

  it('keeps the preview at 62 % brightness and 70 % saturation in the hero phase', () => {
    expect(trackShade('next', false, false)).toEqual({ veil: 0.38, saturation: 0.7 });
  });

  it('dims the preview to 32 % brightness and 50 % saturation in the enemy phase', () => {
    expect(trackShade('next', false, true)).toEqual({ veil: 0.68, saturation: 0.5 });
  });

  it('never treats an entry of the preview as the one who acts', () => {
    expect(trackShade('next', true, true)).toEqual({ veil: 0.68, saturation: 0.5 });
    expect(trackShade('next', true, false)).toEqual({ veil: 0.38, saturation: 0.7 });
  });
});
