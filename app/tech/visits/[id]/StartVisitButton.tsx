"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StartVisitButtonProps = {
  visitId: string;
};

export default function StartVisitButton({ visitId }: StartVisitButtonProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const toast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  const handleStart = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error(authError);
        toast("No autorizado");
        return;
      }

      const { data: existingVisit, error: readError } = await supabase
        .from("visits")
        .select("id,status,assigned_tech_user_id")
        .eq("id", visitId)
        .maybeSingle();

      if (readError) {
        console.error(readError);
        toast(readError.message);
        return;
      }

      if (!existingVisit) {
        toast("No access to visit (RLS o filtros)");
        return;
      }

      if (existingVisit.assigned_tech_user_id !== user.id) {
        toast("Visit not assigned to current tech");
        return;
      }

      if (existingVisit.status !== "planned") {
        toast(`Estado actual: ${existingVisit.status}`);
        return;
      }

      const { data, error } = await supabase
        .from("visits")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", visitId)
        .eq("assigned_tech_user_id", user.id)
        .eq("status", "planned")
        .select("id,status,started_at");

      if (error) {
        console.error(error);
        toast(error.message);
        return;
      }

      if (!data || data.length === 0) {
        toast("No rows updated (RLS o filtros)");
        return;
      }

      if (data.length > 1) {
        toast("Resultado inesperado (múltiples filas)");
        return;
      }

      toast("Visita iniciada");
      router.replace(`/tech/visits/${visitId}?started=1`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading}
        className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Iniciando..." : "Start"}
      </button>
      {toastMessage ? (
        <div className="mt-3 rounded border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
