import { describe, expect, it, vi } from 'vitest';
import {
  extractPageEvidence,
  extractProductUrl,
  fetchProductPage,
  isSafeRemoteUrl,
  looksLikeHomepage,
  supplierForDomain,
} from '@/lib/import/product-page';

const FICHA = 'https://www.leroymerlin.es/productos/ventilador-techo-edm-107-87654321.html';

describe('extractProductUrl', () => {
  it('encuentra el enlace aunque venga rodeado de texto', () => {
    expect(extractProductUrl(`mira este ${FICHA} qué te parece`)).toBe(FICHA);
    expect(extractProductUrl(FICHA)).toBe(FICHA);
  });

  it('limpia la puntuación pegada al final', () => {
    expect(extractProductUrl(`${FICHA}.`)).toBe(FICHA);
    expect(extractProductUrl(`(${FICHA})`)).toBe(FICHA);
  });

  it('un mensaje sin enlace no es una importación', () => {
    expect(extractProductUrl('ventilador de techo con luz')).toBeNull();
    expect(extractProductUrl('quiero 24 m2 de porcelánico')).toBeNull();
  });

  it('rechaza enlaces que no son https públicos', () => {
    expect(extractProductUrl('http://tienda.es/producto-1')).toBeNull();
    expect(extractProductUrl('https://localhost/admin')).toBeNull();
    expect(extractProductUrl('https://192.168.1.1/panel')).toBeNull();
  });
});

describe('isSafeRemoteUrl', () => {
  it('acepta fichas https normales de cualquier tienda', () => {
    expect(isSafeRemoteUrl(FICHA)).toBe(true);
    expect(isSafeRemoteUrl('https://ferreteria-desconocida.com/ventilador')).toBe(true);
  });

  it('rechaza destinos internos o raros', () => {
    expect(isSafeRemoteUrl('https://localhost/x')).toBe(false);
    expect(isSafeRemoteUrl('https://10.0.0.5/x')).toBe(false);
    expect(isSafeRemoteUrl('https://servidor.local/x')).toBe(false);
    expect(isSafeRemoteUrl('https://tienda.es:8443/x')).toBe(false);
    expect(isSafeRemoteUrl('https://usuario:clave@tienda.es/x')).toBe(false);
    expect(isSafeRemoteUrl('ftp://tienda.es/x')).toBe(false);
    expect(isSafeRemoteUrl('https://sinpunto/x')).toBe(false);
  });
});

describe('looksLikeHomepage', () => {
  it('distingue la portada de una ficha', () => {
    expect(looksLikeHomepage('https://www.obramat.es/')).toBe(true);
    expect(looksLikeHomepage(FICHA)).toBe(false);
    expect(looksLikeHomepage('https://www.obramat.es/?q=cemento')).toBe(false);
  });
});

describe('extractPageEvidence', () => {
  const html = `<html><head>
    <title>Ventilador de techo EDM 107 cm | Leroy Merlin</title>
    <script type="application/ld+json">{"@type":"Product","name":"Ventilador EDM","offers":{"@type":"Offer","price":"62.00","priceCurrency":"EUR"}}</script>
    <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
    <script>var privado = 'no debe salir';</script>
    <style>.precio { color: red; }</style>
  </head><body>
    <h1>Ventilador de techo EDM</h1>
    <p>Precio: 62,00&nbsp;&euro; IVA incluido</p>
  </body></html>`;

  it('conserva título, datos schema.org de producto y texto visible', () => {
    const evidence = extractPageEvidence(html);
    expect(evidence).toContain('Ventilador de techo EDM 107 cm');
    expect(evidence).toContain('"price":"62.00"');
    expect(evidence).toContain('62,00 € IVA incluido');
  });

  it('descarta scripts, estilos y bloques schema.org sin producto', () => {
    const evidence = extractPageEvidence(html);
    expect(evidence).not.toContain('no debe salir');
    expect(evidence).not.toContain('color: red');
    expect(evidence).not.toContain('BreadcrumbList');
  });
});

describe('fetchProductPage', () => {
  function htmlResponse(body: string, status = 200): Response {
    return new Response(body, { status, headers: { 'Content-Type': 'text/html' } });
  }

  it('devuelve el HTML de una página que responde', async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse('<html>ficha</html>'));
    const page = await fetchProductPage(FICHA, fetchMock);
    expect(page?.html).toContain('ficha');
    expect(page?.finalUrl).toBe(FICHA);
  });

  it('una página que no responde o no es HTML devuelve null', async () => {
    expect(
      await fetchProductPage(FICHA, vi.fn().mockResolvedValue(htmlResponse('no', 404))),
    ).toBeNull();
    expect(
      await fetchProductPage(
        FICHA,
        vi.fn().mockResolvedValue(
          new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
        ),
      ),
    ).toBeNull();
    expect(await fetchProductPage(FICHA, vi.fn().mockRejectedValue(new Error('red')))).toBeNull();
  });
});

describe('supplierForDomain', () => {
  it('reconoce a los distribuidores del directorio por su dominio', () => {
    const supplier = supplierForDomain('https://www.obramat.es/productos/cemento-1.html');
    expect(supplier.name).toBe('Obramat Málaga');
  });

  it('una tienda desconocida se identifica por su dominio', () => {
    const supplier = supplierForDomain('https://ferreteria-rara.com/ventilador');
    expect(supplier.name).toBe('ferreteria-rara.com');
    expect(supplier.location).toContain('Tienda online');
  });
});
