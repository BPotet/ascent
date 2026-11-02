// Réservé aux tests : le contraste WCAG 2.1 d'un texte, et la teinte d'un fond de palier sous le
// voile de lisibilité (#176).
import { artPalette } from '../pixelArt/artPalette';
import { rgbOf } from '../pixelArt/sprites/Sprite';

/** La couleur et l'opacité du voile de lisibilité, lues dans `roles.backdropVeil` (`rgba(…)`). */
const [VEIL_R, VEIL_G, VEIL_B, VEIL_OPACITY] = artPalette.roles.backdropVeil
  .slice('rgba('.length, -1)
  .split(',')
  .map(Number) as [number, number, number, number];
const VEIL = [VEIL_R, VEIL_G, VEIL_B] as const;

/** La luminance relative d'une couleur `#RRGGBB` (WCAG 2.1). */
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le rapport de contraste de deux couleurs `#RRGGBB` (WCAG 2.1). */
export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** La teinte `#RRGGBB` d'un pixel du fond sous le voile de lisibilité (la nuit à 90 %). */
export function underVeil(tint: string): string {
  const mixed = rgbOf(tint).map((channel, index) =>
    Math.round(VEIL[index as 0 | 1 | 2] * VEIL_OPACITY + channel * (1 - VEIL_OPACITY)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
