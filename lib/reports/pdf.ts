import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";

/* ──────────────────────────────────────────────────────────
   SEMCO — Informe de Servicio Técnico
   High-end consulting layout renderer (pdf-lib, pure function).
   ────────────────────────────────────────────────────────── */

// Brand palette (matches tailwind.config navy/gold).
const NAVY = rgb(0.102, 0.137, 0.278); // #1a2347
const NAVY_500 = rgb(0.255, 0.314, 0.51); // #415082
const GOLD = rgb(0.772, 0.643, 0.494); // #c5a47e
const GOLD_SOFT = rgb(0.949, 0.918, 0.847); // #f2e8d8
const INK = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.42, 0.45, 0.5);
const FAINT = rgb(0.6, 0.62, 0.66);
const LINE = rgb(0.88, 0.89, 0.91);
const ZEBRA = rgb(0.969, 0.973, 0.98);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.024, 0.588, 0.412);
const RED = rgb(0.863, 0.149, 0.149);
const AMBER = rgb(0.66, 0.47, 0.11); // ámbar tierra — observaciones sin alarmar (informe cliente)

const MARGIN = 50;
const FOOTER_Y = 38;
const CONTENT_BOTTOM = 64; // keep clear of footer

const sanitize = (value: string) =>
  (value ?? "")
    .replace(/✅/g, "Sí")
    .replace(/❌/g, "No")
    .replace(/[︀-️]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");

// ── Input shapes (subset of lib/reports/serviceReport types) ──
export type PdfResponseValue = {
  label: string;
  value: string;
  kind: "checkbox" | "number" | "text";
};

export type PdfRecorridoRow = {
  piso: string;
  presion_entrada: number | null;
  presion_salida: number | null;
  estacion_control_abierta: boolean;
  estacion_control_cerrada: boolean;
  valvula_reguladora: boolean;
  estado_manometro: boolean;
  gabinetes_manguera: boolean;
  extintores: boolean;
  observacion: string;
};

export type PdfVisitBlock = {
  index: number;
  completedAtLabel: string;
  crewLabel?: string | null;
  rows: PdfResponseValue[];
  recorrido?: { label: string; rows: PdfRecorridoRow[] } | null;
  media: Array<{ name: string; sizeMb: string; image: { bytes: Uint8Array; isPng: boolean } | null }>;
  mediaCount: number;
};

export type PdfSection = {
  title: string;
  visits: PdfVisitBlock[];
};

export type ServiceReportPdfInput = {
  buildingName: string;
  buildingAddress?: string | null;
  reportDateLabel: string;
  reportId?: string | null;
  statusLabel?: string | null;
  systems?: string[];
  clientSummary?: string | null;
  internalNotes?: string | null;
  sections: PdfSection[];
  logoBytes: Uint8Array;
  generatedAtLabel: string;
};

// ── Layout engine ──
type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>>;
  buildingName: string;
};

function contentWidth(c: Ctx) {
  return c.width - MARGIN * 2;
}

function textWidth(font: PDFFont, s: string, size: number) {
  return font.widthOfTextAtSize(sanitize(s), size);
}

function wrap(font: PDFFont, s: string, size: number, maxW: number): string[] {
  const safe = sanitize(s);
  const words = safe.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) {
      line = next;
    } else {
      if (line) lines.push(line);
      // hard-break very long tokens
      if (font.widthOfTextAtSize(w, size) > maxW) {
        let chunk = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function draw(
  c: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB
) {
  c.page.drawText(sanitize(s), { x, y, size, font, color });
}

function runningHeader(c: Ctx) {
  // Slim header for continuation pages.
  const logoDims = c.logo.scale(0.12);
  c.page.drawImage(c.logo, {
    x: MARGIN,
    y: c.height - 34 - logoDims.height / 2,
    width: logoDims.width,
    height: logoDims.height,
  });
  draw(
    c,
    `Informe de Servicio · ${c.buildingName}`,
    MARGIN + logoDims.width + 12,
    c.height - 32,
    8,
    c.font,
    FAINT
  );
  c.page.drawLine({
    start: { x: MARGIN, y: c.height - 44 },
    end: { x: c.width - MARGIN, y: c.height - 44 },
    thickness: 0.75,
    color: LINE,
  });
  c.y = c.height - 60;
}

function newPage(c: Ctx) {
  c.page = c.doc.addPage();
  const size = c.page.getSize();
  c.width = size.width;
  c.height = size.height;
  runningHeader(c);
}

function ensure(c: Ctx, needed: number) {
  if (c.y - needed < CONTENT_BOTTOM) newPage(c);
}

function valueColor(v: PdfResponseValue): RGB {
  if (v.kind === "checkbox") {
    const t = v.value.toLowerCase();
    if (t === "sí" || t === "si") return GREEN;
    if (t === "no") return AMBER;
    return MUTED; // N/A / —
  }
  const t = v.value.trim().toLowerCase();
  if (["aprobado", "ok", "bien"].includes(t)) return GREEN;
  if (["falla", "no ok", "mal"].includes(t)) return AMBER;
  return INK;
}

// ── Cover / header block (page 1) ──
function drawCover(c: Ctx, input: ServiceReportPdfInput) {
  const logoDims = c.logo.scale(0.26);
  // Right-aligned kicker.
  const kicker = "INFORME DE SERVICIO TÉCNICO";
  const kw = textWidth(c.bold, kicker, 9);
  c.page.drawText(sanitize(kicker), {
    x: c.width - MARGIN - kw,
    y: c.height - MARGIN - 4,
    size: 9,
    font: c.bold,
    color: GOLD,
  });

  c.page.drawImage(c.logo, {
    x: MARGIN,
    y: c.height - MARGIN - logoDims.height,
    width: logoDims.width,
    height: logoDims.height,
  });

  const subId = input.reportId ? `Ref. ${input.reportId.slice(0, 8).toUpperCase()}` : "";
  if (subId) {
    const sw = textWidth(c.font, subId, 8);
    c.page.drawText(sanitize(subId), {
      x: c.width - MARGIN - sw,
      y: c.height - MARGIN - 18,
      size: 8,
      font: c.font,
      color: FAINT,
    });
  }

  let topY = c.height - MARGIN - Math.max(logoDims.height, 24) - 16;

  // Gold rule
  c.page.drawLine({
    start: { x: MARGIN, y: topY },
    end: { x: c.width - MARGIN, y: topY },
    thickness: 2,
    color: GOLD,
  });
  topY -= 22;

  // Navy info card
  const cardPadX = 18;
  const cardX = MARGIN;
  const cardW = contentWidth(c);
  // measure card height
  const nameLines = wrap(c.bold, input.buildingName, 20, cardW - cardPadX * 2);
  let cardH = 16 + nameLines.length * 24 + 8;
  const metaItems: Array<[string, string]> = [];
  if (input.buildingAddress) metaItems.push(["Ubicación", input.buildingAddress]);
  metaItems.push(["Fecha de servicio", input.reportDateLabel]);
  if (input.systems && input.systems.length)
    metaItems.push([
      "Sistemas",
      input.systems
        .map((s) => (s === "pump" ? "Bombeo" : s === "fire" ? "Contra Incendio" : s))
        .join(" · "),
    ]);
  if (input.statusLabel) metaItems.push(["Estado", input.statusLabel]);
  // meta in two columns
  const metaRows = Math.ceil(metaItems.length / 2);
  cardH += metaRows * 28 + 14;

  c.page.drawRectangle({
    x: cardX,
    y: topY - cardH,
    width: cardW,
    height: cardH,
    color: NAVY,
  });
  // gold left accent
  c.page.drawRectangle({
    x: cardX,
    y: topY - cardH,
    width: 4,
    height: cardH,
    color: GOLD,
  });

  let cy = topY - 16 - 18;
  draw(c, "EDIFICIO", cardX + cardPadX, topY - 16, 8, c.bold, GOLD);
  cy = topY - 16 - 18;
  for (const ln of nameLines) {
    c.page.drawText(sanitize(ln), {
      x: cardX + cardPadX,
      y: cy,
      size: 20,
      font: c.bold,
      color: WHITE,
    });
    cy -= 24;
  }
  cy -= 6;

  // meta grid
  const colW = (cardW - cardPadX * 2) / 2;
  metaItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const mx = cardX + cardPadX + col * colW;
    const my = cy - row * 28;
    draw(c, item[0].toUpperCase(), mx, my, 7, c.bold, GOLD);
    const v = wrap(c.font, item[1], 9.5, colW - 12)[0];
    draw(c, v, mx, my - 12, 9.5, c.font, rgb(0.85, 0.87, 0.92));
  });

  c.y = topY - cardH - 26;
}

// ── Section heading ──
function sectionHeading(c: Ctx, title: string) {
  ensure(c, 40);
  // gold tick
  c.page.drawRectangle({ x: MARGIN, y: c.y - 11, width: 3, height: 14, color: GOLD });
  draw(c, title.toUpperCase(), MARGIN + 12, c.y - 9, 11.5, c.bold, NAVY);
  c.y -= 18;
  c.page.drawLine({
    start: { x: MARGIN, y: c.y },
    end: { x: c.width - MARGIN, y: c.y },
    thickness: 0.75,
    color: LINE,
  });
  c.y -= 16;
}

// ── Boxed summary (client summary / notes) ──
function calloutBox(c: Ctx, label: string, body: string, accent: RGB, bg: RGB) {
  const w = contentWidth(c);
  const padX = 14;
  const lines = wrap(c.font, body, 10, w - padX * 2);
  const boxH = 14 + 16 + lines.length * 14 + 10;
  ensure(c, boxH + 8);
  c.page.drawRectangle({ x: MARGIN, y: c.y - boxH, width: w, height: boxH, color: bg });
  c.page.drawRectangle({ x: MARGIN, y: c.y - boxH, width: 3, height: boxH, color: accent });
  draw(c, label.toUpperCase(), MARGIN + padX, c.y - 16, 8, c.bold, accent);
  let ly = c.y - 16 - 16;
  for (const ln of lines) {
    draw(c, ln, MARGIN + padX, ly, 10, c.font, INK);
    ly -= 14;
  }
  c.y -= boxH + 14;
}

// ── Visit subtitle chip ──
function visitSubtitle(c: Ctx, v: PdfVisitBlock) {
  ensure(c, 24);
  const label = `Ejecución ${v.index}`;
  const lw = textWidth(c.bold, label, 9) + 16;
  c.page.drawRectangle({
    x: MARGIN,
    y: c.y - 14,
    width: lw,
    height: 16,
    color: NAVY,
  });
  draw(c, label, MARGIN + 8, c.y - 10.5, 9, c.bold, WHITE);
  const meta = [v.completedAtLabel, v.crewLabel].filter(Boolean).join("  ·  ");
  draw(c, meta, MARGIN + lw + 10, c.y - 10.5, 9, c.font, MUTED);
  c.y -= 24;
}

// ── Key/value results table ──
function resultsTable(c: Ctx, rows: PdfResponseValue[]) {
  if (!rows.length) return;
  const w = contentWidth(c);
  const labelW = Math.round(w * 0.62);
  const valW = w - labelW;
  const padX = 8;
  const size = 9.5;

  // header
  ensure(c, 20);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 16, width: w, height: 16, color: NAVY });
  draw(c, "PARÁMETRO", MARGIN + padX, c.y - 11.5, 7.5, c.bold, WHITE);
  draw(c, "RESULTADO", MARGIN + labelW + padX, c.y - 11.5, 7.5, c.bold, WHITE);
  c.y -= 16;

  rows.forEach((r, i) => {
    const labelLines = wrap(c.bold, r.label, size, labelW - padX * 2);
    const valLines = wrap(c.font, r.value || "—", size, valW - padX * 2);
    const rowH = Math.max(labelLines.length, valLines.length) * 13 + 8;
    if (c.y - rowH < CONTENT_BOTTOM) {
      newPage(c);
      // repeat header
      c.page.drawRectangle({ x: MARGIN, y: c.y - 16, width: w, height: 16, color: NAVY });
      draw(c, "PARÁMETRO", MARGIN + padX, c.y - 11.5, 7.5, c.bold, WHITE);
      draw(c, "RESULTADO", MARGIN + labelW + padX, c.y - 11.5, 7.5, c.bold, WHITE);
      c.y -= 16;
    }
    if (i % 2 === 1) {
      c.page.drawRectangle({ x: MARGIN, y: c.y - rowH, width: w, height: rowH, color: ZEBRA });
    }
    // column divider
    c.page.drawLine({
      start: { x: MARGIN + labelW, y: c.y },
      end: { x: MARGIN + labelW, y: c.y - rowH },
      thickness: 0.5,
      color: LINE,
    });
    let ly = c.y - 13;
    for (const ln of labelLines) {
      draw(c, ln, MARGIN + padX, ly, size, c.bold, rgb(0.2, 0.23, 0.3));
      ly -= 13;
    }
    let vy = c.y - 13;
    const vc = valueColor(r);
    const vfont = r.kind === "checkbox" ? c.bold : c.font;
    for (const ln of valLines) {
      draw(c, ln, MARGIN + labelW + padX, vy, size, vfont, vc);
      vy -= 13;
    }
    c.y -= rowH;
  });
  // bottom border
  c.page.drawLine({
    start: { x: MARGIN, y: c.y },
    end: { x: c.width - MARGIN, y: c.y },
    thickness: 0.75,
    color: LINE,
  });
  c.y -= 14;
}

// ── Agrupa los parámetros por sección (Bombas principales, Tablero, …) ──
function groupHeading(c: Ctx, title: string) {
  ensure(c, 22);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 12, width: 3, height: 11, color: NAVY_500 });
  draw(c, title, MARGIN + 10, c.y - 10, 10, c.bold, NAVY_500);
  c.y -= 17;
}

function groupedResults(c: Ctx, rows: PdfResponseValue[]) {
  if (!rows.length) return;
  const groups: { name: string; rows: PdfResponseValue[] }[] = [];
  for (const r of rows) {
    const idx = r.label.indexOf(" - ");
    const name = idx > 0 ? r.label.slice(0, idx).trim() : "General";
    const cleanLabel = idx > 0 ? r.label.slice(idx + 3).trim() : r.label;
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, rows: [] };
      groups.push(g);
    }
    g.rows.push({ ...r, label: cleanLabel });
  }
  for (const g of groups) {
    groupHeading(c, g.name);
    resultsTable(c, g.rows);
    c.y -= 4;
  }
}

// ── Recorrido por pisos grid ──
function recorridoTable(
  c: Ctx,
  title: string,
  rows: PdfRecorridoRow[]
) {
  const w = contentWidth(c);
  // The raw item label can be very long (lists every column); the grid below
  // already carries the headers, so keep just the leading name.
  const cleanTitle = (title.split("(")[0] || title).trim() || "Recorrido por pisos";
  draw(c, cleanTitle, MARGIN, c.y - 10, 9.5, c.bold, NAVY_500);
  c.y -= 18;
  if (!rows.length) {
    draw(c, "Sin filas registradas.", MARGIN, c.y - 10, 9, c.font, MUTED);
    c.y -= 18;
    return;
  }

  // columns: Piso | P.Ent | P.Sal | EC-A | EC-C | Válv | Manó | Gab | Ext
  const cols: Array<{ k: string; w: number; get: (r: PdfRecorridoRow) => string }> = [
    { k: "Piso", w: 0.16, get: (r) => r.piso || "—" },
    { k: "P.Ent", w: 0.1, get: (r) => (r.presion_entrada ?? "—").toString() },
    { k: "P.Sal", w: 0.1, get: (r) => (r.presion_salida ?? "—").toString() },
    { k: "EC-A", w: 0.1, get: (r) => (r.estacion_control_abierta ? "Sí" : "No") },
    { k: "EC-C", w: 0.1, get: (r) => (r.estacion_control_cerrada ? "Sí" : "No") },
    { k: "Válv", w: 0.11, get: (r) => (r.valvula_reguladora ? "Sí" : "No") },
    { k: "Manó", w: 0.11, get: (r) => (r.estado_manometro ? "Sí" : "No") },
    { k: "Gab", w: 0.06, get: (r) => (r.gabinetes_manguera ? "Sí" : "No") },
    { k: "Ext", w: 0.06, get: (r) => (r.extintores ? "Sí" : "No") },
  ];
  const size = 8;
  const padX = 4;
  const xs: number[] = [];
  let acc = MARGIN;
  for (const col of cols) {
    xs.push(acc);
    acc += col.w * w;
  }

  const header = () => {
    c.page.drawRectangle({ x: MARGIN, y: c.y - 14, width: w, height: 14, color: NAVY });
    cols.forEach((col, i) => draw(c, col.k, xs[i] + padX, c.y - 10, 7, c.bold, WHITE));
    c.y -= 14;
  };
  ensure(c, 30);
  header();

  rows.forEach((r, ri) => {
    const rowH = 14;
    if (c.y - rowH < CONTENT_BOTTOM) {
      newPage(c);
      header();
    }
    if (ri % 2 === 1)
      c.page.drawRectangle({ x: MARGIN, y: c.y - rowH, width: w, height: rowH, color: ZEBRA });
    cols.forEach((col, i) => {
      const val = col.get(r);
      let color = INK;
      if (val === "Sí") color = GREEN;
      else if (val === "No") color = RED;
      draw(c, val, xs[i] + padX, c.y - 10, size, c.font, color);
    });
    c.y -= rowH;
  });
  c.page.drawLine({
    start: { x: MARGIN, y: c.y },
    end: { x: c.width - MARGIN, y: c.y },
    thickness: 0.75,
    color: LINE,
  });
  c.y -= 6;

  // observations (only rows that have them)
  const obs = rows.filter((r) => r.observacion?.trim());
  if (obs.length) {
    c.y -= 4;
    draw(c, "Observaciones", MARGIN, c.y - 10, 8, c.bold, MUTED);
    c.y -= 16;
    for (const r of obs) {
      const lines = wrap(c.font, `Piso ${r.piso || "—"}: ${r.observacion}`, 8.5, w - 10);
      for (const ln of lines) {
        ensure(c, 12);
        draw(c, ln, MARGIN + 6, c.y - 9, 8.5, c.font, INK);
        c.y -= 12;
      }
    }
  }
  c.y -= 10;
}

// ── Evidence ──
async function evidenceBlock(c: Ctx, v: PdfVisitBlock) {
  draw(c, `Evidencia fotográfica · ${v.mediaCount}`, MARGIN, c.y - 10, 9, c.bold, NAVY_500);
  c.y -= 18;
  const images = v.media.filter((m) => m.image);
  if (!images.length) {
    if (v.mediaCount > 0)
      draw(c, "Adjuntos no renderizables como imagen.", MARGIN, c.y - 9, 8.5, c.font, MUTED);
    else draw(c, "Sin evidencia adjunta.", MARGIN, c.y - 9, 8.5, c.font, MUTED);
    c.y -= 16;
    return;
  }

  const w = contentWidth(c);
  const gap = 12;
  const cellW = (w - gap) / 2;
  const cellH = 130;
  for (let i = 0; i < images.length; i += 2) {
    if (c.y - (cellH + 16) < CONTENT_BOTTOM) newPage(c);
    const pair = images.slice(i, i + 2);
    for (let j = 0; j < pair.length; j++) {
      const m = pair[j];
      const cx = MARGIN + j * (cellW + gap);
      try {
        const img = m.image!.isPng
          ? await c.doc.embedPng(m.image!.bytes)
          : await c.doc.embedJpg(m.image!.bytes);
        const base = img.scale(1);
        const scale = Math.min(cellW / base.width, cellH / base.height, 1);
        const iw = base.width * scale;
        const ih = base.height * scale;
        // frame
        c.page.drawRectangle({
          x: cx,
          y: c.y - cellH,
          width: cellW,
          height: cellH,
          borderColor: LINE,
          borderWidth: 0.75,
          color: rgb(0.985, 0.985, 0.99),
        });
        c.page.drawImage(img, {
          x: cx + (cellW - iw) / 2,
          y: c.y - cellH + (cellH - ih) / 2,
          width: iw,
          height: ih,
        });
      } catch {
        c.page.drawRectangle({
          x: cx,
          y: c.y - cellH,
          width: cellW,
          height: cellH,
          borderColor: LINE,
          borderWidth: 0.75,
        });
        draw(c, "No se pudo cargar la imagen", cx + 8, c.y - cellH / 2, 8, c.font, MUTED);
      }
    }
    c.y -= cellH + 14;
  }
}

// ── Signature block ──
function signatureBlock(c: Ctx) {
  ensure(c, 80);
  c.y -= 10;
  const w = contentWidth(c);
  const half = (w - 40) / 2;
  const lineY = c.y - 40;
  const blocks = [
    { x: MARGIN, label: "Técnico responsable" },
    { x: MARGIN + half + 40, label: "Recibido por el cliente" },
  ];
  for (const b of blocks) {
    c.page.drawLine({
      start: { x: b.x, y: lineY },
      end: { x: b.x + half, y: lineY },
      thickness: 0.75,
      color: rgb(0.3, 0.33, 0.4),
    });
    draw(c, b.label, b.x, lineY - 14, 8.5, c.font, MUTED);
    draw(c, "Nombre / Firma / Fecha", b.x, lineY - 26, 7.5, c.font, FAINT);
  }
  c.y = lineY - 36;
}

// ── Footer pass (page numbers, drawn after all pages exist) ──
function drawFooters(c: Ctx, generatedAtLabel: string) {
  const pages = c.doc.getPages();
  const total = pages.length;
  pages.forEach((page, idx) => {
    const { width } = page.getSize();
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_Y + 12 },
      end: { x: width - MARGIN, y: FOOTER_Y + 12 },
      thickness: 0.5,
      color: LINE,
    });
    page.drawText("SEMCO · Mantenimiento de Sistemas Contra Incendio", {
      x: MARGIN,
      y: FOOTER_Y,
      size: 7,
      font: c.font,
      color: FAINT,
    });
    const conf = "Documento confidencial";
    const cw = c.font.widthOfTextAtSize(conf, 7);
    page.drawText(conf, {
      x: (width - cw) / 2,
      y: FOOTER_Y,
      size: 7,
      font: c.font,
      color: FAINT,
    });
    const right = `Página ${idx + 1} de ${total}  ·  ${generatedAtLabel}`;
    const rw = c.font.widthOfTextAtSize(sanitize(right), 7);
    page.drawText(sanitize(right), {
      x: width - MARGIN - rw,
      y: FOOTER_Y,
      size: 7,
      font: c.font,
      color: FAINT,
    });
  });
}

export async function renderServiceReportPdf(
  input: ServiceReportPdfInput
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(input.logoBytes);

  const page = doc.addPage();
  const { width, height } = page.getSize();
  const c: Ctx = {
    doc,
    page,
    width,
    height,
    y: height - MARGIN,
    font,
    bold,
    logo,
    buildingName: input.buildingName,
  };

  drawCover(c, input);

  if (input.clientSummary?.trim()) {
    calloutBox(c, "Resumen para el cliente", input.clientSummary.trim(), GOLD, GOLD_SOFT);
  }
  if (input.internalNotes?.trim()) {
    calloutBox(c, "Notas internas", input.internalNotes.trim(), NAVY_500, rgb(0.95, 0.96, 0.98));
  }

  if (!input.sections.length) {
    ensure(c, 30);
    draw(
      c,
      "No se registraron ejecuciones para esta fecha.",
      MARGIN,
      c.y - 12,
      10,
      c.font,
      MUTED
    );
    c.y -= 24;
  }

  for (const section of input.sections) {
    sectionHeading(c, section.title);
    for (const v of section.visits) {
      visitSubtitle(c, v);
      groupedResults(c, v.rows);
      if (v.recorrido) recorridoTable(c, v.recorrido.label, v.recorrido.rows);
      await evidenceBlock(c, v);
      c.y -= 6;
    }
    c.y -= 6;
  }

  signatureBlock(c);
  drawFooters(c, input.generatedAtLabel);

  return doc.save();
}
