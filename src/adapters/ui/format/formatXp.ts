/** L'espace fine insécable qui groupe les milliers, comme le français l'écrit : « 1 510 XP ». */
const THOUSANDS_SEPARATOR = ' ';

/** Le signe moins typographique d'une perte : « −10 XP ». */
const MINUS = '−';

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+$)/g, THOUSANDS_SEPARATOR);
}

/** L'expérience du personnage telle que l'en-tête l'affiche : « 40 XP » (R24). */
export function formatXp(xp: number): string {
  return `${groupThousands(xp)} XP`;
}

function signed(xpChange: number): string {
  return `${xpChange > 0 ? '+' : MINUS}${groupThousands(Math.abs(xpChange))}`;
}

/** Une variation d'expérience : « +10 XP » pour un gain, « −10 XP » pour une perte. */
export function formatXpChange(xpChange: number): string {
  return `${signed(xpChange)} XP`;
}

/**
 * Ce que le lecteur d'écran annonce après un changement d'expérience (maquette, « Lecteur
 * d'écran ») : « +10 points d'expérience. Total : 40 XP. », précédé de « Correction enregistrée, »
 * pour une correction qui pose la marque « corrigé ».
 */
export function xpAnnouncement({
  xpChange,
  xp,
  correction,
}: {
  readonly xpChange: number;
  readonly xp: number;
  readonly correction: boolean;
}): string {
  const change = `${signed(xpChange)} points d’expérience. Total : ${formatXp(xp)}.`;
  return correction ? `Correction enregistrée, ${change}` : change;
}
