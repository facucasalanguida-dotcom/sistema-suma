/**
 * Saneado de texto para el PDF.
 *
 * El documento usa las tipografías estándar del formato PDF (Helvetica), que
 * sólo codifican el juego WinAnsi (CP1252). Un carácter fuera de ese juego —una
 * lambda en una ficha técnica, una flecha, un cuadradito de viñeta— no da error:
 * sale otro glifo cualquiera y el presupuesto queda con una errata delante del
 * cliente. Como buena parte del texto viene de la IA o del proveedor, no se
 * puede confiar en que sea seguro, así que se sanea todo lo que entra.
 *
 * Si en el futuro se registra una tipografía corporativa TrueType con
 * `Font.register`, esta capa deja de ser necesaria para los caracteres que esa
 * fuente cubra, pero seguir aplicándola no hace daño.
 */

/** Caracteres del tramo 0x80–0x9F de CP1252, que no están en Latin-1. */
const CP1252_EXTRAS = [
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
];

const ALLOWED = new Set<number>([0x09, 0x0a, 0x0d, ...CP1252_EXTRAS]);
for (let code = 0x20; code <= 0x7e; code += 1) ALLOWED.add(code);
for (let code = 0xa0; code <= 0xff; code += 1) ALLOWED.add(code);

/** Sustituciones legibles para los símbolos técnicos más habituales. */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/[λ]/g, 'lambda'],
  [/[Ω]/g, 'ohm'],
  [/[μ]/g, 'µ'], // mu griega -> signo micro de Latin-1
  [/[Δ]/g, 'delta'],
  [/[Σ]/g, 'suma'],
  [/[π]/g, 'pi'],
  [/[σ]/g, 'sigma'],
  [/[ρ]/g, 'rho'],
  [/[≈]/g, '~'],
  [/[≤]/g, '<='],
  [/[≥]/g, '>='],
  [/[≠]/g, '!='],
  [/[∅]/g, 'Ø'],
  [/[→⇒]/g, '->'],
  [/[←⇐]/g, '<-'],
  [/[↔]/g, '<->'],
  [/[▪▫■□●○◦‣⁃]/g, '•'],
  [/[✓✔]/g, 'OK'],
  [/[✕✖✗✘]/g, 'x'],
  [/[㎡]/g, 'm²'],
  [/[㎥]/g, 'm³'],
  [/[′]/g, "'"],
  [/[″]/g, '"'],
  [/[‑‒]/g, '-'],
  [/ /g, ' '],
  // Espacios especiales -> espacio normal.
  [/[\u00a0\u2007\u202f\u2009]/g, ' '],
  // Letras con trazo: no se descomponen en NFD, hay que mapearlas a mano.
  [/\u0141/g, 'L'],
  [/\u0142/g, 'l'],
  [/\u0110/g, 'D'],
  [/\u0111/g, 'd'],
  [/\u0126/g, 'H'],
  [/\u0127/g, 'h'],
  [/\u0166/g, 'T'],
  [/\u0167/g, 't'],
];

/**
 * Devuelve una versión del texto que Helvetica puede representar íntegramente.
 * Los caracteres desconocidos se transliteran quitándoles los diacríticos y,
 * si aun así no encajan, se eliminan en lugar de mostrar un glifo erróneo.
 */
export function pdfText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';

  let text = String(value);
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  let output = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (ALLOWED.has(code)) {
      output += char;
      continue;
    }

    const transliterated = char
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    for (const fallbackChar of transliterated) {
      const fallbackCode = fallbackChar.codePointAt(0) ?? 0;
      if (ALLOWED.has(fallbackCode)) output += fallbackChar;
    }
  }

  return output;
}
