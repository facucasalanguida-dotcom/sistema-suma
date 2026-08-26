import { brandColors } from '@/lib/brand';

/**
 * Wordmark de GRUPO SUMA para la interfaz web.
 *
 * Reproduce el logotipo oficial: «GRUPO» girado en vertical, leyéndose de abajo
 * arriba, pegado a una «SUMA» en versales gruesas, y el signo «+» en rojo
 * corporativo alzado a la derecha.
 *
 * El «+» se dibuja como dos barras en lugar de escribirse como carácter: así el
 * grosor y la proporción no dependen de la tipografía que tenga instalada el
 * navegador. La versión del PDF (`src/pdf/logo.tsx`) usa la misma geometría; si
 * se cambia una, hay que cambiar la otra.
 */

interface SumaLogoProps {
  /** Altura de las mayúsculas de «SUMA», en píxeles. El resto escala con ella. */
  size?: number;
  /** Marca oscura, para colocarla sobre fondo claro. */
  onDark?: boolean;
  /** Sólo el signo «+», para espacios reducidos. */
  markOnly?: boolean;
  className?: string;
}

export function SumaLogo({
  size = 22,
  onDark = false,
  markOnly = false,
  className,
}: SumaLogoProps) {
  const wordColor = onDark ? brandColors.canvas : '#FFFFFF';
  const plusSize = size * 0.58;

  if (markOnly) {
    return (
      <span className={className} aria-label="SUMA" role="img">
        <PlusMark size={size} color={brandColors.red} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-start ${className ?? ''}`}
      role="img"
      aria-label="Grupo SUMA"
    >
      <span
        aria-hidden
        style={{
          // `vertical-rl` + media vuelta deja el texto leyéndose de abajo arriba,
          // que es como está en el logotipo original.
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: size * 0.33,
          fontWeight: 700,
          letterSpacing: size * 0.012,
          lineHeight: 1,
          color: wordColor,
          height: size * 1.02,
          marginRight: size * 0.1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        GRUPO
      </span>

      <span
        aria-hidden
        style={{
          fontSize: size * 1.4,
          fontWeight: 800,
          letterSpacing: size * -0.01,
          lineHeight: 0.72,
          color: wordColor,
        }}
      >
        SUMA
      </span>

      <span aria-hidden style={{ marginLeft: size * 0.16, marginTop: size * 0.02 }}>
        <PlusMark size={plusSize} color={brandColors.red} />
      </span>
    </span>
  );
}

/** El signo «+» del logotipo, dibujado con dos barras de canto vivo. */
function PlusMark({ size, color }: { size: number; color: string }) {
  const bar = size * 0.3;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block shrink-0"
      aria-hidden
    >
      <rect x={0} y={center - bar / 2} width={size} height={bar} fill={color} />
      <rect x={center - bar / 2} y={0} width={bar} height={size} fill={color} />
    </svg>
  );
}
