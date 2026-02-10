/**
 * Core checklist templates are identified by template ID (not name).
 * Set CORE_TEMPLATE_IDS in .env.local (comma-separated UUIDs).
 * To get the IDs: run `node scripts/get-core-template-ids.mjs` and paste the output.
 */
const CORE_TEMPLATE_IDS = new Set<string>(
  (process.env.CORE_TEMPLATE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export function isCoreChecklistTemplateId(
  templateId: string | null | undefined
): boolean {
  if (!templateId) return false;
  return CORE_TEMPLATE_IDS.has(templateId.trim());
}
