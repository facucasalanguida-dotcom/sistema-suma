'use client';

/**
 * Preparación de fotografías antes de enviarlas al servidor.
 *
 * Las fotos de obra vienen de móviles y pesan varios megas. Reducirlas en el
 * navegador antes de subirlas evita esperas largas, recorta el coste de la
 * llamada a Gemini y esquiva el límite de tamaño de la petición. A 1.600 px de
 * lado mayor se sigue leyendo perfectamente una referencia impresa en un saco
 * o el formato de una baldosa.
 */

export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  mimeType: string;
  /** Contenido en base64, sin el prefijo `data:`. */
  data: string;
  /** URL completa para la previsualización en el chat. */
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export class ImageError extends Error {}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Ese archivo no es una imagen. Adjunta una foto en JPG, PNG o WebP.');
  }
  if (!ACCEPTED.includes(file.type)) {
    throw new ImageError(`Formato no admitido (${file.type}). Usa JPG, PNG o WebP.`);
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new ImageError('La imagen pesa más de 25 MB. Haz la foto con menos resolución.');
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageError('No se ha podido leer la imagen. Prueba con otro archivo.');
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new ImageError('El navegador no permite procesar la imagen.');
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Se recodifica siempre a JPEG: es el formato que mejor comprime una foto y
  // el que Gemini interpreta con menos sorpresas.
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1);

  return {
    mimeType: 'image/jpeg',
    data,
    dataUrl,
    width,
    height,
    bytes: Math.floor((data.length * 3) / 4),
  };
}

/** Extrae la primera imagen de un evento de pegado, si la hay. */
export function imageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}
