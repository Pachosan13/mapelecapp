import { createClient } from "@/lib/supabase/server";

export const MEDIA_BUCKET = "media";
export const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type MediaKind = "evidence" | "signature" | "document";

export type MediaRow = {
  id: string;
  building_id: string;
  visit_id: string | null;
  service_report_id: string | null;
  equipment_id: string | null;
  kind: MediaKind;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  captured_at: string | null;
  created_by: string;
  created_at: string;
};

type UploadMediaParams = {
  buildingId: string;
  file: File;
  visitId?: string | null;
  serviceReportId?: string | null;
  equipmentId?: string | null;
  kind?: MediaKind;
  capturedAt?: string | null;
};

type ListMediaParams = {
  buildingId?: string;
  visitId?: string;
  serviceReportId?: string;
  limit?: number;
};

const getExtension = (fileName: string, mimeType: string) => {
  const explicit = fileName.split(".").pop()?.trim().toLowerCase() ?? "";
  if (explicit) return explicit;
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return "bin";
};

const sanitizePathSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

const buildStoragePath = (params: {
  buildingId: string;
  userId: string;
  visitId?: string | null;
  serviceReportId?: string | null;
  fileName: string;
  mimeType: string;
}) => {
  const buildingId = sanitizePathSegment(params.buildingId);
  const userId = sanitizePathSegment(params.userId);
  const visitId = params.visitId ? sanitizePathSegment(params.visitId) : null;
  const serviceReportId = params.serviceReportId
    ? sanitizePathSegment(params.serviceReportId)
    : null;
  const extension = getExtension(params.fileName, params.mimeType);
  const randomName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

  if (visitId) {
    return `${buildingId}/visits/${visitId}/${userId}/${randomName}`;
  }
  if (serviceReportId) {
    return `${buildingId}/service-reports/${serviceReportId}/${userId}/${randomName}`;
  }
  return `${buildingId}/misc/${userId}/${randomName}`;
};

const validateUploadParams = (params: UploadMediaParams): string | null => {
  if (!params.buildingId?.trim()) {
    return "buildingId es requerido.";
  }
  if (!params.file) {
    return "Archivo requerido.";
  }
  if (!params.visitId && !params.serviceReportId) {
    return "Debes asociar media a visitId o serviceReportId.";
  }
  if (!ALLOWED_MEDIA_MIME_TYPES.has(params.file.type)) {
    return "Tipo de archivo no permitido.";
  }
  if (params.file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return "Archivo excede el límite de 10MB.";
  }
  return null;
};

export async function uploadMedia(params: UploadMediaParams): Promise<{
  data: MediaRow | null;
  error: string | null;
}> {
  const validationError = validateUploadParams(params);
  if (validationError) {
    return { data: null, error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: "Unauthorized." };
  }

  const storagePath = buildStoragePath({
    buildingId: params.buildingId,
    userId: user.id,
    visitId: params.visitId,
    serviceReportId: params.serviceReportId,
    fileName: params.file.name || "upload.bin",
    mimeType: params.file.type,
  });

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type,
      upsert: false,
    });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert({
      building_id: params.buildingId,
      visit_id: params.visitId ?? null,
      service_report_id: params.serviceReportId ?? null,
      equipment_id: params.equipmentId ?? null,
      kind: params.kind ?? "evidence",
      storage_path: storagePath,
      mime_type: params.file.type,
      size_bytes: params.file.size,
      captured_at: params.capturedAt ?? null,
      created_by: user.id,
    })
    .select(
      "id,building_id,visit_id,service_report_id,equipment_id,kind,storage_path,mime_type,size_bytes,captured_at,created_by,created_at"
    )
    .maybeSingle();

  if (insertError) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    return { data: null, error: insertError.message };
  }

  return { data: (inserted as MediaRow) ?? null, error: null };
}

export async function listMedia(params: ListMediaParams): Promise<{
  data: MediaRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  let query = supabase
    .from("media")
    .select(
      "id,building_id,visit_id,service_report_id,equipment_id,kind,storage_path,mime_type,size_bytes,captured_at,created_by,created_at"
    )
    .order("created_at", { ascending: false });

  if (params.buildingId) query = query.eq("building_id", params.buildingId);
  if (params.visitId) query = query.eq("visit_id", params.visitId);
  if (params.serviceReportId) {
    query = query.eq("service_report_id", params.serviceReportId);
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data as MediaRow[]) ?? [], error: null };
}

export async function createSignedMediaUrl(
  storagePath: string,
  expiresInSeconds = 60 * 15
): Promise<{ data: string | null; error: string | null }> {
  if (!storagePath?.trim()) {
    return { data: null, error: "storagePath es requerido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    return { data: null, error: error.message };
  }
  return { data: data?.signedUrl ?? null, error: null };
}
