"use client";

import { useEffect, useState } from "react";

type OpsVisitsToastProps = {
  message?: string;
};

export default function OpsVisitsToast({ message }: OpsVisitsToastProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) {
      return;
    }
    const decoded = decodeURIComponent(message);
    setVisibleMessage(decoded);
    const timer = window.setTimeout(() => {
      setVisibleMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!visibleMessage) return null;

  return (
    <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
      {visibleMessage}
    </div>
  );
}
