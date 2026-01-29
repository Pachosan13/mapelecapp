"use client";

import { useEffect, useState } from "react";

type VisitToastProps = {
  message?: string;
};

export default function VisitToast({ message }: VisitToastProps) {
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
    <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {visibleMessage}
    </div>
  );
}
