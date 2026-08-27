import { GoogleGenAI } from '@google/genai';

/**
 * Cliente compartido de Gemini.
 *
 * La clave se lee de `GEMINI_API_KEY` (o `GOOGLE_API_KEY`). Si no hay clave el
 * sistema no falla: entra en *modo demostración* y responde con el catálogo
 * local de proveedores de Málaga, señalizándolo claramente en la interfaz.
 */

let client: GoogleGenAI | null = null;

/**
 * La clave se pasa siempre explícitamente al SDK en lugar de dejar que la lea
 * del entorno: el SDK da prioridad a `GOOGLE_API_KEY`, que en muchos proyectos
 * ya está ocupada por otro servicio de Google, y elegir aquí el orden evita esa
 * confusión.
 */
export function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

export function isGeminiConfigured(): boolean {
  return getApiKey() !== null;
}

export function getGemini(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY. Copia .env.example a .env.local y añade tu clave de Google AI Studio.',
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Modelos.
 *
 * `gemini-3.6-flash` es el sucesor que Google señala para `gemini-2.5-flash`,
 * cuyo apagado está anunciado para octubre de 2026: dejarlo como valor por
 * defecto evitaría que el sistema se quedase sin servicio de un día para otro.
 * Los tres se pueden cambiar por entorno sin tocar código —por ejemplo a
 * `gemini-flash-latest`, que sigue siempre al modelo flash vigente, o a un
 * `gemini-3.x-pro` si se prefiere calidad sobre coste en la búsqueda.
 */

/** Modelo multimodal para interpretar texto e imágenes del usuario. */
export const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

/** Modelo para la búsqueda de proveedores con anclaje en Google Search. */
export const SEARCH_MODEL = process.env.GEMINI_SEARCH_MODEL || 'gemini-3.6-flash';

/** Modelo para tareas cortas de estructuración y parseo. */
export const UTILITY_MODEL = process.env.GEMINI_UTILITY_MODEL || 'gemini-3.6-flash';

/**
 * Presupuesto de tiempo para TODA una petición, no para cada llamada.
 *
 * Una búsqueda de proveedores encadena dos llamadas al modelo, así que un
 * límite por llamada no acota nada: dos de 45 s suman 90 s. En un entorno sin
 * servidor eso significa que la plataforma corta la función antes de que la
 * aplicación pueda responder, y el usuario ve un error genérico de pasarela en
 * lugar de un mensaje que le sirva. Con un presupuesto compartido, la última
 * llamada sabe cuánto tiempo le queda y se rinde a tiempo de contarlo.
 *
 * El valor por defecto deja margen bajo el límite de 60 s de una función de
 * Vercel en el plan gratuito.
 */
export const REQUEST_BUDGET_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45_000);

export interface RequestBudget {
  /** Se aborta cuando se agota el presupuesto; se pasa al SDK. */
  signal: AbortSignal;
  /** Milisegundos que quedan. */
  remaining: () => number;
  /** Libera el temporizador. Llamar siempre, en un `finally`. */
  release: () => void;
}

/** Crea el presupuesto de tiempo compartido por todas las llamadas de una petición. */
export function createBudget(totalMs = REQUEST_BUDGET_MS): RequestBudget {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), totalMs);

  return {
    signal: controller.signal,
    remaining: () => Math.max(0, totalMs - (Date.now() - startedAt)),
    release: () => clearTimeout(timer),
  };
}

/**
 * Extrae el JSON de una respuesta del modelo.
 *
 * Con `responseMimeType: 'application/json'` la respuesta ya es JSON limpio,
 * pero cuando se combina con herramientas (búsqueda) el modelo devuelve texto
 * libre y puede envolver el JSON en un bloque de código. Esta función tolera
 * ambos casos.
 */
export function extractJson(raw: string | undefined): unknown {
  if (!raw) throw new Error('El modelo no devolvió contenido.');

  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Último recurso: quedarse con el primer objeto o array bien formado.
    const start = candidate.search(/[[{]/);
    if (start >= 0) {
      const opener = candidate[start];
      const closer = opener === '[' ? ']' : '}';
      const end = candidate.lastIndexOf(closer);
      if (end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          /* cae al error de abajo */
        }
      }
    }
    throw new Error(`La respuesta del modelo no es JSON válido: ${candidate.slice(0, 200)}`);
  }
}

/**
 * Clasifica un fallo del modelo para decidir si merece reintento.
 *
 *  - `rate`: límite de peticiones (429 / RESOURCE_EXHAUSTED). En la capa
 *    gratuita el cupo por minuto se repone solo: esperar y reintentar una vez
 *    suele bastar.
 *  - `transient`: el servicio sobrecargado o caído un instante (500/503).
 *    Un reintento corto lo resuelve casi siempre.
 *  - `fatal`: clave inválida, permisos, petición malformada… insistir no
 *    arregla nada.
 */
export type GeminiFailure = 'rate' | 'transient' | 'fatal';

export function classifyGeminiFailure(error: unknown): GeminiFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) return 'rate';
  if (/503|UNAVAILABLE|overloaded|502|500|INTERNAL/i.test(message)) return 'transient';
  return 'fatal';
}

/** Espera antes de reintentar, según el tipo de fallo. */
const RETRY_WAIT_MS: Record<Exclude<GeminiFailure, 'fatal'>, number> = {
  rate: 15_000,
  transient: 2_500,
};

/** Margen que debe quedar tras la espera para que el reintento tenga sentido. */
const RETRY_HEADROOM_MS = 10_000;

/**
 * Decide si procede reintentar. Pura y sin reloj, para poder probarla:
 * devuelve los milisegundos a esperar, o `null` si no procede.
 */
export function retryDelay(
  error: unknown,
  attempt: number,
  remainingMs: number,
): number | null {
  if (attempt >= 1) return null;
  const failure = classifyGeminiFailure(error);
  if (failure === 'fatal') return null;
  const wait = RETRY_WAIT_MS[failure];
  return remainingMs >= wait + RETRY_HEADROOM_MS ? wait : null;
}

export interface GeminiCallParams {
  model: string;
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
  config?: Parameters<GoogleGenAI['models']['generateContent']>[0]['config'];
}

/**
 * Llamada única a Gemini con presupuesto de tiempo y un reintento automático.
 *
 * Antes, un 429 de la capa gratuita —cuyo cupo por minuto se repone solo—
 * tiraba toda la búsqueda al primer intento y el usuario veía «espera y
 * vuelve a intentarlo». Si el presupuesto de la petición da para esperar y
 * repetir, se hace aquí y el usuario ni se entera.
 */
export async function callGemini(
  params: GeminiCallParams,
  budget: { signal: AbortSignal; remaining: () => number } | undefined,
  label: string,
) {
  const ai = getGemini();

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withTimeout(
        ai.models.generateContent({
          model: params.model,
          contents: params.contents,
          config: { ...params.config, abortSignal: budget?.signal },
        }),
        budget?.remaining(),
        label,
      );
    } catch (error) {
      const wait = retryDelay(error, attempt, budget?.remaining() ?? Number.MAX_SAFE_INTEGER);
      if (wait === null) throw error;
      console.warn(`[suma] ${label}: ${classifyGeminiFailure(error)}, reintento en ${wait} ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

/** Envuelve una promesa con un tiempo límite legible para el usuario. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = REQUEST_BUDGET_MS,
  label = 'La consulta a la IA',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} ha superado el tiempo máximo de ${ms / 1000} s.`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Convierte un error del SDK en un mensaje comprensible en español. */
export function describeGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/api[_ ]?key/i.test(message)) {
    return 'La clave de Gemini no es válida. Revisa GEMINI_API_KEY en tu archivo .env.local.';
  }
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return (
      'Se ha alcanzado el límite de peticiones de Gemini, incluso tras reintentar. ' +
      'Si pasa a menudo, la clave está en la capa gratuita: activando la facturación ' +
      'del proyecto en Google Cloud el límite se multiplica y esto desaparece.'
    );
  }
  if (/timeout|tiempo máximo/i.test(message)) {
    return message;
  }
  if (/abort/i.test(message)) {
    return 'La consulta ha tardado demasiado y se ha cancelado. Prueba a concretar más el material.';
  }
  if (/permission|403|PERMISSION_DENIED/i.test(message)) {
    return 'La clave de Gemini no tiene permiso para este modelo. Prueba a cambiar GEMINI_VISION_MODEL a gemini-flash-latest.';
  }
  if (/not found|404|NOT_FOUND/i.test(message)) {
    return `El modelo solicitado no existe o no está disponible para tu clave (${message}).`;
  }
  return `No se ha podido completar la consulta a la IA: ${message}`;
}
