# Sistema de presupuestos · SUMA

Herramienta interna para preparar presupuestos de materiales de construcción.
Se describe o se fotografía el material, una IA busca proveedores en la
provincia de Málaga y compara precios, se van añadiendo partidas indicando la
cantidad de cada una, y al terminar se descarga el presupuesto en PDF con la
identidad de SUMA.

## El proceso, paso a paso

| # | Paso | Dónde vive |
| - | ---- | ---------- |
| 1 | El usuario escribe el material o adjunta una fotografía | `src/components/chat/Composer.tsx` |
| 2 | Gemini interpreta el texto y la imagen y deduce qué producto se necesita | `src/lib/gemini/materials.ts` |
| 3 | Gemini busca proveedores de Málaga y compara precios, con las fuentes citadas | `src/lib/gemini/suppliers.ts` |
| 4 | Cada opción se puede enviar al presupuesto con «Agregar al presupuesto» | `src/components/chat/OfferCard.tsx` |
| 5 | El asistente pregunta cuánta cantidad se va a usar (cm, m, m², m³, kg, ud…) | `src/components/chat/QuantityPrompt.tsx` |
| 6 | El sistema convierte la medición a unidades de venta y calcula el importe | `src/lib/pricing.ts` |
| 7 | «Finalizar presupuesto» genera el PDF con los colores y el logotipo de SUMA | `src/pdf/BudgetDocument.tsx` |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # opcional: añade tu GEMINI_API_KEY
npm run dev                    # http://localhost:3000
```

**Sin clave de Gemini el sistema funciona igual**, en *modo demostración*: usa
un catálogo local con precios de mercado orientativos de distribuidores reales
de Málaga y lo señaliza en la interfaz y en el PDF. Es la forma más rápida de
recorrer el proceso completo y de hacer una demostración sin conexión.

Con `GEMINI_API_KEY` configurada se activan la lectura de fotografías y la
búsqueda real de proveedores.

## Cómo se calculan los precios

El punto delicado de un presupuesto de obra es que **lo que se mide y lo que se
compra casi nunca coinciden**: se miden 24 m² de suelo, pero se compran cajas
de 1,44 m²; se miden 40 m de armadura, pero se compran barras de 6 m; se miden
24 m² de alicatado, pero se compran sacos de cemento cola que rinden 5 m² cada
uno.

El sistema modela ese puente explícitamente con el **rendimiento** de cada
oferta (`coverage`): cuánta magnitud medible aporta una unidad de venta. A
partir de ahí:

1. Se convierte la cantidad pedida a la unidad del rendimiento (`src/lib/units.ts`).
2. Se aplica la merma técnica del material (cerámica 8-10 %, impermeabilización
   15 % por solapes, pintura 5 %…).
3. Se divide por el rendimiento y, si la unidad de venta es indivisible, se
   redondea hacia arriba: no se puede comprar media caja.
4. Se multiplica por el precio unitario en **aritmética entera**, para que
   3,5 × 4,85 € dé 16,98 € y no 16,97 €.

**La IA no multiplica nunca.** Aporta datos (precio, unidad de venta,
rendimiento, merma) e interpreta frases libres como «el salón mide 4 por 5
metros», pero todo el cálculo ocurre en `src/lib/pricing.ts`, en código
determinista y cubierto por tests. Un presupuesto tiene que ser reproducible y
auditable, y por eso la interfaz muestra siempre el porqué de cada cifra con
«Ver cómo se ha calculado».

## Estructura

```
src/
  app/
    api/chat/       Pasos 1-3: mensaje -> material -> ofertas de proveedores
    api/quantity/   Pasos 5-6: interpretación de la cantidad y cálculo
    api/pdf/        Paso 7: generación del documento
  components/       Interfaz: chat, ofertas, presupuesto, diálogo de cierre
  lib/
    brand.ts        Colores, datos del emisor y ámbito de búsqueda
    units.ts        Unidades de medida y de venta, y conversiones
    pricing.ts      Toda la aritmética del presupuesto
    quantity-parser.ts  Intérprete de cantidades en español, sin coste ni latencia
    gemini/         Cliente, prompts, esquemas y las tres llamadas al modelo
    demo/           Directorio de proveedores de Málaga y catálogo de respaldo
  pdf/              Documento PDF y logotipo vectorial
  proxy.ts          Puerta de acceso opcional por contraseña compartida
```

### Enlaces de compra

Cada opción debe llevar la URL de la ficha del producto en la tienda, para
comprarlo directamente desde el resultado. Eso se impone en tres capas:

1. **El prompt de búsqueda** exige la ficha exacta de cada opción y ordena
   descartar productos de los que no se consiga, priorizando tiendas con venta
   online que sirven en Málaga (Obramat, Leroy Merlin, Bauhaus, ManoMano…).
2. **La normalización** rechaza como ficha cualquier portada («bigmat.es/») y,
   si hay al menos dos opciones con enlace, descarta las que no lo tienen; si
   casi ninguna lo trae, las conserva señalizadas antes que dejar al usuario
   sin resultados (`preferLinkedOffers`).
3. **La interfaz** muestra el enlace como acción de la tarjeta —«Ver producto
   en obramat.es»— y el PDF imprime la ficha de cada partida.

El catálogo de demostración lleva también fichas reales localizadas por
búsqueda con verificación cruzada. Los catálogos de las tiendas cambian: si un
enlace muere, se actualiza en `src/lib/demo/catalog.ts`.

### La capa de búsqueda programática (opcional)

Con `GOOGLE_CSE_API_KEY` y `GOOGLE_CSE_ID` configuradas, cada búsqueda lanza
además —en paralelo, sin añadir latencia— consultas a la **API oficial de
Google Custom Search**, que devuelve fichas de producto con URL literal. Esa
evidencia se suma al informe del grounding antes de estructurar, con lo que
aparecen más opciones y todas con enlace de la propia API.

Se eligió la API oficial y no *scraping* del buscador a propósito: raspar el
HTML de Google lo bloquean los captchas, lo rompe cada rediseño y lo prohíben
sus condiciones de uso — es lo contrario de fiable. La capa programática está
construida para degradar limpio: reintentos con espera creciente sólo ante
errores transitorios, validación estricta de la respuesta, filtro a dominios
de tiendas reales, deduplicación por ficha, y si todo falla la búsqueda con
grounding sigue funcionando sola (`src/lib/search/google-cse.ts`).

### Por qué la búsqueda son dos llamadas

La API de Gemini no admite anclaje en Google Search y salida JSON estructurada
en la misma petición. La primera llamada busca y razona en texto libre con la
herramienta de búsqueda activada; la segunda convierte ese informe en datos
estructurados sin herramientas. La separación tiene además una ventaja: permite
conservar las fuentes citadas y enseñárselas al usuario.

## Identidad de marca

La identidad es la de gruposuma.eu: fondo casi negro, rojo corporativo y texto
blanco. Todo sale de dos archivos que hay que mantener sincronizados:

- `src/lib/brand.ts` — la paleta de pantalla (`brandColors`), la del documento
  impreso (`printColors`) y los datos del emisor.
- `src/app/globals.css` — los mismos colores de pantalla como variables
  `--color-suma-*`, que es lo que consumen las clases de Tailwind.

El logotipo es el wordmark oficial —«GRUPO» girado en vertical, «SUMA» en
versales gruesas y el signo «+» en rojo— y está duplicado a propósito en dos
implementaciones con la misma geometría: `src/components/brand/SumaLogo.tsx`
para la web y `src/pdf/logo.tsx` para el documento. El «+» se dibuja con dos
barras en lugar de escribirse como carácter, para que su grosor no dependa de
la tipografía disponible.

**El PDF es la excepción al fondo oscuro.** Un presupuesto se imprime, se firma
y se archiva: en negro gastaría tóner, se leería peor en papel y no es lo que
espera recibir un cliente. Así que el cuerpo va en blanco y la marca entra por
las bandas —cabecera a sangre, cabecera de tabla, bloque de total y filetes—,
en el negro y el rojo corporativos. Esa paleta impresa vive en `printColors`.

El documento usa las tipografías estándar del formato PDF: Helvetica para el
texto y Times para los titulares, que hace eco de la tipografía con remate de
los títulos de la web. Como Helvetica sólo codifica el juego WinAnsi,
`src/pdf/text.ts` sanea todo el texto dinámico: una lambda de una ficha técnica
saldría como otro glifo cualquiera y dejaría una errata delante del cliente.
Para usar la tipografía corporativa basta con registrarla con `Font.register`.

## Pruebas

```bash
npm test          # pruebas unitarias: unidades, aritmética, catálogo, enlaces, PDF, acceso
npm run test:e2e  # recorrido completo en navegador, del chat al PDF
npm run typecheck
npm run lint
```

Las pruebas unitarias cubren lo que más duele que falle: las conversiones de
unidades, el redondeo comercial, el IVA y la generación del documento. Las de
extremo a extremo recorren el proceso entero en modo demostración, sin red.

Si el entorno ya tiene un Chromium instalado, se le puede indicar a Playwright
dónde está en lugar de descargar otro:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium npm run test:e2e
```

## Despliegue en Vercel

El proyecto va preparado para desplegarse sin configuración adicional: se
importa el repositorio en Vercel, se detecta Next.js y se construye.

### 1. Variables de entorno

En **Project → Settings → Environment Variables**, para *Production*,
*Preview* y *Development*:

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `GEMINI_API_KEY` | No, pero sin ella todo va en modo demostración | Lectura de fotografías y búsqueda real de proveedores |
| `SUMA_ACCESS_PASSWORD` | Recomendable | Contraseña compartida para entrar |
| `NEXT_PUBLIC_SUMA_*` | Sí, antes de emitir un presupuesto | Datos fiscales del emisor que salen impresos |
| `GEMINI_*_MODEL`, `GEMINI_TIMEOUT_MS` | No | Ajuste fino de modelo y tiempos |

**La clave de Gemini nunca llega al navegador**: sólo la leen las rutas de
API, que se ejecutan en el servidor. Los datos del emisor sí llevan el prefijo
`NEXT_PUBLIC_` porque también se muestran en la interfaz.

### 2. Proteger el acceso

Al desplegar, la aplicación queda en una URL pública y cualquiera que la
encuentre puede lanzar búsquedas que se facturan contra vuestra clave. Con
`SUMA_ACCESS_PASSWORD` definida, `src/proxy.ts` pide una contraseña compartida
con el diálogo propio del navegador —cubre también las rutas de API y la
descarga del PDF— y sin ella no hace nada, que es lo cómodo en local. Si tenéis
plan de pago, la *Password Protection* de Vercel hace lo mismo desde el panel.

### 3. Ajustes del panel

No hay `vercel.json` a propósito. Para Next.js, Vercel documenta que la
duración de cada función se declara en el propio archivo de ruta —cosa que ya
está hecha con `export const maxDuration`— y que la memoria y la región se
configuran desde el panel. Un `vercel.json` con globs de funciones sólo añade
una forma más de que falle el primer despliegue.

Merece la pena tocar una cosa en **Settings → Functions**:

- **Function Region → `cdg1` (París)**, la más cercana a Málaga de las
  disponibles. Por defecto se despliega en Washington, y son unos 100 ms de ida
  y vuelta en cada llamada.

### 4. Lo que ya viene resuelto

- **Tiempos.** Una búsqueda encadena dos llamadas al modelo, así que comparten
  un presupuesto de tiempo (`GEMINI_TIMEOUT_MS`, 45 s) que queda por debajo del
  límite de 60 s de la función. Así el usuario recibe un mensaje que le sirve en
  lugar de un error genérico de pasarela.
- **Tipografías del PDF.** Las métricas de Helvetica y Times viven en `pdfkit` y
  se cargan por un especificador interno que el rastreador de dependencias no
  siempre sigue. `outputFileTracingIncludes` las incluye a mano: si faltaran, el
  PDF fallaría sólo en producción.
- **Cabeceras** `nosniff`, `X-Frame-Options`, `Referrer-Policy` y `noindex`.
- **Node 20.9+** fijado en `engines` y `.nvmrc`.

### 5. Comprobación tras el primer despliegue

```bash
npm run build && npm start   # reproduce en local lo que ejecuta Vercel
```

Ya en la URL desplegada: buscar un material, añadir una partida y descargar el
PDF. Si el PDF falla y el resto funciona, el problema está en el rastreo de las
tipografías; si la búsqueda devuelve precios del catálogo local con el aviso de
modo demostración, falta `GEMINI_API_KEY` en el entorno correcto.

## Sobre los datos

- El catálogo de demostración contiene **productos reales con su ficha
  enlazada** en Obramat y Leroy Merlin (ambos con tienda en la provincia de
  Málaga y venta online). Proceden de una investigación de agosto de 2026 con
  verificación cruzada: cada URL se localizó por búsqueda web y se re-verificó
  de forma independiente. Sólo entraron fichas con veredicto CONFIRMADO.
- Los precios de tienda son PVP con IVA; el catálogo los guarda **sin IVA**
  (PVP ÷ 1,21) porque el motor añade el IVA al final del presupuesto, y anota
  el PVP original en la ficha técnica de cada producto. Se etiquetan como
  «precio de catálogo»: son reales, pero pueden variar respecto a la web.
- Dos familias quedan sin enlace a sabiendas: el hormigón preparado (se
  encarga a planta, no se vende online) y la lámina asfáltica (su ficha no
  pudo verificarse). Ambas van marcadas como estimadas.
- Los catálogos de las tiendas cambian. Si una ficha muere o un precio baila,
  se actualiza en `src/lib/demo/suppliers.ts` / `src/lib/demo/catalog.ts`.
- El directorio de `src/lib/demo/suppliers.ts` recoge distribuidores reales con
  presencia contrastada en la provincia. Sirve para anclar la búsqueda de la IA
  y evitar que invente nombres verosímiles.
- Los precios que devuelve la IA se etiquetan según su origen: *verificado*
  (tarifa consultada), *de catálogo* o *estimado*. El PDF advierte de forma
  destacada cuando alguna partida usa precios estimados.
- La venta de material sin instalación tributa siempre al 21 %. El tipo
  reducido del 10 % sólo cabe en obras de renovación o reparación de vivienda
  en las que el material no supere el 40 % de la base imponible.
