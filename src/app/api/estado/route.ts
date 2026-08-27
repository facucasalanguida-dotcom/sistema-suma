import { NextResponse } from 'next/server';
import {
  UTILITY_MODEL,
  callGemini,
  classifyGeminiFailure,
  createBudget,
  isGeminiConfigured,
} from '@/lib/gemini/client';
import { isCseConfigured, searchProductPages } from '@/lib/search/google-cse';
import { issuerIsPlaceholder } from '@/lib/brand';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * Panel de diagnóstico: GET /api/estado
 *
 * Existe porque «no funciona» no es un diagnóstico. Esta ruta prueba de
 * verdad cada pieza —hace una llamada mínima a Gemini y una consulta mínima
 * al buscador programático— y cuenta el resultado en español llano, con el
 * error original de Google incluido cuando lo hay. Así se distingue en diez
 * segundos una clave inválida de una clave en capa gratuita, que se
 * confunden constantemente durante la puesta en marcha.
 *
 * Queda detrás de la misma contraseña que el resto de la aplicación (el
 * proxy cubre /api/*), y cada visita gasta una llamada pequeña de Gemini y
 * una consulta del buscador: no es para refrescar en bucle.
 */
export async function GET() {
  const [gemini, busqueda] = await Promise.all([checkGemini(), checkCse()]);

  return NextResponse.json(
    {
      gemini,
      busquedaProgramatica: busqueda,
      datosDelEmisor: issuerIsPlaceholder
        ? {
            estado: 'pendiente',
            detalle:
              'Los datos fiscales siguen siendo los de ejemplo: los PDF salen marcados como documento de prueba. Se rellenan con las variables NEXT_PUBLIC_SUMA_*.',
          }
        : { estado: 'ok', detalle: 'Datos fiscales del emisor configurados.' },
      comprobadoEl: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function checkGemini() {
  if (!isGeminiConfigured()) {
    return {
      estado: 'sin-configurar',
      detalle:
        'No hay GEMINI_API_KEY en el entorno. El sistema funciona en modo demostración con el catálogo local. Las claves reales empiezan por "AIza" y se crean en aistudio.google.com/apikey eligiendo un proyecto con facturación.',
    };
  }

  const budget = createBudget(20_000);
  try {
    const response = await callGemini(
      {
        model: UTILITY_MODEL,
        contents: 'Responde únicamente: OK',
        config: { temperature: 0, maxOutputTokens: 5 },
      },
      budget,
      'La comprobación de Gemini',
    );

    return {
      estado: 'ok',
      detalle: `La clave responde con el modelo ${UTILITY_MODEL}. Todo listo.`,
      respuesta: response.text?.trim() ?? '',
    };
  } catch (error) {
    const failure = classifyGeminiFailure(error);
    const original = error instanceof Error ? error.message : String(error);

    const detalle =
      failure === 'rate'
        ? 'La clave es válida pero se ha topado con el límite de peticiones. Si acaba de pasar a la capa de pago, espera unos minutos; si la clave sale como «Gratuito» en aistudio.google.com/apikey, crea una nueva eligiendo el proyecto que tiene la facturación.'
        : failure === 'transient'
          ? 'El servicio de Gemini está saturado en este momento. Suele resolverse solo en segundos.'
          : 'La clave no es válida o no tiene permiso. Crea una en aistudio.google.com/apikey (empieza por "AIza") y ponla en GEMINI_API_KEY.';

    return {
      estado:
        failure === 'rate' ? 'cuota' : failure === 'transient' ? 'saturado' : 'clave-invalida',
      detalle,
      errorOriginal: original,
    };
  } finally {
    budget.release();
  }
}

async function checkCse() {
  if (!isCseConfigured()) {
    return {
      estado: 'sin-configurar',
      detalle:
        'Faltan GOOGLE_CSE_API_KEY o GOOGLE_CSE_ID. Esta capa es opcional: sin ella el sistema funciona, pero con ella aparecen más fichas de producto y aguanta mejor los fallos de cuota de Gemini.',
    };
  }

  try {
    const results = await searchProductPages(['cemento cola saco 25 kg precio']);
    if (results.length > 0) {
      return {
        estado: 'ok',
        detalle: `El buscador programático responde: ${results.length} fichas de tiendas en una consulta de prueba.`,
        ejemplo: results[0].url,
      };
    }
    return {
      estado: 'sin-resultados',
      detalle:
        'El buscador responde pero no devuelve fichas de tiendas. Revisa que el buscador programable incluya los sitios de las tiendas (*.obramat.es, *.leroymerlin.es…) o que la clave tenga la Custom Search API permitida.',
    };
  } catch {
    return {
      estado: 'error',
      detalle:
        'El buscador programático no responde. Revisa la clave y el ID en las variables de entorno.',
    };
  }
}
