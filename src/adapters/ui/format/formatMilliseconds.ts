/** L'espace fine insécable qui groupe les milliers : « 1 234 ms ». */
const THOUSANDS_SEPARATOR = ' ';

/** Le signe moins typographique : « −2 ms ». */
const MINUS = '−';

/** Une durée ou un écart au dixième de milliseconde, à la française : « 10,5 ms », « −2 ms ». */
export function formatMilliseconds(value: number): string {
  const tenths = Math.round(Math.abs(value) * 10);
  const units = String(Math.floor(tenths / 10)).replace(/\B(?=(\d{3})+$)/g, THOUSANDS_SEPARATOR);
  const decimal = tenths % 10 === 0 ? '' : `,${tenths % 10}`;
  const sign = value < 0 && tenths > 0 ? MINUS : '';
  return `${sign}${units}${decimal} ms`;
}
