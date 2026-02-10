"use client";

import { useState } from "react";

const CORE_CHECKLIST_ERROR =
  "Debes marcar todos los ítems como Aprobado o Falla";

type Props = {
  enforceChecklistValidation: boolean;
  requiredChecklistItemIds: string[];
  isCompleted: boolean;
};

export default function CompleteVisitButton({
  enforceChecklistValidation,
  requiredChecklistItemIds,
  isCompleted,
}: Props) {
  const [uiError, setUiError] = useState<string | null>(null);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (!enforceChecklistValidation || isCompleted) {
      return;
    }

    const button = event.currentTarget;
    const form = button.form;
    if (!form) {
      return;
    }

    event.preventDefault();

    const formData = new FormData(form);
    const firstMissingId = requiredChecklistItemIds.find((itemId) => {
      const value = formData.get(`item-${itemId}`);
      return value !== "approved" && value !== "failed";
    });

    if (firstMissingId != null) {
      setUiError(CORE_CHECKLIST_ERROR);
      const firstInput = form.querySelector<HTMLInputElement>(
        `input[name="item-${firstMissingId}"]`
      );
      if (firstInput) {
        try {
          firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
          firstInput.focus();
        } catch {
          // ignore
        }
      }
      return;
    }

    setUiError(null);
    form.requestSubmit(button);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type={enforceChecklistValidation ? "button" : "submit"}
        name="action"
        value="complete"
        className="rounded bg-black px-4 py-2 text-white"
        disabled={isCompleted}
        onClick={enforceChecklistValidation ? handleClick : undefined}
      >
        Completar visita
      </button>
      {uiError ? (
        <p className="text-sm text-red-600">{uiError}</p>
      ) : null}
    </div>
  );
}
