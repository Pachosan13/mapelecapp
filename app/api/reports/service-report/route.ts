import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";
import { readFile } from "fs/promises";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  formatResponseValue,
  getServiceReportData,
} from "@/lib/reports/serviceReport";

const PAGE_MARGIN = 48;
const PANAMA_TIME_ZONE = "America/Panama";

function wrapText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buildingId = searchParams.get("buildingId")?.trim() ?? "";
  const reportDate = searchParams.get("reportDate")?.trim() ?? "";

  if (!buildingId || !reportDate) {
    return NextResponse.json(
      { error: "Faltan parámetros buildingId y reportDate." },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user || (user.role !== "ops_manager" && user.role !== "director")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

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

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 11;
  const headerFontSize = 16;
  const lineHeight = 16;
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

  page.drawText("Service report del día", {
    x: PAGE_MARGIN + logoDims.width + 16,
    y: cursorY - 8,
    size: headerFontSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  cursorY -= Math.max(logoDims.height, headerFontSize + 4) + 16;

  page.drawText(`Building: ${data.building.name}`, {
    x: PAGE_MARGIN,
    y: cursorY,
    size: fontSize,
    font,
  });
  cursorY -= lineHeight;
  page.drawText(`Fecha: ${data.report_date}`, {
    x: PAGE_MARGIN,
    y: cursorY,
    size: fontSize,
    font,
  });
  cursorY -= lineHeight + 8;

  const clientSummary = data.report?.client_summary?.trim();
  if (clientSummary) {
    page.drawText("Resumen para cliente:", {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize,
      font: fontBold,
    });
    cursorY -= lineHeight;
    wrapText(clientSummary, font, fontSize, width - PAGE_MARGIN * 2).forEach(
      (line) => {
        page.drawText(line, {
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
    page.drawText("Notas internas:", {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize,
      font: fontBold,
    });
    cursorY -= lineHeight;
    wrapText(internalNotes, font, fontSize, width - PAGE_MARGIN * 2).forEach(
      (line) => {
        page.drawText(line, {
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

    page.drawText(section.template_name, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: fontSize + 1,
      font: fontBold,
    });
    cursorY -= lineHeight;

    section.visits.forEach((visit, index) => {
      const visitTitle = `Ejecución #${index + 1} · ${formatPanamaDateTime(
        visit.completed_at
      )}`;
      page.drawText(visitTitle, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: fontSize,
        font,
      });
      cursorY -= lineHeight;

      section.items.forEach((item) => {
        const response = visit.latest_response_by_item_id.get(item.id);
        const value = formatResponseValue(item.item_type, response);
        const line = `${item.label}: ${value}`;
        wrapText(line, font, fontSize, width - PAGE_MARGIN * 2).forEach(
          (linePart) => {
            if (cursorY < PAGE_MARGIN + 60) {
              page = pdfDoc.addPage();
              ({ width, height } = page.getSize());
              cursorY = height - PAGE_MARGIN;
            }
            page.drawText(linePart, {
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

  page.drawText("Firma del encargado (V2)", {
    x: PAGE_MARGIN,
    y: cursorY,
    size: fontSize,
    font,
  });
  cursorY -= lineHeight * 2;
  page.drawText("Evidencia (V2)", {
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
      "Content-Disposition": `inline; filename="service-report-${reportDate}.pdf"`,
    },
  });
}
