import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";
import { readFile } from "fs/promises";
import { createClient } from "@/lib/supabase/server";
import {
  formatResponseValue,
  getServiceReportData,
  isRecorridoPorPisosItem,
  parseRecorridoPorPisosValue,
} from "@/lib/reports/serviceReport";

const PAGE_MARGIN = 48;
const PANAMA_TIME_ZONE = "America/Panama";

const sanitizePdfText = (value: string) => {
  return value
    .replace(/✅/g, "SI")
    .replace(/❌/g, "NO")
    .replace(/[\uFE00-\uFE0F]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "");
};

function wrapText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string[] {
  const safeText = sanitizePdfText(text);
  const words = safeText.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(nextLine, fontSize);
    if (width <= maxWidth) {
      currentLine = nextLine;
      return;
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ["—"];
}

const formatBool = (value: boolean) => (value ? "Sí" : "No");

type RecorridoRow = {
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

const normalizeRecorridoRow = (value: any): RecorridoRow | null => {
  if (!value || typeof value !== "object") return null;
  return {
    piso: typeof value.piso === "string" ? value.piso : "",
    presion_entrada:
      typeof value.presion_entrada === "number" &&
      Number.isFinite(value.presion_entrada)
        ? value.presion_entrada
        : null,
    presion_salida:
      typeof value.presion_salida === "number" &&
      Number.isFinite(value.presion_salida)
        ? value.presion_salida
        : null,
    estacion_control_abierta: Boolean(value.estacion_control_abierta),
    estacion_control_cerrada: Boolean(value.estacion_control_cerrada),
    valvula_reguladora: Boolean(value.valvula_reguladora),
    estado_manometro: Boolean(value.estado_manometro),
    gabinetes_manguera: Boolean(value.gabinetes_manguera),
    extintores: Boolean(value.extintores),
    observacion: typeof value.observacion === "string" ? value.observacion : "",
  };
};

const parseRecorridoRowsSafe = (value?: string | null): RecorridoRow[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((row) => normalizeRecorridoRow(row))
      .filter(Boolean) as RecorridoRow[];
  } catch {
    return null;
  }
};

const formatRecorridoRow = (
  row: RecorridoRow,
  index: number
) => {
  const piso = row.piso?.trim() || "—";
  const presionEntrada = row.presion_entrada ?? "—";
  const presionSalida = row.presion_salida ?? "—";
  const observacion = row.observacion?.trim() || "—";
  return (
    `Fila ${index + 1} · Piso: ${piso} · ` +
    `P. entrada: ${presionEntrada} · P. salida: ${presionSalida} · ` +
    `E.C. abierta: ${formatBool(row.estacion_control_abierta)} · ` +
    `E.C. cerrada: ${formatBool(row.estacion_control_cerrada)} · ` +
    `Válvula reguladora: ${formatBool(row.valvula_reguladora)} · ` +
    `Estado manómetro: ${formatBool(row.estado_manometro)} · ` +
    `Gabinetes/manguera: ${formatBool(row.gabinetes_manguera)} · ` +
    `Extintores: ${formatBool(row.extintores)} · ` +
    `Obs: ${observacion}`
  );
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId")?.trim() ?? "";
    const reportDate = searchParams.get("reportDate")?.trim() ?? "";

    if (!buildingId || !reportDate) {
      return NextResponse.json(
        { error: "Faltan parámetros buildingId y reportDate." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = profileError ? null : profile?.role ?? null;
    if (role !== "ops_manager" && role !== "director") {
      return new Response("Forbidden", { status: 403 });
    }

    console.log("[service-report] start", { buildingId, reportDate, role });

    const { data, error } = await getServiceReportData({
      buildingId,
      reportDate,
      userId: user.id,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: error ?? "No se pudo generar el reporte." },
        { status: 400 }
      );
    }

    console.log("[service-report] data", {
      hasReport: !!data.report,
      sections: data.sections?.length ?? 0,
    });

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 11;
    const headerFontSize = 16;
    const lineHeight = 16;
    const noteFontSize = 9;
    const noteLineHeight = 12;
    const checklistNote =
      "SI = OK · NO = Falla · N/A: escríbelo en Observaciones";
    let cursorY = height - PAGE_MARGIN;

    const logoPath = path.join(process.cwd(), "public", "logomapelec.png");
    const logoBytes = await readFile(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoScale = 0.25;
    const logoDims = logoImage.scale(logoScale);

    page.drawImage(logoImage, {
      x: PAGE_MARGIN,
      y: cursorY - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });

    page.drawText(sanitizePdfText("Service report del día"), {
      x: PAGE_MARGIN + logoDims.width + 16,
      y: cursorY - 8,
      size: headerFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    cursorY -= Math.max(logoDims.height, headerFontSize + 4) + 16;

    page.drawText(sanitizePdfText(`Building: ${data.building.name}`), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize,
      font,
    });
    cursorY -= lineHeight;
    page.drawText(sanitizePdfText(`Fecha: ${data.report_date}`), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize,
      font,
    });
    cursorY -= lineHeight + 8;

    const ensureSpace = (linesNeeded: number) => {
      if (cursorY < PAGE_MARGIN + lineHeight * linesNeeded) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        cursorY = height - PAGE_MARGIN;
      }
    };

    const clientSummary = data.report?.client_summary?.trim();
    if (clientSummary) {
      ensureSpace(3);
      page.drawText(sanitizePdfText("Resumen para cliente:"), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: fontSize,
        font: fontBold,
      });
      cursorY -= lineHeight;
      wrapText(clientSummary, font, fontSize, width - PAGE_MARGIN * 2).forEach(
        (line) => {
          ensureSpace(2);
          page.drawText(sanitizePdfText(line), {
            x: PAGE_MARGIN,
            y: cursorY,
            size: fontSize,
            font,
          });
          cursorY -= lineHeight;
        }
      );
      cursorY -= 8;
    }

    const internalNotes = data.report?.internal_notes?.trim();
    if (internalNotes) {
      ensureSpace(3);
      page.drawText(sanitizePdfText("Notas internas:"), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: fontSize,
        font: fontBold,
      });
      cursorY -= lineHeight;
      wrapText(internalNotes, font, fontSize, width - PAGE_MARGIN * 2).forEach(
        (line) => {
          ensureSpace(2);
          page.drawText(sanitizePdfText(line), {
            x: PAGE_MARGIN,
            y: cursorY,
            size: fontSize,
            font,
          });
          cursorY -= lineHeight;
        }
      );
      cursorY -= 8;
    }

    const formatPanamaDateTime = (value?: string | null) => {
      if (!value) return "—";
      return new Intl.DateTimeFormat("es-PA", {
        timeZone: PANAMA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    };

    for (const section of data.sections) {
      if (cursorY < PAGE_MARGIN + 120) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        cursorY = height - PAGE_MARGIN;
      }

      page.drawText(sanitizePdfText(section.template_name), {
        x: PAGE_MARGIN,
        y: cursorY,
        size: fontSize + 1,
        font: fontBold,
      });
      cursorY -= lineHeight;

      wrapText(
        checklistNote,
        font,
        noteFontSize,
        width - PAGE_MARGIN * 2
      ).forEach((line) => {
        ensureSpace(2);
        page.drawText(sanitizePdfText(line), {
          x: PAGE_MARGIN,
          y: cursorY,
          size: noteFontSize,
          font,
          color: rgb(0.35, 0.35, 0.35),
        });
        cursorY -= noteLineHeight;
      });
      cursorY -= 4;

      section.visits.forEach((visit, index) => {
        const visitTitle = `Ejecución #${index + 1} · ${formatPanamaDateTime(
          visit.completed_at
        )}`;
        page.drawText(sanitizePdfText(visitTitle), {
          x: PAGE_MARGIN,
          y: cursorY,
          size: fontSize,
          font,
        });
        cursorY -= lineHeight;

        section.items.forEach((item) => {
          const response = visit.latest_response_by_item_id.get(item.id);
          let handledRecorrido = false;

          if (isRecorridoPorPisosItem(item.label)) {
            try {
              const recorridoRows = parseRecorridoRowsSafe(
                response?.value_text ?? null
              );
              if (recorridoRows) {
                wrapText(
                  `${item.label}:`,
                  font,
                  fontSize,
                  width - PAGE_MARGIN * 2
                ).forEach((linePart) => {
                  if (cursorY < PAGE_MARGIN + 60) {
                    page = pdfDoc.addPage();
                    ({ width, height } = page.getSize());
                    cursorY = height - PAGE_MARGIN;
                  }
                  page.drawText(sanitizePdfText(linePart), {
                    x: PAGE_MARGIN,
                    y: cursorY,
                    size: fontSize,
                    font,
                  });
                  cursorY -= lineHeight;
                });

                if (recorridoRows.length === 0) {
                  wrapText(
                    "Sin filas.",
                    font,
                    fontSize,
                    width - PAGE_MARGIN * 2
                  ).forEach((linePart) => {
                    if (cursorY < PAGE_MARGIN + 60) {
                      page = pdfDoc.addPage();
                      ({ width, height } = page.getSize());
                      cursorY = height - PAGE_MARGIN;
                    }
                  page.drawText(sanitizePdfText(linePart), {
                      x: PAGE_MARGIN,
                      y: cursorY,
                      size: fontSize,
                      font,
                    });
                    cursorY -= lineHeight;
                  });
                } else {
                  recorridoRows.forEach((row, index) => {
                    wrapText(
                      formatRecorridoRow(row, index),
                      font,
                      fontSize,
                      width - PAGE_MARGIN * 2
                    ).forEach((linePart) => {
                      if (cursorY < PAGE_MARGIN + 60) {
                        page = pdfDoc.addPage();
                        ({ width, height } = page.getSize());
                        cursorY = height - PAGE_MARGIN;
                      }
                      page.drawText(sanitizePdfText(linePart), {
                        x: PAGE_MARGIN,
                        y: cursorY,
                        size: fontSize,
                        font,
                      });
                      cursorY -= lineHeight;
                    });
                  });
                }
                handledRecorrido = true;
              }
            } catch {
              handledRecorrido = false;
            }
          }

          if (handledRecorrido) {
            return;
          }

          const value = formatResponseValue(item.item_type, response);
          const line = `${item.label}: ${value}`;
          wrapText(line, font, fontSize, width - PAGE_MARGIN * 2).forEach(
            (linePart) => {
              if (cursorY < PAGE_MARGIN + 60) {
                page = pdfDoc.addPage();
                ({ width, height } = page.getSize());
                cursorY = height - PAGE_MARGIN;
              }
              page.drawText(sanitizePdfText(linePart), {
                x: PAGE_MARGIN,
                y: cursorY,
                size: fontSize,
                font,
              });
              cursorY -= lineHeight;
            }
          );
        });

        cursorY -= 8;
      });

      cursorY -= 8;
    }

    if (cursorY < PAGE_MARGIN + 80) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      cursorY = height - PAGE_MARGIN;
    }

    page.drawText(sanitizePdfText("Firma del encargado (V2)"), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize,
      font,
    });
    cursorY -= lineHeight * 2;
    page.drawText(sanitizePdfText("Evidencia (V2)"), {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize,
      font,
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="service-report-${reportDate}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[service-report] pdf error", err);
    if (process.env.NODE_ENV !== "production") {
      return Response.json(
        {
          ok: false,
          error: String(err?.message ?? err),
          stack: String(err?.stack ?? ""),
        },
        { status: 500 }
      );
    }
    return new Response("Error generating PDF", { status: 500 });
  }
}
