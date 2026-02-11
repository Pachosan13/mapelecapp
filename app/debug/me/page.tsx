import { createClient, getCurrentUser } from "@/lib/supabase/server";

export default async function DebugMePage() {
  const user = await getCurrentUser();
  const supabase = (await createClient()).schema("public");

  let profilesRow:
    | { user_id: string; role: string; is_active: boolean }
    | null = null;
  let profilesError: unknown = null;

  if (user?.id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,role,is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    profilesRow = data as typeof profilesRow;
    profilesError = error;
  }

  const payload = {
    authUserId: user?.id ?? null,
    getCurrentUserRole: user?.role ?? null,
    profilesRow,
    profilesError,
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold text-gray-900">Debug /me</h1>
      <pre className="mt-4 rounded bg-gray-50 p-4 text-xs text-gray-800">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
