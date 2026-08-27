import type { SupplierOffer } from '../types';

/**
 * Enlace de respaldo cuando una oferta se queda sin ficha de producto.
 *
 * La regla de la casa es que cada enlace lleve AL PRODUCTO. Cuando no hay
 * ficha, lo honesto no es enlazar la portada de la tienda (no lleva a ningún
 * sitio útil), sino una búsqueda del producto: dentro de la web del proveedor
 * si la tiene, o en Google a secas si no. Así el clic siempre acerca al
 * producto, y la interfaz lo etiqueta como búsqueda, no como ficha.
 */

/** «optimusferreteria.com» a partir de lo que haya en el directorio. */
export function siteDomain(website: string | null): string | null {
  if (!website) return null;
  const domain = website
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .trim()
    .toLowerCase();
  return domain.includes('.') ? domain : null;
}

/** Términos con los que se busca el producto: marca + denominación. */
export function productSearchTerms(offer: Pick<SupplierOffer, 'productName' | 'brand'>): string {
  return [offer.brand, offer.productName].filter(Boolean).join(' ').trim();
}

/** Búsqueda del producto, acotada a la tienda del proveedor si tiene web. */
export function productSearchUrl(
  offer: Pick<SupplierOffer, 'productName' | 'brand' | 'supplier'>,
): string {
  const terms = productSearchTerms(offer);
  const domain = siteDomain(offer.supplier.website);
  const query = domain ? `${terms} site:${domain}` : `${terms} ${offer.supplier.name} comprar`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Tiendas que se ofrecen como «explora tú mismo» bajo los resultados: el
 * usuario abre la tienda con todas sus opciones, elige el producto que le
 * convence y pega su enlace en el chat para incorporarlo al presupuesto.
 */
export const EXPLORE_SHOPS: Array<{ name: string; domain: string }> = [
  { name: 'Obramat', domain: 'obramat.es' },
  { name: 'Leroy Merlin', domain: 'leroymerlin.es' },
  { name: 'ManoMano', domain: 'manomano.es' },
  { name: 'Bauhaus', domain: 'bauhaus.es' },
  { name: 'Brico Depot', domain: 'bricodepot.es' },
];

/** Búsqueda del material dentro de una tienda concreta. */
export function shopSearchUrl(material: string, domain: string): string {
  const query = `${material} site:${domain}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
