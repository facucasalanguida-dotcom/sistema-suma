import { Rect, Svg, Text, View } from '@react-pdf/renderer';
import { brandColors, printColors } from '@/lib/brand';

/**
 * Wordmark de GRUPO SUMA para el PDF.
 *
 * Misma geometría que la versión web (`src/components/brand/SumaLogo.tsx`):
 * «GRUPO» girado en vertical, «SUMA» en versales gruesas y el «+» en rojo.
 *
 * El giro de «GRUPO» se resuelve con una caja de tamaño fijo y el texto
 * centrado dentro girado un cuarto de vuelta: react-pdf gira alrededor del
 * centro del elemento, así que basta con que la caja interior tenga las
 * medidas intercambiadas respecto a la exterior.
 */

interface LogoProps {
  /** Altura de las mayúsculas de «SUMA», en puntos. */
  size?: number;
  /** Marca oscura, para el cuerpo blanco del documento. */
  onLight?: boolean;
  /** Sólo el signo «+». */
  markOnly?: boolean;
}

export function SumaPdfLogo({ size = 20, onLight = false, markOnly = false }: LogoProps) {
  const wordColor = onLight ? printColors.band : '#FFFFFF';
  const red = onLight ? printColors.red : brandColors.red;

  if (markOnly) return <PlusMark size={size} color={red} />;

  const grupoFontSize = size * 0.33;
  const grupoBoxWidth = grupoFontSize * 1.05;
  const grupoBoxHeight = size * 1.02;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View
        style={{
          width: grupoBoxWidth,
          height: grupoBoxHeight,
          position: 'relative',
          marginRight: size * 0.1,
        }}
      >
        <Text
          style={{
            position: 'absolute',
            width: grupoBoxHeight,
            height: grupoBoxWidth,
            left: (grupoBoxWidth - grupoBoxHeight) / 2,
            top: (grupoBoxHeight - grupoBoxWidth) / 2,
            transform: 'rotate(-90deg)',
            textAlign: 'center',
            fontFamily: 'Helvetica-Bold',
            fontSize: grupoFontSize,
            letterSpacing: size * 0.012,
            lineHeight: 1,
            color: wordColor,
          }}
        >
          GRUPO
        </Text>
      </View>

      <Text
        style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: size * 1.4,
          letterSpacing: size * -0.01,
          lineHeight: 1,
          marginTop: -size * 0.28,
          color: wordColor,
        }}
      >
        SUMA
      </Text>

      <View style={{ marginLeft: size * 0.16, marginTop: size * 0.02 }}>
        <PlusMark size={size * 0.58} color={red} />
      </View>
    </View>
  );
}

/** El signo «+» del logotipo, dibujado con dos barras de canto vivo. */
function PlusMark({ size, color }: { size: number; color: string }) {
  const bar = size * 0.3;
  const center = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={center - bar / 2} width={size} height={bar} fill={color} />
      <Rect x={center - bar / 2} y={0} width={bar} height={size} fill={color} />
    </Svg>
  );
}
