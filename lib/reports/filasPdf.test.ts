import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agruparFilas, unidadDe, valorConUnidad, type FilaPdf } from "./filasPdf.ts";

const n = (label: string, value: string): FilaPdf => ({ label, value, kind: "number" });

describe("PDF: una sección por bomba principal (William, 25-sep)", () => {
  it("separa Bomba 1 y Bomba 2 en 'Bomba principal #1' y '#2', sin el prefijo en la fila", () => {
    const g = agruparFilas([
      n("Bombas principales - Bomba 1 - Voltaje L1-L2", "209"),
      n("Bombas principales - Bomba 1 - Presión estática", "65"),
      n("Bombas principales - Bomba 2 - Voltaje L1-L2", "208"),
      { label: "Tablero - Breaker ok", value: "Sí", kind: "checkbox" },
    ]);
    assert.deepEqual(
      g.map((x) => [x.name, x.rows.map((r) => r.label)]),
      [
        ["Bomba principal #1", ["Voltaje L1-L2", "Presión estática"]],
        ["Bomba principal #2", ["Voltaje L1-L2"]],
        ["Tablero", ["Breaker ok"]],
      ]
    );
  });

  it("un ítem de 'Bombas principales' sin número de bomba se queda en la sección de siempre", () => {
    const g = agruparFilas([n("Bombas principales - Observación general", "x")]);
    assert.deepEqual(g.map((x) => x.name), ["Bombas principales"]);
    assert.equal(g[0].rows[0].label, "Observación general");
  });

  it("las demás secciones no cambian", () => {
    const g = agruparFilas([
      n("Bomba contra incendio 1 - Presión máxima", "231"),
      n("Sin guion", "1"),
    ]);
    assert.deepEqual(g.map((x) => x.name), ["Bomba contra incendio 1", "General"]);
  });
});

describe("PDF: unidades psi y gpm (William, 25-sep)", () => {
  it("unidad por label", () => {
    assert.equal(unidadDe("Presión estática"), "psi");
    assert.equal(unidadDe("Presion arranque"), "psi");
    assert.equal(unidadDe("Presión de aceite inicial"), "psi");
    assert.equal(unidadDe("PSI"), "psi");
    assert.equal(unidadDe("Galones por minuto"), "gpm");
    assert.equal(unidadDe("Voltaje L1-L2"), null);
    assert.equal(unidadDe("Amperaje L1-L2"), null);
  });

  it("se pega solo a números", () => {
    assert.equal(valorConUnidad(n("Presión máxima", "231")), "231 psi");
    assert.equal(valorConUnidad(n("Galones por minuto", "750")), "750 gpm");
    assert.equal(valorConUnidad(n("Presión dinámica", "95.5")), "95.5 psi");
    assert.equal(valorConUnidad(n("Presión dinámica", "N/A")), "N/A");
    assert.equal(valorConUnidad(n("Presión dinámica", "—")), "—");
    assert.equal(valorConUnidad(n("Voltaje L1-L2", "208")), "208");
  });

  it("checkbox con 'presión' en el nombre no lleva unidad", () => {
    assert.equal(
      valorConUnidad({ label: "Transductor de presión", value: "Sí", kind: "checkbox" }),
      "Sí"
    );
  });
});
