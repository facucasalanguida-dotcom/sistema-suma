import { brandColors } from '@/lib/brand';

/**
 * Marca SUMA para la interfaz web.
 *
 * Comparte geometría con la versión del PDF (`src/pdf/logo.tsx`): un cuadrado
 * redondeado con un signo «+» de dos colores —SUMA suma partidas— y el nombre
 * en versales espaciadas sobre un filete naranja.
 */

interface SumaLogoProps {
  size?: number;
  inverted?: boolean;
  markOnly?: boolean;
  className?: string;
}

export function SumaLogo({
  size = 34,
  inverted = false,
  markOnly = false,
  className,
}: SumaLogoProps) {
  const squareColor = inverted ? '#FFFFFF' : brandColors.primary;
  const plusColor = inverted ? brandColors.primary : '#FFFFFF';
  const wordColor = inverted ? '#FFFFFF' : brandColors.primary;

  const bar = size * 0.18;
  const arm = size * 0.52;
  const center = size / 2;

  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="SUMA"
        className="shrink-0"
      >
        <rect width={size} height={size} rx={size * 0.22} fill={squareColor} />
        <rect
          x={center - arm / 2}
          y={center - bar / 2}
          width={arm}
          height={bar}
          rx={bar / 2}
          fill={plusColor}
        />
        <rect
          x={center - bar / 2}
          y={center - arm / 2}
          width={bar}
          height={arm}
          rx={bar / 2}
          fill={brandColors.accent}
        />
      </svg>

      {!markOnly && (
        <span className="ml-2.5 flex flex-col" aria-hidden>
          <span
            className="font-bold leading-none"
            style={{
              fontSize: size * 0.58,
              letterSpacing: size * 0.085,
              color: wordColor,
            }}
          >
            SUMA
          </span>
          <span
            className="mt-1 block"
            style={{ height: 2, width: size * 1.75, backgroundColor: brandColors.accent }}
          />
        </span>
      )}
    </span>
  );
}
