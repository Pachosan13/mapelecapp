"use client";

/**
 * Cola de FOTOS offline en IndexedDB.
 *
 * Por qué IndexedDB y no localStorage: los blobs de foto (hasta 10MB) no caben en
 * localStorage. IndexedDB guarda binarios y sobrevive recarga y cierre de la app.
 *
 * Flujo: el técnico captura evidencia en un sótano sin señal → el blob se guarda acá
 * → al reconectar (o al reabrir la visita) se sube solo vía POST /api/tech/media y se
 * borra de la cola. La conversión HEIC→JPEG la sigue haciendo el server (lib/media).
 */

export type QueuedPhoto = {
  id: string;
  visitId: string;
  system: string | null;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  ts: number;
};

const DB_NAME = "semco-photos";
const STORE = "queue";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no-indexeddb"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("visitId", "visitId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Encola una foto. Escritura durable: al resolver, el blob ya sobrevive un cierre de app. */
export async function addPhoto(
  rec: Omit<QueuedPhoto, "id" | "ts">
): Promise<QueuedPhoto> {
  const entry: QueuedPhoto = {
    ...rec,
    id: crypto.randomUUID(),
    ts: Date.now(),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(entry);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  return entry;
}

/** Fotos pendientes de una visita, en orden de captura. */
export async function listPhotos(visitId: string): Promise<QueuedPhoto[]> {
  const db = await openDb();
  const all = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const req = t.objectStore(STORE).index("visitId").getAll(visitId);
    req.onsuccess = () => resolve((req.result as QueuedPhoto[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  return all.sort((a, b) => a.ts - b.ts);
}

/** Quita una foto de la cola tras subirla con éxito. */
export async function removePhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** Cuántas fotos quedan por subir (una visita, o todas). */
export async function countPhotos(visitId?: string): Promise<number> {
  if (visitId) return (await listPhotos(visitId)).length;
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const req = t.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror = () => reject(req.error);
  });
}
