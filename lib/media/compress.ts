"use client";

/**
 * Compresión de fotos EN EL EQUIPO, antes de encolarlas.
 *
 * PROBLEMA QUE RESUELVE (5-ago-2026): la app le prometía al técnico "Máx. 10MB
 * c/u", pero las funciones serverless de Vercel cortan el cuerpo de la petición
 * en ~4.5 MB. Una foto de 6 MB de un celular moderno nunca llegaba al endpoint:
 * la plataforma devolvía 413 y la cola —que borraba ante cualquier 4xx— la
 * eliminaba en silencio. El técnico creía haberla subido.
 *
 * Además de esquivar el límite, una foto de 8 MB por un enlace de sótano son
 * minutos de subida que bloquean todo lo demás. A 2000px de lado y calidad 0.8
 * una placa de motor se sigue leyendo perfecto y pesa una fracción.
 *
 * ⚠️ HEIC (iPhone) NO se puede comprimir acá: el navegador no lo sabe decodificar
 * en canvas. Esos archivos siguen viajando tal cual y, si pasan el límite, la
 * cola los deja marcados a la vista en vez de tragárselos.
 */

/** Tope real del cuerpo de la petición, con margen bajo los ~4.5 MB de Vercel. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Por debajo de esto no vale la pena tocar la foto. */
const COMPRESS_OVER_BYTES = 1.5 * 1024 * 1024;

/** Lado mayor tras redimensionar. Suficiente para leer una placa o un manómetro. */
const MAX_SIDE = 2000;

const JPEG_QUALITY = 0.8;

const COMPRESIBLES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function esComprimible(file: File): boolean {
  return COMPRESIBLES.has(file.type);
}

const conExtensionJpg = (nombre: string) =>
  nombre.replace(/\.[^./\\]+$/, "") + ".jpg";

/**
 * Devuelve una versión liviana de la foto, o la MISMA si no se puede o no
 * conviene. Nunca lanza: si algo falla, se sube el original — perder calidad es
 * aceptable, perder la foto no.
 */
export async function comprimirImagen(file: File): Promise<File> {
  if (!esComprimible(file)) return file;
  if (file.size <= COMPRESS_OVER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size === 0) return file;
    // Si el "comprimido" pesa más (pasa con PNG de pantalla), quedarse con el original.
    if (blob.size >= file.size) return file;

    return new File([blob], conExtensionJpg(file.name || "foto.jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
