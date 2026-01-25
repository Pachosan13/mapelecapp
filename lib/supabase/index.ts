// Re-export commonly used functions
export { createSupabaseBrowserClient } from "./client";
export { createClient as createServerClient } from "./server";
export { getCurrentUser } from "./server";
export type { CurrentUser } from "./server";
