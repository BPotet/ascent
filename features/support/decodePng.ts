/**
 * Décodeur PNG des scénarios de l'icône de l'application (#166), indépendant de l'encodeur du
 * script (`scripts/app-icon/generate.mjs`) : il vérifie la signature et le CRC de chaque chunk,
 * n'accepte que le RGBA 8 bits non entrelacé et défait les cinq filtres de rangée du format.
 */
import { inflateSync } from 'node:zlib';

export type DecodedPng = { width: number; height: number; data: Uint8Array };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const BYTES_PER_PIXEL = 4;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

/** Le prédicteur des cinq filtres de rangée : aucun, gauche, haut, moyenne, Paeth. */
function predict(filter: number | undefined, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4:
      return paeth(left, up, upLeft);
    default:
      throw new Error(`filtre de rangée inconnu : ${filter}`);
  }
}

export function decodePng(file: Buffer): DecodedPng {
  if (!SIGNATURE.every((byte, i) => file[i] === byte)) throw new Error('signature PNG absente');
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  let offset = SIGNATURE.length;
  for (;;) {
    const length = file.readUInt32BE(offset);
    const typeAndData = file.subarray(offset + 4, offset + 8 + length);
    if (file.readUInt32BE(offset + 8 + length) !== crc(typeAndData)) throw new Error('CRC faux');
    const type = typeAndData.subarray(0, 4).toString('latin1');
    const data = typeAndData.subarray(4);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colourType, , , interlace] = data.subarray(8);
      if (depth !== 8 || colourType !== 6 || interlace !== 0) {
        throw new Error('PNG RGBA 8 bits non entrelacé attendu');
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * BYTES_PER_PIXEL;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= BYTES_PER_PIXEL ? pixels[line + x - BYTES_PER_PIXEL]! : 0;
      const up = y > 0 ? pixels[line - stride + x]! : 0;
      const upLeft =
        x >= BYTES_PER_PIXEL && y > 0 ? pixels[line - stride + x - BYTES_PER_PIXEL]! : 0;
      pixels[line + x] = (value + predict(filter, left, up, upLeft)) & 0xff;
    }
  }
  return { width, height, data: pixels };
}
