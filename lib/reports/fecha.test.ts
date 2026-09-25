import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panamaDateOf } from "./fecha.ts";

describe("panamaDateOf", () => {
  it("una fecha sin hora (scheduled_for) se queda igual — no se corre al día anterior", () => {
    assert.equal(panamaDateOf("2026-09-24"), "2026-09-24");
  });

  it("un timestamp de noche en Panamá es de ese día, aunque en UTC ya sea mañana", () => {
    // 24-sep 22:30 en Panamá = 25-sep 03:30 UTC
    assert.equal(panamaDateOf("2026-09-25T03:30:00+00:00"), "2026-09-24");
  });

  it("un timestamp de la mañana", () => {
    assert.equal(panamaDateOf("2026-09-25T13:05:48.156+00:00"), "2026-09-25");
  });
});
