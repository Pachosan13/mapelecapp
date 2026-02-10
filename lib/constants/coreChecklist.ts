/**
 * Core checklist templates are identified by template ID (not name).
 * Set CORE_TEMPLATE_IDS in .env.local (comma-separated UUIDs).
 * To get the IDs: run `node scripts/get-core-template-ids.mjs` and paste the output.
 * If CORE_TEMPLATE_IDS is not set or empty, enforcement is disabled by design (no error).
 */
const ids = (process.env.CORE_TEMPLATE_IDS?.split(",") ?? [])
  .map((s) => String(s).trim())
  .filter(Boolean);
const CORE_TEMPLATE_IDS = new Set<string>(ids);

// Core checklist enforcement is controlled by CORE_TEMPLATE_IDS env var.
// If not set, enforcement is disabled by design.
export function isCoreChecklistTemplateId(
  templateId: string | null | undefined
): boolean {
  if (!templateId) return false;
  return CORE_TEMPLATE_IDS.has(templateId.trim());
}
