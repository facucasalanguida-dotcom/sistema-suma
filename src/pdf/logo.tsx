import { G, Rect, Svg, Text, View } from '@react-pdf/renderer';
import { brandColors } from '@/lib/brand';

/**
 * Marca SUMA para el PDF, dibujada con primitivas vectoriales.
 *
 * Se dibuja en lugar de incrustar un mapa de bits para que el logotipo salga
 * nítido a cualquier tamaño y para que el sistema no dependa de ningún archivo
 * binario. La geometría es idéntica a la del logotipo web
 * (`src/components/brand/SumaLogo.tsx`): si se sustituye uno, hay que sustituir
 * el otro.
 */

interface LogoProps {
  /** Alto del isotipo en puntos. El resto de la marca escala con él. */
  size?: number;
  /** Marca clara para fondos oscuros. */
  inverted?: boolean;
  /** Oculta el texto y deja sólo el isotipo. */
  markOnly?: boolean;
}

export function SumaPdfLogo({ size = 34, inverted = false, markOnly = false }: LogoProps) {
  const squareColor = inverted ? '#FFFFFF' : brandColors.primary;
  const plusColor = inverted ? brandColors.primary : '#FFFFFF';
  const wordColor = inverted ? '#FFFFFF' : brandColors.primary;
  const accent = brandColors.accent;

  const bar = size * 0.18;
  const arm = size * 0.52;
  const center = size / 2;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          <Rect x={0} y={0} width={size} height={size} rx={size * 0.22} fill={squareColor} />
          {/* El signo «+» del nombre: SUMA suma partidas. */}
          <Rect
            x={center - arm / 2}
            y={center - bar / 2}
            width={arm}
            height={bar}
            rx={bar / 2}
            fill={plusColor}
          />
          <Rect
            x={center - bar / 2}
            y={center - arm / 2}
            width={bar}
            height={arm}
            rx={bar / 2}
            fill={accent}
          />
        </G>
      </Svg>

      {!markOnly && (
        <View style={{ marginLeft: size * 0.3 }}>
          <Text
            style={{
              fontFamily: 'Helvetica-Bold',
              fontSize: size * 0.62,
              letterSpacing: size * 0.09,
              color: wordColor,
              lineHeight: 1,
            }}
          >
            SUMA
          </Text>
          <View
            style={{
              height: 2,
              width: size * 1.9,
              backgroundColor: accent,
              marginTop: size * 0.11,
            }}
          />
        </View>
      )}
    </View>
  );
}

/** Filigrana diagonal para los presupuestos con precios estimados. */
export function DraftWatermark({ label }: { label: string }) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: 320,
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity: 0.06,
      }}
    >
      <Text
        style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: 62,
          color: brandColors.primary,
          transform: 'rotate(-24deg)',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Filete corporativo: un tramo naranja corto sobre una fina línea completa. */
export function BrandRule({ width = 515 }: { width?: number }) {
  return (
    <View style={{ width, marginTop: 10 }}>
      <View style={{ height: 2.5, width: 54, backgroundColor: brandColors.accent }} />
      <View style={{ height: 0.75, width, backgroundColor: brandColors.border, marginTop: 1 }} />
    </View>
  );
}
