"use client";

import { useState } from "react";

type Props = {
  enforceChecklistValidation: boolean;
  isCompleted: boolean;
};

export default function CompleteVisitButton({
  enforceChecklistValidation,
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

    // Only intercept when trying to complete the visit.
    event.preventDefault();

    const radios = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="radio"][data-checklist-item="1"]:not(:disabled)'
      )
    );

    if (radios.length === 0) {
      // No checklist-style radios in this form; allow submit.
      setUiError(null);
      form.requestSubmit(button);
      return;
    }

    const groups = new Map<string, HTMLInputElement[]>();
    radios.forEach((radio) => {
      if (!groups.has(radio.name)) {
        groups.set(radio.name, []);
      }
      groups.get(radio.name)!.push(radio);
    });

    let firstInvalid: HTMLInputElement | null = null;

    for (const group of groups.values()) {
      const hasChecked = group.some((radio) => radio.checked);
      if (!hasChecked) {
        firstInvalid = group[0] ?? null;
        break;
      }
    }

    if (firstInvalid) {
      setUiError("Debes marcar todos los ítems como Aprobado o Falla");
      try {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus();
      } catch {
        // ignore scroll/focus errors
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

